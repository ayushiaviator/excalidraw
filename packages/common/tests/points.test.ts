import { pointFrom, type GlobalPoint } from "@excalidraw/math";

import { getGridPoint, getSizeFromPoints, rescalePoints } from "../src/points";

const p = (x: number, y: number) => pointFrom<GlobalPoint>(x, y);

describe("getSizeFromPoints", () => {
  it("measures the extent of the bounding box", () => {
    expect(getSizeFromPoints([p(0, 0), p(3, 4)])).toEqual({
      width: 3,
      height: 4,
    });
  });

  it("is translation invariant — it returns a size, not a box", () => {
    expect(getSizeFromPoints([p(0, 0), p(3, 4)])).toEqual(
      getSizeFromPoints([p(10, 10), p(13, 14)]),
    );
  });

  it("returns a zero size for a single point", () => {
    expect(getSizeFromPoints([p(5, 5)])).toEqual({ width: 0, height: 0 });
  });

  it("ignores interior points when computing the extent", () => {
    expect(getSizeFromPoints([p(0, 0), p(1, 1), p(4, 2)])).toEqual({
      width: 4,
      height: 2,
    });
  });
});

describe("rescalePoints", () => {
  it("scales the requested axis and leaves the other alone", () => {
    const scaled = rescalePoints(0, 10, [p(0, 7), p(5, 9)], false);

    expect(scaled).toEqual([p(0, 7), p(10, 9)]);
  });

  it("produces the requested extent along the scaled axis", () => {
    const scaled = rescalePoints(1, 20, [p(0, 2), p(0, 4), p(0, 6)], false);

    expect(getSizeFromPoints(scaled).height).toBe(20);
  });

  it("keeps the starting coordinate when normalizing", () => {
    const scaled = rescalePoints(0, 10, [p(2, 0), p(4, 0), p(7, 0)], true);

    // scaling happens about the origin, so without the normalize translation
    // these would start at 4 rather than the original 2
    expect(scaled).toEqual([p(2, 0), p(6, 0), p(12, 0)]);
    expect(getSizeFromPoints(scaled).width).toBe(10);
  });

  it("does not translate two-point lines even when normalizing", () => {
    const input = [p(2, 0), p(7, 0)];

    expect(rescalePoints(0, 10, input, true)).toEqual(
      rescalePoints(0, 10, input, false),
    );
  });

  it("leaves zero-extent input untouched rather than dividing by zero", () => {
    const input = [p(3, 0), p(3, 1), p(3, 2)];

    expect(rescalePoints(0, 10, input, true)).toEqual(input);
  });

  it("does not mutate the input", () => {
    const input = [p(1, 1), p(2, 2), p(3, 3)];
    const snapshot = input.map((point) => [...point]);

    rescalePoints(0, 10, input, true);

    expect(input.map((point) => [...point])).toEqual(snapshot);
  });
});

describe("getGridPoint", () => {
  it("snaps to the nearest grid intersection", () => {
    expect(getGridPoint(7, 13, 5)).toEqual(p(5, 15));
  });

  it("leaves points that already sit on the grid alone", () => {
    expect(getGridPoint(10, 20, 5)).toEqual(p(10, 20));
  });

  it("passes coordinates through when snapping is disabled", () => {
    expect(getGridPoint(7, 13, null)).toEqual(p(7, 13));
  });
});
