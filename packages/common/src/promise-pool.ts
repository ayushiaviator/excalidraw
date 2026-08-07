import Pool from "es6-promise-pool";

// extending the missing types
// relying on the [Index, T] to keep a correct order
type TPromisePool<T, Index = number> = Pool<[Index, T][]> & {
  addEventListener: (
    type: "fulfilled",
    listener: (event: { data: { result: [Index, T] } }) => void,
  ) => (event: { data: { result: [Index, T] } }) => void;
  removeEventListener: (
    type: "fulfilled",
    listener: (event: { data: { result: [Index, T] } }) => void,
  ) => void;
};

/**
 * Runs a stream of promises with a cap on how many are in flight at once,
 * collecting the results in **source order** rather than completion order.
 *
 * Ordering is carried by the `[index, value]` tuple each source promise
 * resolves with: results are bucketed into a `Record<number, T>` keyed by that
 * index, and integer-like object keys enumerate in ascending numeric order, so
 * `Object.values()` hands back the original ordering for free.
 */
export class PromisePool<T> {
  private readonly pool: TPromisePool<T>;
  /** Results keyed by their source index — see the note on ordering above. */
  private readonly entries: Record<number, T> = {};

  /**
   * @param source Iterator of promises, each resolving to `[index, value]`,
   *  where `index` is the position the value should occupy in the output. A
   *  promise resolving to `void` contributes nothing to the results.
   * @param concurrency Maximum number of promises in flight at any one time
   */
  constructor(
    source: IterableIterator<Promise<void | readonly [number, T]>>,
    concurrency: number,
  ) {
    this.pool = new Pool(
      source as unknown as () => void | PromiseLike<[number, T][]>,
      concurrency,
    ) as TPromisePool<T>;
  }

  /**
   * Drains the pool and resolves with every collected value, in source order.
   *
   * Intended to be called once per instance: `entries` is instance state that
   * is never cleared, so a second call would resolve with the first run's
   * results alongside the second's.
   *
   * @returns The collected values, ordered by their source index
   */
  public all() {
    const listener = (event: { data: { result: void | [number, T] } }) => {
      if (event.data.result) {
        // by default pool does not return the results, so we are gathering them manually
        // with the correct call order (represented by the index in the tuple)
        const [index, value] = event.data.result;
        this.entries[index] = value;
      }
    };

    this.pool.addEventListener("fulfilled", listener);

    return this.pool.start().then(() => {
      setTimeout(() => {
        this.pool.removeEventListener("fulfilled", listener);
      });

      return Object.values(this.entries);
    });
  }
}
