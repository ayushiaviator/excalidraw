/**
 * Seed data for the Aviator Verify preview environment.
 *
 * WHY THIS IS A BROWSER SCRIPT AND NOT PART OF preview-setup.sh
 *
 * excalidraw (the open-source app) has no server and no accounts. A scene lives
 * in the *browser* — localStorage["excalidraw"] — so there is nothing the setup
 * script could write from inside the sandbox. Seeding has to happen in whatever
 * browser opens the preview: the verifier's headless Chromium, or yours.
 *
 * preview-setup.sh copies this file into vite's publicDir and injects a
 * <script> tag into index.html at launch. It is NOT referenced by excalidraw's
 * own source, so a normal `yarn start` never loads it — only previews are
 * seeded.
 *
 * LOAD ORDER
 *
 * This is a CLASSIC script (no type="module") in <head>. Module scripts are
 * deferred, so this runs to completion before the app's entry point — and
 * therefore before App.tsx calls importFromLocalStorage(). Making this a module
 * would break the seeding: the app would read localStorage first and find it
 * empty.
 *
 * ELEMENT SHAPE
 *
 * Deliberately minimal. restoreElements() fills in defaults for almost every
 * field (version, versionNonce, index, groupIds, boundElements, updated,
 * locked...), so only the fields that carry meaning are written here. Four
 * constraints are load-bearing, all verified against restore.ts and
 * textMeasurements.ts:
 *   - Shapes need real width/height. Under 0.1px counts as invisibly small and
 *     is silently marked deleted.
 *   - Arrows need >= 2 points, and the first and last must differ.
 *   - A text element's height must be lineCount * fontSize * LINE_HEIGHT,
 *     because lineHeight is *derived* as height/lineCount/fontSize. Get it
 *     wrong and multi-line labels render with squashed or gappy spacing.
 *   - Rounded corners come from roundness {type: 3} (ROUNDNESS.ADAPTIVE_RADIUS).
 * `seed` is pinned per element so the hand-drawn jitter is identical on every
 * run, which keeps verification screenshots stable and diffable.
 */
