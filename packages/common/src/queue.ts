import { promiseTry, resolvablePromise } from ".";

import type { ResolvablePromise } from ".";

import type { MaybePromise } from "./utility-types";

type Job<T, TArgs extends unknown[]> = (...args: TArgs) => MaybePromise<T>;

type QueueJob<T, TArgs extends unknown[]> = {
  jobFactory: Job<T, TArgs>;
  promise: ResolvablePromise<T>;
  args: TArgs;
};

/**
 * Runs jobs one at a time, in the order they were pushed.
 *
 * Each `push()` hands back a promise that settles with its own job's result,
 * so callers can await an individual job without caring about the queue. A
 * rejected job does not stall the queue — the `finally()` in `tick()` starts
 * the next job regardless of how the previous one settled.
 */
export class Queue {
  private jobs: QueueJob<any, any[]>[] = [];
  private running = false;

  /**
   * Starts the next job if nothing is in flight. Safe to call at any time:
   * it returns immediately while a job is running, and the running job's
   * `finally()` calls back in to drain whatever was queued meanwhile.
   */
  private tick() {
    if (this.running) {
      return;
    }
    const job = this.jobs.shift();
    if (job) {
      this.running = true;
      job.promise.resolve(
        promiseTry(job.jobFactory, ...job.args).finally(() => {
          this.running = false;
          this.tick();
        }),
      );
    } else {
      this.running = false;
    }
  }

  /**
   * Queue a job to run once every job pushed before it has settled.
   *
   * The job is passed as a factory plus its arguments rather than as an
   * already-started promise, so that nothing begins executing until the
   * queue reaches it.
   *
   * @param jobFactory Invoked with `args` when the job reaches the front
   * @param args Arguments forwarded to `jobFactory`
   * @returns A promise settling with this job's result
   */
  push<TValue, TArgs extends unknown[]>(
    jobFactory: Job<TValue, TArgs>,
    ...args: TArgs
  ): Promise<TValue> {
    const promise = resolvablePromise<TValue>();
    this.jobs.push({ jobFactory, promise, args });

    this.tick();

    return promise;
  }
}
