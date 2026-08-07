import { Emitter } from "../src/emitter";

describe("Emitter", () => {
  it("calls subscribers with the triggered payload", () => {
    const emitter = new Emitter<[string, number]>();
    const received: [string, number][] = [];

    emitter.on((a, b) => received.push([a, b]));
    emitter.trigger("a", 1);

    expect(received).toEqual([["a", 1]]);
  });

  it("calls subscribers in subscription order", () => {
    const emitter = new Emitter();
    const order: string[] = [];

    emitter.on(() => order.push("first"));
    emitter.on(() => order.push("second"));
    emitter.trigger();

    expect(order).toEqual(["first", "second"]);
  });

  it("returns an unsubscribe callback from on()", () => {
    const emitter = new Emitter();
    let count = 0;

    const unsubscribe = emitter.on(() => count++);
    emitter.trigger();
    unsubscribe();
    emitter.trigger();

    expect(count).toBe(1);
  });

  it("accepts handlers as an array as well as varargs", () => {
    const emitter = new Emitter();
    const order: string[] = [];

    emitter.on([() => order.push("a"), () => order.push("b")]);
    emitter.on(
      () => order.push("c"),
      () => order.push("d"),
    );
    emitter.trigger();

    expect(order).toEqual(["a", "b", "c", "d"]);
  });

  it("only fires a once() subscriber for the first trigger", () => {
    const emitter = new Emitter<[number]>();
    const received: number[] = [];

    emitter.once((n) => received.push(n));
    emitter.trigger(1);
    emitter.trigger(2);

    expect(received).toEqual([1]);
    expect(emitter.subscribers).toHaveLength(0);
  });

  it("leaves other subscribers attached when a once() subscriber detaches", () => {
    const emitter = new Emitter();
    let persistent = 0;

    emitter.on(() => persistent++);
    emitter.once(() => {});
    emitter.trigger();
    emitter.trigger();

    expect(persistent).toBe(2);
  });

  it("removes a handler via off()", () => {
    const emitter = new Emitter();
    let count = 0;
    const handler = () => count++;

    emitter.on(handler);
    emitter.off(handler);
    emitter.trigger();

    expect(count).toBe(0);
  });

  it("drops every registration of a handler that was subscribed twice", () => {
    const emitter = new Emitter();
    let count = 0;
    const handler = () => count++;

    // off() filters by identity, so both registrations go at once
    emitter.on(handler);
    emitter.on(handler);
    emitter.off(handler);
    emitter.trigger();

    expect(count).toBe(0);
  });

  it("detaches everything on clear()", () => {
    const emitter = new Emitter();
    let count = 0;

    emitter.on(() => count++);
    emitter.on(() => count++);
    emitter.clear();
    emitter.trigger();

    expect(count).toBe(0);
    expect(emitter.subscribers).toHaveLength(0);
  });

  it("finishes the in-flight trigger when a handler unsubscribes another", () => {
    const emitter = new Emitter();
    const order: string[] = [];
    const second = () => order.push("second");

    emitter.on(() => {
      order.push("first");
      emitter.off(second);
    });
    emitter.on(second);

    // off() replaces the subscribers array rather than splicing it, so the
    // loop already running in trigger() keeps iterating the old one
    emitter.trigger();
    expect(order).toEqual(["first", "second"]);

    // ...and the removal takes effect from the next trigger onwards
    emitter.trigger();
    expect(order).toEqual(["first", "second", "first"]);
  });

  it("returns itself from trigger() so calls can be chained", () => {
    const emitter = new Emitter();
    let count = 0;

    emitter.on(() => count++);
    emitter.trigger().trigger();

    expect(count).toBe(2);
  });
});
