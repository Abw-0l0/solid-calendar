# SteadyCalendar — Angular demo and documentation

A documentation site and live playground for [`steadycalendar`](https://www.npmjs.com/package/steadycalendar),
built with Angular 22.

```bash
npm install
npm start          # http://localhost:4200
npm run build      # -> dist/demo/browser
```

## What this is

Seventeen documentation pages and a playground, each mounting a real calendar with
deterministic dummy data. Every feature and setting the library has is covered by a page
that both explains it and demonstrates it running.

The reusable part is `src/app/calendar/` — a `<sc-calendar>` wrapper component meant to be
copied into your own project. See [its README](src/app/calendar/README.md).

## It is not part of the library build

This application sits **outside** the repository's `packages/*` npm-workspaces glob, on
purpose:

- It has its own `package.json` and `package-lock.json`, so `npm run build`, `npm test` and
  the release pipeline at the repository root never see it.
- It installs `steadycalendar` **from the npm registry**, not from `packages/core`. So it
  exercises the published tarball exactly as any other consumer would, and a broken publish
  shows up here.

If `node_modules/steadycalendar` ever becomes a symlink to `packages/core`, that property
has been lost — npm has walked up into the workspace root.

To try changes to the library itself, build it and install the tarball:

```bash
cd ../../packages/core && npm run build && npm pack
cd ../../apps/demo && npm install ../../packages/core/steadycalendar-*.tgz
```

## Layout

```
src/app/
├── calendar/     the <sc-calendar> wrapper — the reusable part
├── data/         deterministic dummy data (no Math.random; a date always looks the same)
├── docs/         one component per documentation page
├── playground/   every setting live, with the resulting config as pasteable code
└── shell/        layout, nav, code blocks, event log, theming service
```

## Deployment

`.github/workflows/pages.yml` builds this app and publishes it to GitHub Pages on pushes
to `main` that touch `apps/demo/**`. It sets `--base-href` for the repository subpath and
copies `index.html` to `404.html`, since Pages has no SPA rewrite for deep links.
