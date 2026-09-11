import { convertToExcalidrawElements } from "@excalidraw/excalidraw";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element/transform";
import type { LibraryItems } from "@excalidraw/excalidraw/types";

/**
 * Dummy library items used to populate the library sidebar during local
 * development, so the item grid can be worked on without having to first
 * install a library or add elements by hand.
 *
 * Only seeded in dev — see `useSeedDevLibrary` in App.tsx.
 */
const SEED_SHAPES: {
  name: string;
  skeleton: ExcalidrawElementSkeleton[];
}[] = [
  {
    name: "Rectangle",
    skeleton: [
      {
        type: "rectangle",
        x: 0,
        y: 0,
        width: 120,
        height: 80,
        backgroundColor: "#a5d8ff",
        fillStyle: "solid",
        strokeColor: "#1971c2",
      },
    ],
  },
  {
    name: "Ellipse",
    skeleton: [
      {
        type: "ellipse",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        backgroundColor: "#b2f2bb",
        fillStyle: "solid",
        strokeColor: "#2f9e44",
      },
    ],
  },
  {
    name: "Diamond",
    skeleton: [
      {
        type: "diamond",
        x: 0,
        y: 0,
        width: 110,
        height: 110,
        backgroundColor: "#ffec99",
        fillStyle: "solid",
        strokeColor: "#f08c00",
      },
    ],
  },
  {
    name: "Labelled box",
    skeleton: [
      {
        type: "rectangle",
        x: 0,
        y: 0,
        width: 160,
        height: 90,
        backgroundColor: "#eebefa",
        fillStyle: "solid",
        strokeColor: "#9c36b5",
        label: { text: "Hello", fontSize: 20 },
      },
    ],
  },
  {
    name: "Arrow",
    skeleton: [
      {
        type: "arrow",
        x: 0,
        y: 0,
        width: 140,
        height: 0,
        strokeColor: "#e03131",
        strokeWidth: 2,
      },
    ],
  },
  {
    name: "Two-box flow",
    skeleton: [
      {
        type: "rectangle",
        x: 0,
        y: 0,
        width: 90,
        height: 60,
        backgroundColor: "#d0bfff",
        fillStyle: "solid",
      },
      {
        type: "rectangle",
        x: 150,
        y: 0,
        width: 90,
        height: 60,
        backgroundColor: "#99e9f2",
        fillStyle: "solid",
      },
      {
        type: "arrow",
        x: 95,
        y: 30,
        width: 50,
        height: 0,
        strokeColor: "#495057",
      },
    ],
  },
];

export const getDevLibraryItems = (): LibraryItems =>
  SEED_SHAPES.map((shape, index) => ({
    id: `dev-library-item-${index}`,
    status: "unpublished" as const,
    elements: convertToExcalidrawElements(shape.skeleton),
    created: Date.now(),
    name: shape.name,
  }));
