/**
 * jsdom gaps the calendar relies on.
 *
 * Mirrors `packages/core/tests/setup.js` in the library, for the same reasons: jsdom
 * implements no layout and no scrolling, so modules that call into either throw rather
 * than no-op. Stubbing them here keeps a real bug visible instead of drowning it in
 * unhandled "not implemented" errors.
 *
 * jsdom proves structure, not appearance — assert on DOM shape and bus payloads, never on
 * pixel geometry, which is all zeros here.
 */

// AutoScroll calls this on every view mount.
if (typeof Element !== 'undefined' && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function scrollTo() {};
}

// The toolbar's print button falls back to window.print() when onPrint is not configured.
if (typeof window !== 'undefined' && !window.print) {
  window.print = function print() {};
}
