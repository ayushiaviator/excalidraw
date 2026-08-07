import { VersionedSnapshotStore } from "../src/versionedSnapshotStore";

describe("VersionedSnapshotStore", () => {
  describe("set / getSnapshot", () => {
    it("starts at version 0 with the initial value", () => {
      const store = new VersionedSnapshotStore("a");

      expect(store.getSnapshot()).toEqual({ version: 0, value: "a" });
    });

    it("bumps the version on a real change", () => {
      const store = new VersionedSnapshotStore("a");

      expect(store.set("b")).toBe(true);
      expect(store.getSnapshot()).toEqual({ version: 1, value: "b" });
    });

    it("is a no-op when the value is unchanged", () => {
      const store = new VersionedSnapshotStore("a");

      expect(store.set("a")).toBe(false);
      expect(store.getSnapshot().version).toBe(0);
    });

    it("honours a custom equality function", () => {
      const store = new VersionedSnapshotStore(
        { id: 1 },
        (prev, next) => prev.id === next.id,
      );

      expect(store.set({ id: 1 })).toBe(false);
      expect(store.set({ id: 2 })).toBe(true);
    });
  });

  describe("update", () => {
    it("derives the next value from the previous one", () => {
      const store = new VersionedSnapshotStore(1);

      store.update((prev) => prev + 1);

      expect(store.getSnapshot()).toEqual({ version: 1, value: 2 });
    });

    it("does not bump the version when the updater returns the same value", () => {
      const store = new VersionedSnapshotStore(1);

      expect(store.update((prev) => prev)).toBe(false);
      expect(store.getSnapshot().version).toBe(0);
    });
  });

  describe("subscribe", () => {
    it("notifies subscribers with the new snapshot", () => {
      const store = new VersionedSnapshotStore("a");
      const seen: { version: number; value: string }[] = [];

      store.subscribe((snapshot) => seen.push(snapshot));
      store.set("b");

      expect(seen).toEqual([{ version: 1, value: "b" }]);
    });

    it("stops notifying after unsubscribe", () => {
      const store = new VersionedSnapshotStore("a");
      let count = 0;

      const unsubscribe = store.subscribe(() => count++);
      store.set("b");
      unsubscribe();
      store.set("c");

      expect(count).toBe(1);
    });

    it("does not notify a subscriber added from within a subscriber for the in-flight version", () => {
      const store = new VersionedSnapshotStore("a");
      const late: number[] = [];

      store.subscribe(() => {
        store.subscribe((snapshot) => late.push(snapshot.version));
      });

      store.set("b");
      expect(late).toEqual([]);

      store.set("c");
      expect(late).toEqual([2]);
    });
  });

  describe("pull", () => {
    it("resolves immediately when the store is ahead of the caller", async () => {
      const store = new VersionedSnapshotStore("a");
      store.set("b");

      await expect(store.pull(0)).resolves.toEqual({
        version: 1,
        value: "b",
      });
    });

    it("resolves immediately for a caller with no prior version", async () => {
      const store = new VersionedSnapshotStore("a");

      await expect(store.pull()).resolves.toEqual({ version: 0, value: "a" });
    });

    it("waits for the next change when the caller is up to date", async () => {
      const store = new VersionedSnapshotStore("a");
      let settled = false;

      const pending = store.pull(0).then((snapshot) => {
        settled = true;
        return snapshot;
      });

      // nothing has changed yet, so the pull must still be outstanding
      await Promise.resolve();
      expect(settled).toBe(false);

      store.set("b");

      await expect(pending).resolves.toEqual({ version: 1, value: "b" });
    });

    it("resolves every outstanding waiter exactly once", async () => {
      const store = new VersionedSnapshotStore("a");

      const pulls = Promise.all([store.pull(0), store.pull(0)]);
      store.set("b");

      expect(await pulls).toEqual([
        { version: 1, value: "b" },
        { version: 1, value: "b" },
      ]);

      // the waiters were drained, so a further set() has nobody left to notify
      // and the next pull must observe the newest version
      store.set("c");
      await expect(store.pull(1)).resolves.toEqual({ version: 2, value: "c" });
    });

    it("resolves pending pulls even if a subscriber throws", async () => {
      const store = new VersionedSnapshotStore("a");

      store.subscribe(() => {
        throw new Error("subscriber blew up");
      });

      const pending = store.pull(0);

      // set() still propagates the subscriber's error to its caller...
      expect(() => store.set("b")).toThrow("subscriber blew up");

      // ...but the pull() caller is not stranded on an already-published version
      await expect(pending).resolves.toEqual({ version: 1, value: "b" });
    });
  });
});
