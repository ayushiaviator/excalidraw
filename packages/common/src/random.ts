import { nanoid } from "nanoid";
import { Random } from "roughjs/bin/math";

import { isTestEnv } from "./utils";

// seeded at module load so that a process gets a different sequence per run,
// while `reseed()` can still pin it to a known sequence for tests
let random = new Random(Date.now());
let testIdBase = 0;

/**
 * A pseudo-random non-negative integer in `[0, 2^31)`, drawn from the module's
 * seeded generator — so it is reproducible after a `reseed()`, unlike
 * `Math.random()`.
 */
export const randomInteger = () => Math.floor(random.next() * 2 ** 31);

/**
 * Pins the generator to a known sequence, making `randomInteger()` and
 * `randomId()` reproducible across runs.
 *
 * Also resets the `randomId()` counter, so a test that reseeds gets `id0`
 * onwards again rather than continuing from wherever the previous test left
 * off. Both pieces of state have to move together for a reseed to be
 * meaningful.
 *
 * @param seed The seed to restart the generator from
 */
export const reseed = (seed: number) => {
  random = new Random(seed);
  testIdBase = 0;
};

/**
 * A unique id — sequential (`id0`, `id1`, …) under test, `nanoid()` otherwise.
 *
 * The test-only branch exists to keep ids stable across runs so that snapshots
 * stay comparable; it is not collision-resistant and must not be relied on
 * outside tests.
 */
export const randomId = () => (isTestEnv() ? `id${testIdBase++}` : nanoid());