(function () {
  "use strict";

  // Must match STORAGE_KEYS in excalidraw-app/app_constants.ts.
  var KEY_ELEMENTS = "excalidraw";

  var INK = "#1e1e1e";
  // Monochrome on purpose: this reads as a whiteboard sketch, and it keeps the
  // canvas legible in a screenshot without leaning on colour to carry meaning.
  var NO_FILL = "transparent";
  var LINE_HEIGHT = 1.25;
  var ADAPTIVE_RADIUS = { type: 3 };

  // Deterministic seed sequence, so every preview renders byte-identically.
  var nextSeed = (function () {
    var n = 0;
    return function () {
      n += 1;
      return (n * 7919) % 100000;
    };
  })();

  // fontFamily 5 is Excalifont (FONT_FAMILY in packages/common/src/constants.ts),
  // the app default. Height is derived from the line count so multi-line blocks
  // space correctly — see the note above.
  function text(id, value, x, y, size, width) {
    var lines = value.split("\n").length;
    return {
      id: id,
      type: "text",
      x: x,
      y: y,
      width: width,
      height: lines * size * LINE_HEIGHT,
      text: value,
      originalText: value,
      fontSize: size,
      fontFamily: 5,
      strokeColor: INK,
      seed: nextSeed(),
    };
  }

  function shape(id, kind, x, y, width, height, rounded) {
    return {
      id: id,
      type: kind,
      x: x,
      y: y,
      width: width,
      height: height,
      strokeColor: INK,
      backgroundColor: NO_FILL,
      fillStyle: "solid",
      strokeWidth: 2,
      roundness: rounded ? ADAPTIVE_RADIUS : null,
      seed: nextSeed(),
    };
  }

  // Points are relative to the element's own x/y, which is why each arrow's
  // origin sits on the edge of the shape it leaves. `double` puts an arrowhead
  // on both ends, for the request/response hops.
  function arrow(id, x, y, dx, dy, double) {
    return {
      id: id,
      type: "arrow",
      x: x,
      y: y,
      width: Math.abs(dx),
      height: Math.abs(dy),
      points: [
        [0, 0],
        [dx, dy],
      ],
      strokeColor: INK,
      strokeWidth: 2,
      startArrowhead: double ? "arrow" : null,
      endArrowhead: "arrow",
      seed: nextSeed(),
    };
  }

  // A URL-shortener system design — the sort of diagram this app actually gets
  // used for, which makes it a realistic thing to verify against.
  //
  //   Client  <-->  Primary Server  <-->  Database
  //
  // Two layout constraints, both learned by screenshotting it:
  //   - The localStorage load path does not scroll to content. The viewport
  //     opens at scroll (0,0), so anything far from the origin lands on a
  //     canvas that looks blank.
  //   - Nothing above y=100, or it collides with the floating toolbar and its
  //     "To move canvas, hold..." hint, which sit over the top of the canvas.
  // Everything is kept inside x<1270 so it fits a 1280-wide viewport unscrolled.
  var ELEMENTS = [
    text("seed-title", "URL Shortener (bit.ly) - System Design", 40, 110, 24, 505),
    text(
      "seed-subtitle",
      "Seeded preview scene - edit freely, your changes persist.",
      40,
      150,
      14,
      431,
    ),

    // --- Client -------------------------------------------------------------
    shape("seed-client", "rectangle", 40, 310, 140, 120, true),
    text("seed-client-label", "Client", 77, 358, 20, 66),

    // --- Client <-> Server --------------------------------------------------
    arrow("seed-arrow-client-server", 190, 370, 155, 0, true),
    text(
      "seed-api-routes",
      "POST /urls\nGET /{short_code}",
      195,
      390,
      18,
      170,
    ),

    // --- Primary Server -----------------------------------------------------
    shape("seed-server", "rectangle", 355, 290, 290, 160, true),
    text("seed-server-label", "Primary Server", 423, 358, 20, 154),
    text(
      "seed-write-path",
      "Write: 1) generate short url\n       2) save to DB",
      365,
      210,
      18,
      280,
    ),
    text(
      "seed-read-path",
      "Read: 1) look up original url in DB\n      2) return with 302 redirect",
      355,
      480,
      18,
      350,
    ),

    // --- Server <-> Database ------------------------------------------------
    arrow("seed-arrow-server-db", 655, 370, 120, 0, true),

    // --- Database -----------------------------------------------------------
    shape("seed-database", "ellipse", 785, 285, 170, 170, false),
    text("seed-database-label", "Database", 826, 358, 20, 88),
    text(
      "seed-schema",
      "Urls\n- short url code (or custom alias)\n- original url\n- creationTime\n- expirationTime?\n- createdBy",
      980,
      290,
      15,
      282,
    ),
  ];

  try {
    // Never fight a shared scene. When the URL carries #json= or #room=,
    // App.tsx prompts "override current scene?" if local elements exist — a
    // modal that would block the verifier on its first navigation. #url= is an
    // external-scene import with the same problem.
    if (/^#(json|room|url)=/.test(window.location.hash)) {
      return;
    }

    // Escape hatch: ?reseed=1 restores the scene as shipped, so a canvas that
    // has been drawn all over can be reset without clearing storage by hand.
    var forced = /[?&]reseed=1(&|$)/.test(window.location.search);

    if (!forced) {
      // Only seed a genuinely empty canvas. Someone playing with the preview
      // should not lose their work to a refresh — and on a reconnected sandbox
      // this script runs again against storage that is already populated.
      var existing = localStorage.getItem(KEY_ELEMENTS);
      if (existing) {
        var parsed = JSON.parse(existing);
        if (
          Array.isArray(parsed) &&
          parsed.some(function (el) {
            return el && !el.isDeleted;
          })
        ) {
          return;
        }
      }
    }

    localStorage.setItem(KEY_ELEMENTS, JSON.stringify(ELEMENTS));
    console.info(
      "[aviator-preview] seeded " + ELEMENTS.length + " elements onto the canvas",
    );
  } catch (error) {
    // Storage can be unavailable (private mode, blocked cookies). An empty
    // canvas is a worse preview but still a working one, so this must not be
    // allowed to take the app down on load.
    console.warn("[aviator-preview] could not seed scene:", error);
  }
})();
