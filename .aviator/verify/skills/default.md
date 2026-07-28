---
description: How to drive the Excalidraw preview — what the app is, how to reach the toolbar and canvas, and the one big constraint on what counts as evidence here.
---

# Driving the Excalidraw preview

Excalidraw is an infinite-canvas whiteboard / diagramming tool. The preview
serves the full app as a single-page application at the preview URL.

**There is no login and no sign-up.** Navigating to the preview URL lands you
straight on a usable, empty canvas. There is also effectively only one route —
everything happens on `/`. Deep links use URL fragments (`#json=`, `#room=`),
and those depend on backend services that are not reachable from the preview,
so treat them as unavailable.

## The one thing that changes how you gather evidence

**The drawing surface is a `<canvas>` element, not DOM.** Shapes, text, colors,
and strokes are painted as pixels. They do **not** appear as HTML nodes, so:

- Querying the DOM for a rectangle you just drew will find nothing. That is not
  a bug and not a failed render.
- **Screenshots are the primary evidence for anything on the canvas.** Draw the
  thing, then capture the viewport and judge it visually.
- The DOM is still the right tool for the **UI chrome** around the canvas —
  toolbar, menus, panels, dialogs. Those are ordinary elements.

Decide which of the two you are looking at before choosing how to verify it.

## Getting around

The toolbar sits at the top-center. Its buttons are reliably addressable by
`aria-label` — these are the ones present on a default load:

`Selection`, `Rectangle`, `Diamond`, `Ellipse`, `Arrow`, `Line`, `Draw`,
`Text`, `Insert image`, `Eraser`, `Library`, `Hand (panning tool)`,
plus `Zoom in`, `Zoom out`, `Reset zoom`.

Some elements also carry `data-testid`, e.g. `main-menu-trigger` (the hamburger
menu, top-left) and `toolbar-rectangle`.

To draw something:

1. Click a shape tool (e.g. the button with `aria-label="Rectangle"`).
2. Drag on the canvas to create it.
3. With a shape selected, a properties panel appears on the left with stroke
   colour, background, fill style, stroke width, edges, opacity and layers.

Selecting an element is what makes the left-hand properties panel appear, so a
scenario about styling controls usually needs a shape drawn first.

## What is NOT exercised here

Do not write scenarios that depend on these — they cannot pass in a preview:

- **Live collaboration / sharing.** These need an external websocket server and
  backend that the sandbox cannot reach.
- **Anything server-side.** Excalidraw keeps scenes in browser `localStorage`,
  not on a server. There is no database to inspect and nothing to seed — the
  canvas legitimately starts empty on every fresh browser context.
- **Library browsing from the public registry**, which fetches from an external
  host.
- **Export flows that upload**, e.g. share links. Local export actions that only
  produce a download may work, but a file landing on disk is not something you
  can easily observe from here — prefer verifying the dialog and its options
  over the downloaded artifact.

## Notes on the preview specifically

- The app is served by the **Vite dev server**, so a source change is compiled
  on demand — there is no build step to wait for beyond the first page load.
- **ESLint is disabled** in this preview for startup speed. Type checking is
  still on, and `vite-plugin-checker` surfaces type errors as a small badge
  rather than a full-screen overlay, so it will not mask the app.
- A first page load compiles a large module graph and can take a few seconds
  longer than subsequent navigations. Prefer waiting for the canvas to be
  present over a fixed sleep.
- Console output is worth capturing as evidence: a clean load produces no page
  errors, so any that appear are signal.
