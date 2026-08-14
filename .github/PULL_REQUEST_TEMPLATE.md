## What this changes

<!-- And why. If it fixes an issue, link it. -->

## Checklist

- [ ] `npm test` passes
- [ ] `npm run lint` passes
- [ ] `npm run check:imports` passes — resolves every module, not just what `index.js` reaches
- [ ] `npm run build` passes, including the bundle size budget
- [ ] Behaviour changes have a test that fails without the change
- [ ] Visual changes checked in a real browser via `examples/index.html` — jsdom has no
      layout engine and cannot catch them

## Notes for the reviewer

<!-- Anything non-obvious: a decision you weighed, a case you deliberately left out. -->
