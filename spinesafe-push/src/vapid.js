/* VAPID (RFC 8292) with nothing but WebCrypto. The pushes are sent with no
   payload, so there's no message encryption to do — just a signed JWT that
   proves to Apple's push service the request came from this server. */

export function b64url(buf){
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for(const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const P256 = { name:"ECDSA", namedCurve:"P-256" };

export async function generateVapidKeys(){
  const pair = await crypto.subtle.generateKey(P256, true, ["sign", "verify"]);
  const raw = await crypto.subtle.exportKey("raw", pair.publicKey);   // 65-byte uncompressed point
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { publicKey: b64url(raw), privateJwk };
}

export async function vapidJwt(privateJwk, audience, subject){
  const enc = obj => b64url(new TextEncoder().encode(JSON.stringify(obj)));
  const unsigned = enc({ typ:"JWT", alg:"ES256" }) + "." + enc({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,   // Apple rejects anything over a day
    sub: subject
  });
  const jwk = Object.assign({}, privateJwk, { key_ops:["sign"] });
  const key = await crypto.subtle.importKey("jwk", jwk, P256, false, ["sign"]);
  // WebCrypto returns the raw r||s signature, which is exactly what ES256 wants.
  const sig = await crypto.subtle.sign({ name:"ECDSA", hash:"SHA-256" }, key, new TextEncoder().encode(unsigned));
  return unsigned + "." + b64url(sig);
}
