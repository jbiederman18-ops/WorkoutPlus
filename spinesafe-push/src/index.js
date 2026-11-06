/* SpineSafe push server — a Cloudflare Worker.
 *
 *   GET  /vapid     → { publicKey }  the key the app subscribes with
 *   POST /schedule  { id, subscription:{endpoint}, times:[ms, ...] }
 *   POST /cancel    { id }
 *
 * Each phone gets its own Durable Object (named by the app's random id).
 * It stores the push endpoint and the interval times, and sets an alarm for
 * the next one. When the alarm fires it sends one empty push, then sets the
 * alarm for the time after that. The VAPID keys are generated on first use
 * and kept in a separate Durable Object, so there are no secrets to set up.
 */
import { DurableObject } from "cloudflare:workers";
import { generateVapidKeys, vapidJwt } from "./vapid.js";

const MAX_EVENTS = 400;                 // a whole session is ~100
const MAX_AHEAD_MS = 3 * 60 * 60 * 1000;
const STALE_MS = 60 * 1000;             // don't send an alert for something a minute old

// Only real browser push services, so this can't be pointed at anything else.
const PUSH_HOSTS = [
  /(^|\.)push\.apple\.com$/,
  /^fcm\.googleapis\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)notify\.windows\.com$/
];

function allowedEndpoint(endpoint){
  try{
    const u = new URL(endpoint);
    return u.protocol === "https:" && PUSH_HOSTS.some(re => re.test(u.hostname));
  }catch(e){ return false; }
}

function cors(request, env){
  const origin = request.headers.get("Origin");
  const allowed = env.ALLOWED_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": allowed === "*" ? "*" : (origin === allowed ? origin : allowed),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function json(body, status, headers){
  return new Response(JSON.stringify(body), {
    status, headers: Object.assign({ "Content-Type":"application/json" }, headers)
  });
}

const keyStore = env => env.TIMER.get(env.TIMER.idFromName("__vapid"));

async function sendPush(env, endpoint){
  const keys = await keyStore(env).vapidKeys();
  const jwt = await vapidJwt(keys.privateJwk, new URL(endpoint).origin,
    env.VAPID_SUBJECT || "mailto:spinesafe@example.com");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "TTL": "30",                 // a late interval alert is worse than none
      "Urgency": "high",
      "Authorization": `vapid t=${jwt}, k=${keys.publicKey}`
    },
    body: ""
  });
  return res.status;
}

export class PushTimer extends DurableObject {
  async schedule(endpoint, times){
    await this.ctx.storage.put({ endpoint, times });
    if(times.length) await this.ctx.storage.setAlarm(times[0]);
    else await this.ctx.storage.deleteAlarm();
  }

  async cancel(){
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.delete(["endpoint", "times"]);
  }

  async alarm(){
    const endpoint = await this.ctx.storage.get("endpoint");
    const times = (await this.ctx.storage.get("times")) || [];
    if(!endpoint || !times.length) return;

    const now = Date.now();
    let due = 0;
    while(due < times.length && times[due] <= now + 500) due++;
    const rest = times.slice(due);

    // Several intervals due at once (a slow alarm) still means one push.
    if(due && now - times[due - 1] < STALE_MS){
      let status = 0;
      // A failed send skips this alert rather than stalling the rest.
      try{ status = await sendPush(this.env, endpoint); }catch(e){}
      if(status === 404 || status === 410){   // the phone dropped this subscription
        await this.cancel();
        return;
      }
    }

    await this.ctx.storage.put("times", rest);
    if(rest.length) await this.ctx.storage.setAlarm(rest[0]);
  }

  // Only ever called on the "__vapid" instance.
  vapidKeys(){
    if(!this.keysPromise){
      this.keysPromise = (async () => {
        let keys = await this.ctx.storage.get("vapid");
        if(!keys){
          keys = await generateVapidKeys();
          await this.ctx.storage.put("vapid", keys);
        }
        return keys;
      })();
      this.keysPromise.catch(() => { this.keysPromise = null; });
    }
    return this.keysPromise;
  }
}

export default {
  async fetch(request, env){
    const url = new URL(request.url);
    const headers = cors(request, env);
    if(request.method === "OPTIONS") return new Response(null, { status:204, headers });

    try{
      if(request.method === "GET" && url.pathname === "/vapid"){
        const keys = await keyStore(env).vapidKeys();
        return json({ publicKey: keys.publicKey }, 200, headers);
      }

      if(request.method === "POST" && (url.pathname === "/schedule" || url.pathname === "/cancel")){
        const origin = request.headers.get("Origin");
        if(env.ALLOWED_ORIGIN && env.ALLOWED_ORIGIN !== "*" && origin && origin !== env.ALLOWED_ORIGIN){
          return json({ error:"origin not allowed" }, 403, headers);
        }

        // The app sends text/plain so the request skips the CORS preflight.
        const body = JSON.parse(await request.text());
        const id = String(body.id || "");
        if(!/^[A-Za-z0-9-]{8,64}$/.test(id)) return json({ error:"bad id" }, 400, headers);
        const timer = env.TIMER.get(env.TIMER.idFromName("client:" + id));

        if(url.pathname === "/cancel"){
          await timer.cancel();
          return json({ ok:true }, 200, headers);
        }

        const endpoint = body.subscription && body.subscription.endpoint;
        if(!allowedEndpoint(endpoint)) return json({ error:"bad subscription" }, 400, headers);

        const now = Date.now();
        const times = (Array.isArray(body.times) ? body.times : [])
          .map(Number)
          .filter(t => Number.isFinite(t) && t > now - 1000 && t < now + MAX_AHEAD_MS)
          .sort((a, b) => a - b)
          .slice(0, MAX_EVENTS);

        await timer.schedule(endpoint, times);
        return json({ ok:true, scheduled:times.length }, 200, headers);
      }

      return json({ error:"not found" }, 404, headers);
    }catch(e){
      return json({ error:String((e && e.message) || e) }, 500, headers);
    }
  }
};
