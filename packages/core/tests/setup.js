/**
 * jsdom gaps the calendar relies on.
 *
 * jsdom implements no layout: getBoundingClientRect() returns all zeros and
 * elementFromPoint returns null. Pointer-driven modules (drag, resize, selection)
 * therefore cannot be tested through real coordinates — assert on the bus payloads
 * they emit, never on pixel geometry.
 */

// Setup runs for every test file, including the ones on the node environment
// (esbuild cannot run under jsdom), so guard on the DOM being present at all.
if (typeof Element !== 'undefined' && !Element.prototype.scrollTo) {
    // AutoScroll calls this on every view mount; jsdom throws "not implemented".
    Element.prototype.scrollTo = function scrollTo() {};
}
if (typeof window !== 'undefined' && !window.print) {
    window.print = function print() {};
}
