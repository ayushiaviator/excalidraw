import {
  pointFrom,
  pointFromPair,
  type GlobalPoint,
  type LocalPoint,
} from "@excalidraw/math";

import type { NullableGridSize } from "@excalidraw/excalidraw/types";

/**
 * Width and height of the axis-aligned bounding box enclosing the points.
 *
 * Note this is a *size*, not a bounding box — the origin is discarded, so two
 * point sets that differ only by a translation give the same result.
 *
 * @param points The points to measure
 * @returns The extent along each axis. Callers must not pass an empty array:
 *  `Math.max()`/`Math.min()` of nothing are ∓Infinity, so the result would be
 *  `-Infinity` on both axes rather than zero.
 */
export const getSizeFromPoints = (
  points: readonly (GlobalPoint | LocalPoint)[],
) => {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
};

/**
 * Scales the points along a single axis so their extent becomes `newSize`,
 * leaving the other axis untouched.
 *
 * @param dimension Axis to rescale — 0 for x, 1 for y
 * @param newSize Desired extent along `dimension` after scaling
 * @param points The points to rescale
 * @param normalize When true, translates the result back so it starts at the
 *  same coordinate the input did. Scaling multiplies coordinates by a factor
 *  about the origin, which shifts the whole set unless it is moved back.
 *  Two-point sets are exempt: a line is defined by its endpoints, so there is
 *  nothing to keep anchored.
 * @returns The rescaled points, as a new array
 */
export const rescalePoints = <Point extends GlobalPoint | LocalPoint>(
  dimension: 0 | 1,
  newSize: number,
  points: readonly Point[],
  normalize: boolean,
): Point[] => {
  const coordinates = points.map((point) => point[dimension]);
  const maxCoordinate = Math.max(...coordinates);
  const minCoordinate = Math.min(...coordinates);
  const size = maxCoordinate - minCoordinate;
  const scale = size === 0 ? 1 : newSize / size;

  let nextMinCoordinate = Infinity;

  const scaledPoints = points.map((point): Point => {
    const newCoordinate = point[dimension] * scale;
    const newPoint = [...point];
    newPoint[dimension] = newCoordinate;
    if (newCoordinate < nextMinCoordinate) {
      nextMinCoordinate = newCoordinate;
    }
    return newPoint as Point;
  });

  if (!normalize) {
    return scaledPoints;
  }

  if (scaledPoints.length === 2) {
    // we don't translate two-point lines
    return scaledPoints;
  }

  const translation = minCoordinate - nextMinCoordinate;

  const nextPoints = scaledPoints.map((scaledPoint) =>
    pointFromPair<Point>(
      scaledPoint.map((value, currentDimension) => {
        return currentDimension === dimension ? value + translation : value;
      }) as [number, number],
    ),
  );

  return nextPoints;
};

/**
 * Snaps a coordinate pair to the nearest grid intersection.
 *
 * @param x Unsnapped x coordinate
 * @param y Unsnapped y coordinate
 * @param gridSize Grid spacing, or a nullish value to disable snapping
 * @returns The snapped point, or the input coordinates when snapping is off
 */
// TODO: Rounding this point causes some shake when free drawing
export const getGridPoint = (
  x: number,
  y: number,
  gridSize: NullableGridSize,
): GlobalPoint => {
  if (gridSize) {
    return pointFrom<GlobalPoint>(
      Math.round(x / gridSize) * gridSize,
      Math.round(y / gridSize) * gridSize,
    );
  }
  return pointFrom<GlobalPoint>(x, y);
};
