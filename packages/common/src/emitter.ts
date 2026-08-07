import type { UnsubscribeCallback } from "@excalidraw/excalidraw/types";

type Subscriber<T extends any[]> = (...payload: T) => void;

export class Emitter<T extends any[] = []> {
  public subscribers: Subscriber<T>[] = [];

  /**
   * Attaches subscriber
   *
   * @returns unsubscribe function
   */
  on(...handlers: Subscriber<T>[] | Subscriber<T>[][]): UnsubscribeCallback {
    const _handlers = handlers
      .flat()
      .filter((item) => typeof item === "function");

    this.subscribers.push(..._handlers);

    return () => this.off(_handlers);
  }

  /**
   * Attaches subscribers that detach themselves after the first trigger.
   *
   * Implemented by appending a synthetic handler that calls the unsubscribe
   * returned by `on()`. The `() => detach()` wrapper is load-bearing: it defers
   * reading `detach` until the handler actually runs, which is after the `const`
   * below has been initialised. Calling `this.on(..._handlers, detach)` directly
   * would read `detach` in its own initialiser and throw.
   *
   * @returns unsubscribe function, for detaching before the first trigger
   */
  once(...handlers: Subscriber<T>[] | Subscriber<T>[][]): UnsubscribeCallback {
    const _handlers = handlers
      .flat()
      .filter((item) => typeof item === "function");

    _handlers.push(() => detach());

    const detach = this.on(..._handlers);
    return detach;
  }

  /**
   * Detaches the given subscribers, matched by identity — so a handler that was
   * attached twice is removed by a single call.
   *
   * Replaces the subscriber list rather than mutating it. A `trigger()` that is
   * already iterating holds the previous array, so handlers removed from inside
   * a handler still run for the remainder of that trigger; the removal takes
   * effect from the next one.
   */
  off(...handlers: Subscriber<T>[] | Subscriber<T>[][]) {
    const _handlers = handlers.flat();
    this.subscribers = this.subscribers.filter(
      (handler) => !_handlers.includes(handler),
    );
  }

  /**
   * Invokes every subscriber synchronously, in subscription order.
   *
   * Dispatch is not isolated: a subscriber that throws aborts the loop, so the
   * subscribers after it are skipped for that trigger. Handlers that can fail
   * should catch their own errors.
   *
   * @returns this, so triggers can be chained
   */
  trigger(...payload: T) {
    for (const handler of this.subscribers) {
      handler(...payload);
    }
    return this;
  }

  /** Detaches every subscriber, including any attached via `once()`. */
  clear() {
    this.subscribers = [];
  }
}
