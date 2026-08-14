# Contributing to SteadyCalendar

Thanks for looking. Issues, questions and pull requests are all welcome — including
"this documentation is wrong", which is a real bug.

## Setup

```bash
npm install          # workspaces: packages/core, packages/pro
npm run build        # esbuild -> dist/ for both packages
npm test             # vitest
```

Node 22.22+ to develop — jsdom 30 is the binding constraint and dropped Node 20 (`.nvmrc` pins 22).
The published packages still support Node 18; CI proves that separately by installing
the built tarball on 18 and using it, so the toolchain floor and the support floor stay
independent.

## Before you push

```bash
npm run check:imports   # resolves every module, not just what index.js reaches
npm run lint
npm run build           # includes the bundle size budget
npm test
npm run typecheck
npm run test:smoke      # loads the <script> artifact in a bare context
```

CI runs all of these on Node 18/20/22 across Linux, Windows and macOS, plus the whole
suite under six timezones.

## Architecture

Modules take `(state, bus, config)` and expose `init(container)` / `destroy()`. They
communicate through the `EventBus` rather than holding references to each other — a
module reaching into another module is a smell. Every `bus.on(...)` returns an
unsubscribe function that `destroy()` must call, along with any `document`-level
listeners it added.

Three rules exist because breaking them caused real, silent bugs. Each is enforced by a
test, not by review:

**Raw incoming field names are read in exactly two places** — `EventMapper` and
`CalendarApp._buildResources` — through the compiled field map. Everything downstream
reads the normalised shape. When this leaked, three renderers ended up reading fields
the mapper never wrote: the resource filter silently stopped filtering and two list
columns were permanently blank. Nothing threw, so nothing caught it.
`tests/graph.test.js` scans the rendering layer for raw names and for `sourceData`.

**Every module must be reachable from `src/index.js`.** A module nothing imports fails
no check: it compiles, no test covers it, and the single-entry-point build never
resolves it. That is how the entire rendering layer once shipped disconnected, drawing
nothing. `tests/graph.test.js` walks the import graph; `check:imports` makes every file
an entry point so a broken import in an unreferenced module still fails.

**Timezone tests only mean something in CI.** On Windows, Node ignores the `TZ`
environment variable for IANA names and silently falls back to the system zone, so a
local matrix runs every "zone" as the same one and proves nothing. Reading a date with
local getters when it was stored at UTC midnight shifts it back a day under any negative
offset — that bug reached CI once and passed six green local runs on the way. Assert the
invariant directly rather than by switching `TZ`, and trust the CI matrix over your
machine.

**Date logic goes through `utils/temporal.js`, and all arithmetic runs on a UTC epoch.**
`new Date(y, m, d)` is banned by the lint config: in zones that transition at midnight,
local midnight does not exist and `Date` silently yields 01:00.
`temporal.differential.test.js` checks the implementation against
`@js-temporal/polyfill` — a dev-only oracle, never bundled — across ~18,600 dates.

## Two things that are configuration, not code

- **Field names.** If you find yourself adding an alias for an incoming field, add it to
  `DEFAULT_FIELD_MAP` or let the consumer declare it via `config.fieldMap`. Do not add a
  `??` chain at a read site.
- **User-visible strings.** Every one lives in `core/Translations.js` with an English
  default. Do not branch on `locale` to pick a string — `locale` formats dates and
  numbers, `translations` supplies words. Anything else makes a third language
  unreachable.

## Tests

Colocated as `*.test.js` for units, `packages/core/tests/` for integration. Named
`should_do_the_thing`.

A behaviour change needs a test that fails without it. If you are fixing a bug, the most
useful thing you can do is write the failing test first and say in the pull request what
it reported before the fix.

jsdom has no layout engine: `getBoundingClientRect()` returns zeros and
`elementFromPoint` returns `null`. So assert on emitted bus payloads, never on pixel
geometry, and check anything visual in a real browser via `examples/index.html`. A
comment strip once silently removed the current-time indicator and the business-hours
shading — every test passed, because both elements were still constructed, just
unclassed.

## Accessibility

The calendar is currently pointer-driven, and [ACCESSIBILITY.md](ACCESSIBILITY.md) lists
the gaps and a sequenced roadmap. Each item there is a reasonable first pull request, and
they are among the most valuable contributions available right now.

## Commits and pull requests

No strict format. A subject line that says what changed, and a body that says why —
particularly what you considered and rejected — is worth more than a convention.

By contributing you agree your work is licensed under the MIT License.
