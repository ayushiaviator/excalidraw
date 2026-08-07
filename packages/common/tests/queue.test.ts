import { Queue } from "../src/queue";

describe("Queue", () => {
  const calls: any[] = [];

  const createJobFactory =
    <T>(
      // for purpose of this test, Error object will become a rejection value
      resolutionOrRejectionValue: T,
      ms = 1,
    ) =>
    () => {
      return new Promise<T>((resolve, reject) => {
        setTimeout(() => {
          if (resolutionOrRejectionValue instanceof Error) {
            reject(resolutionOrRejectionValue);
          } else {
            resolve(resolutionOrRejectionValue);
          }
        }, ms);
      }).then((x) => {
        calls.push(x);
        return x;
      });
    };

  beforeEach(() => {
    calls.length = 0;
  });

  it("should await and resolve values in order of enqueueing", async () => {
    const queue = new Queue();

    const p1 = queue.push(createJobFactory("A", 50));
    const p2 = queue.push(createJobFactory("B"));
    const p3 = queue.push(createJobFactory("C"));

    expect(await p3).toBe("C");
    expect(await p2).toBe("B");
    expect(await p1).toBe("A");

    expect(calls).toEqual(["A", "B", "C"]);
  });

  it("should reject a job if it throws, and not affect other jobs", async () => {
    const queue = new Queue();

    const err = new Error("B");

    queue.push(createJobFactory("A", 50));
    const p2 = queue.push(createJobFactory(err));
    const p3 = queue.push(createJobFactory("C"));

    const p2err = p2.catch((err) => err);

    await p3;

    expect(await p2err).toBe(err);

    expect(calls).toEqual(["A", "C"]);
  });

  it("should forward the pushed arguments to the job factory", async () => {
    const queue = new Queue();
    const received: [number, string][] = [];

    const result = await queue.push(
      (a: number, b: string) => {
        received.push([a, b]);
        return `${a}${b}`;
      },
      1,
      "two",
    );

    expect(received).toEqual([[1, "two"]]);
    expect(result).toBe("1two");
  });

  it("should support job factories that return synchronously", async () => {
    const queue = new Queue();

    expect(await queue.push(() => "sync")).toBe("sync");
  });

  it("should reject a job that throws synchronously, and keep draining", async () => {
    const queue = new Queue();
    const err = new Error("thrown, not rejected");

    const failing = queue.push(() => {
      throw err;
    });
    const next = queue.push(() => "after");

    await expect(failing).rejects.toBe(err);
    expect(await next).toBe("after");
  });

  it("should run a job enqueued from inside a running job ahead of later pushes", async () => {
    const queue = new Queue();
    const order: string[] = [];

    // promiseTry() resolves with fn(...args), which means the factory is
    // invoked *synchronously* inside push(). So this body — the nested push
    // included — has already run by the time the "second" push below is
    // reached, and "nested" is queued ahead of it.
    const first = queue.push(async () => {
      order.push("first");
      queue.push(() => {
        order.push("nested");
      });
    });
    const second = queue.push(() => {
      order.push("second");
    });

    await first;
    await second;
    // draining push — resolves only once everything ahead of it has run
    await queue.push(() => undefined);

    expect(order).toEqual(["first", "nested", "second"]);
  });
});
