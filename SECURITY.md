# Security

## Reporting a vulnerability

Please **do not open a public issue** for a security vulnerability.

Report it through GitHub's private advisory form:
<https://github.com/Abw-0l0/solid-calendar/security/advisories/new>

You should get an acknowledgement within a week. If a fix is warranted, it will ship in
a patch release with credit to you unless you prefer otherwise.

## Supported versions

Pre-1.0, only the latest published minor receives fixes.

## Scope

This is a client-side rendering library with **zero runtime dependencies**, so the
attack surface is narrow and mostly concerns what a host passes in.

In scope:

- Injection through data the library renders. The DOM is built with
  `document.createElement` and `textContent`, deliberately never `innerHTML`, with one
  exception: a static inline SVG icon in the toolbar containing no interpolated data.
- Prototype pollution through `config`, `fieldMap`, or a `dataSource` payload.
- Anything that lets untrusted event data escape into executable context.

Out of scope:

- Vulnerabilities in a host application's own API, auth, or CSP.
- `@holiday-jp/holiday_jp`, the one runtime dependency of `solidcalendar-pro` —
  report those upstream.
- Denial of service from deliberately pathological input volumes (rendering ten thousand
  overlapping events will be slow; that is not a security boundary).

## Note on `sourceData`

Every normalised event keeps the untouched incoming object as `sourceData`, so anything
you pass in is reachable from your own callbacks. That is intentional, but it does mean
the library will not sanitise your payload for you.
