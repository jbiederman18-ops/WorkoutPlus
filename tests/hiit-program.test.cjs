const { test } = require("node:test");
const assert = require("node:assert/strict");
const { program, workouts } = require("../hiit-program.json");

test("HIIT has four sessions per week in order, with stable workout IDs", () => {
  assert.deepEqual(program.weeklySchedule, ["Monday", "Tuesday", "Thursday", "Saturday"]);
  assert.equal(program.weekCount, 4);
  assert.equal(program.sessionsPerWeek, 4);
  assert.equal(program.totalSessions, 16);
  assert.equal(workouts.length, 16);

  workouts.forEach((workout, index) => {
    const week = Math.floor(index / 4) + 1;
    const session = index % 4 + 1;
    assert.equal(workout.id, `hiit-w0${week}-s0${session}`);
    assert.equal(workout.week, week);
    assert.equal(workout.sessionInWeek, session);
    assert.equal(workout.scheduledDay, program.weeklySchedule[session - 1]);
  });
});

for (const workout of workouts) {
  test(`${workout.id} preserves the ordered 30-minute playback queue`, () => {
    const [work, rest] = [[35, 25], [40, 20], [40, 20], [45, 15]][workout.week - 1];
    assert.equal(workout.workSeconds, work);
    assert.equal(workout.restSeconds, rest);
    assert.equal(workout.warmup.length, 5);
    assert.equal(workout.cooldown.length, 5);
    assert.equal(workout.circuits.length, 2);

    const expected = workout.warmup.map(label => ["warmup", label, 60]);
    for (const circuit of workout.circuits) {
      assert.equal(circuit.repeatCount, 2);
      assert.equal(circuit.exercises.length, 5);
      for (let round = 1; round <= circuit.repeatCount; round++) {
        circuit.exercises.forEach((label, index) => {
          expected.push(
            ["work", label, work, circuit.number, round, index + 1],
            ["rest", "Rest & Recover", rest, circuit.number, round, index + 1],
          );
        });
      }
    }
    expected.push(...workout.cooldown.map(label => ["cooldown", label, 60]));

    const { intervals } = workout;
    assert.equal(intervals.length, 50);
    assert.equal(new Set(intervals.map(interval => interval.id)).size, 50);
    assert.equal(workout.durationSeconds, 1800);
    assert.equal(intervals.reduce((total, interval) => total + interval.durationSeconds, 0), 1800);
    assert.deepEqual(
      intervals.map(({ phase, label, durationSeconds, circuit, repeat, exerciseIndex }) =>
        circuit === undefined
          ? [phase, label, durationSeconds]
          : [phase, label, durationSeconds, circuit, repeat, exerciseIndex]),
      expected,
    );
  });
}
