# Changelog

All notable changes to this project are documented here.
This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] — 2026-08-14

One package. `steadycalendar-pro` is discontinued — it existed because it used to be the
paid tier under the Elastic License 2.0, and once it was relicensed MIT in 0.2.0 the split
had no purpose left. It contained 195 lines.

### Changed

- **BREAKING — `steadycalendar-pro` is gone.** `DragPersistencePlugin` now ships in
  `steadycalendar` itself. Drop the second install and change the import:

  ```diff
  - import { DragPersistencePlugin } from 'steadycalendar-pro';
  + import { DragPersistencePlugin } from 'steadycalendar';
  ```

  The plugin's behaviour, options and types are unchanged. `steadycalendar-pro@0.4.0`
  stays on npm and keeps working; it is deprecated, not unpublished.

- **BREAKING — `JapaneseHolidayProvider` is removed**, and with it the
  `@holiday-jp/holiday_jp` dependency. Shipping one country's holiday data in a calendar
  used everywhere was a leftover from the product this was extracted from. Holidays were
  always configurable; the provider was a convenience wrapper, not a capability. Replace it
  with a date-to-name map:

  ```js
  new CalendarApp({ holidays: { '2026-01-01': 'New Year's Day' } });
  ```

  or keep using `holiday_jp` directly — the README's **Public holidays** recipe has the
  full provider, including the UTC handling that a naive version gets wrong.

- The browser bundle is 27.1 kB gzip, up from 26.7 kB, because drag persistence is now
  included rather than a separate install.
- Releases are published with **trusted publishing (OIDC)**. There is no npm token stored
  in the repository any more, and no token fallback in the release workflow — npm falls
  back silently when one is present, which would have hidden a broken setup until
  bypass-2FA tokens lose publishing rights in January 2027.

The package still has **zero runtime dependencies**, which the removal above is what
preserves.

## [0.4.0] — 2026-08-14

Renamed to **SteadyCalendar**. The previous name could not be published: npm rejected it
with `403 Package name too similar to existing package solid-calendar`. npm lowercases a
name and strips `-`, `_` and `.` before comparing, so `solidcalendar` and the existing
`solid-calendar` normalise to the same string. The name was unusable, not merely taken.

Nothing was ever published under the old name, so no installed package, lockfile or import
anywhere refers to it.

The `sc-` class prefix and all 42 `--sc-*` custom properties survive the rename untouched —
`SteadyCalendar` keeps the same initials, which is why this name was chosen over the
alternatives. Four class names do change, but for the unrelated reason below.

### Changed

- **BREAKING — package names.** The packages are `steadycalendar` and `steadycalendar-pro`,
  both unscoped. Subpaths are `steadycalendar/headless` and `steadycalendar/styles`.
- **BREAKING — the browser global is `window.SteadyCalendar`** (`SteadyCalendarPro` for the
  plugins package).
- **BREAKING** — the environment variable is `STEADYCALENDAR_TIMEZONE`. `config.timezone`
  is unaffected and still takes precedence.
- Console messages are tagged `[SteadyCalendar:*]`.
- The GitHub repository is `Abw-0l0/steady-calendar`.

This release also finishes making the library domain-neutral. 0.2.0 generalised the default
field names and quarantined the clinical vocabulary into one opt-in preset, but it never
touched the library's own internal vocabulary: the two resource tiers were still called
`staff` and `resource` in the state, the toolbar, the CSS and the type declarations, while
`FieldMap` already called the same two tiers `resources` and `secondaryResources`.

That was a contradiction, not just a wording preference. `staff` excludes machines, yet the
calendar renders one column per person, room **or** machine. And `resource` meant both the
umbrella concept and the secondary tier at once — `RESOURCE_TYPES.RESOURCE` was the secondary
tier while `CalendarState.resources` was both. The tiers are now `primary` and `secondary`
throughout, and `resource` is only ever the umbrella word.

Nothing is published to npm, so these breaking renames cost no existing user anything.

- **BREAKING — the resource tiers are `primary` and `secondary`.**
  `RESOURCE_TYPES` is `{ PRIMARY: 'primary', SECONDARY: 'secondary' }`, and
  `CalendarResource.type` holds those values. The resource modes are `primaryView` and
  `secondaryView` (was `staffView` and `resourceView`); `integratedView` and `flatView`
  are unchanged. Mode names are simultaneously preference values, `data-mode` attributes
  and translation keys, so all three move together.
- **BREAKING — the filter API is named for resources, not people.**
  `CalendarState.staffFilters` → `resourceFilters`, `setStaffFilters(staffIds)` →
  `setResourceFilters(resourceIds)`, and `filter:changed` now carries `{ resourceIds }`.
  It filters the primary tier; secondary-resource events remain exempt.
- **BREAKING — persisted preference keys.** `staffFilters` → `resourceFilters` and
  `resourceView` → `resourceMode`. The second is also a correctness fix: the key held a
  *mode* name, and `resourceView` was simultaneously one of its own possible values. As in
  0.2.0, an unrecognised stored value is rejected rather than migrated — a dropped filter
  preference falls back to "all resources visible", so the failure is harmless.
- **BREAKING — secondary resources take a `secondary-` id prefix**, replacing `resource-`.
- **BREAKING — the resource-filter CSS classes.** `.sc-staff-filter`,
  `.sc-staff-filter-item` (and `--draggable`) and `.sc-staff-checkbox` became
  `.sc-resource-filter`, `.sc-resource-filter-item` and `.sc-resource-checkbox`. The DOM
  attribute `data-staff-id` became `data-resource-id`. This is the one change that affects
  you if you themed the calendar; every other class name and all 42 custom properties are
  untouched.
- **BREAKING — translation keys.** `staffDisplay` → `resourceDisplay`, `staff` →
  `resources`, `staffView` → `primaryView`, `resourceView` → `secondaryView`, and
  `Reservations` → `schedule` (it was also the only PascalCase key). Keys are as public as
  values, since a host overrides translations *by* key.
- **BREAKING — `DEFAULT_FIELD_MAP` no longer reads `staffSchedules`, `staffOverrides` or
  `rooms`.** They moved into `HEALTHCARE_FIELD_MAP`, which still migrates such a payload in
  one line. Keeping the preset is what lets every default stay generic.
- Japanese defaults that named one industry are gone: `listResource` read "スタッフ" and
  `listService` read "メニュー" long after both keys had gone generic.
- `StaffFilter` is `ResourceFilter` (`src/toolbar/ResourceFilter.js`), and the internal
  vocabulary follows throughout — `_mapAppointment` → `_mapEvent`, `applyStaffFilter` →
  `applyResourceFilter`, and the `staff`/`equipment` naming inside `BusinessHoursOverlay`.
- `RESOURCE_MODES`, `CalendarPreferences.resourceMode` and `CalendarResource.type` are typed
  as unions rather than `string`, so an invalid mode is a compile error rather than a value
  the library rejects at runtime.

### Fixed

- **Grouped events lost their styling in 0.2.0 and nobody noticed.** That release renamed the
  emitted class to `sc-event--group`, but the stylesheet still declared `.sc-event--set-menu`
  — so for two releases a grouped event matched no rule and rendered with no background or
  border treatment. The selector now matches what the mapper writes. The separate group
  indicator triangle was unaffected, which is likely why this went unseen.
- `ResourceViewSwitcher` emitted `resources-dropdown-item`, an unprefixed class matched by no
  rule and no query — a leftover the 0.3.0 `sc-` sweep missed. Removed.
- `CalendarApp` pointed at `docs/DATA-SHAPES.md`, which has never existed. The holiday-hours
  passthrough is now explained where it happens.
- Stale comments describing modes the code no longer has (`Machine`, `Reservation`) and a
  `ListView` header still listing "Patient/Title, Staff, Menu" as its columns.

### Added

- **A guard that keeps the library domain-neutral.** `tests/graph.test.js` now asserts that
  no file under `src/` uses one industry's vocabulary, with `src/core/FieldMap.js` as the
  single documented exemption — that is where domain names are *supposed* to live, because
  `HEALTHCARE_FIELD_MAP` is what lets the defaults stay generic. `tests/i18n.test.js` now
  scans translation **keys** and the Japanese values too, not just the English values;
  scanning values alone is exactly why `staffDisplay` and `staff` survived 0.2.0.

Unchanged: the `sc:slot:select` DOM event and the `calendar.*` artifact filenames.

## [0.3.0] — 2026-08-14

Renamed to **SolidCalendar**. The previous name said nothing about calendars or
scheduling, so nobody would have found it by searching. Nothing had been published to npm
yet, so this rename costs no existing user anything — which is exactly why it happened
before the first release rather than after.

### Changed

- **BREAKING — package names.** The packages are `solidcalendar` and `solidcalendar-pro`.
  Both are unscoped, so no npm organisation is involved. Subpaths are `solidcalendar/headless`
  and `solidcalendar/styles`.
- **BREAKING — the CSS prefix is `sc-`.** Every class and all 42 theming custom properties
  moved to it. If you styled or themed the calendar, this is the change that affects you.
  709 replacements, verified one-to-one by both occurrence count and distinct-token count.
- **BREAKING — the browser global is `window.SolidCalendar`** (`SolidCalendarPro` for the
  plugins package).
- **BREAKING — the DOM event is `sc:slot:select`.**
- **BREAKING — `config.cssPrefix` is removed.** It was advertised as configurable but
  governed only 3 of roughly 113 class names, so setting it produced three orphan classes
  with no matching stylesheet rules and left everything else hardcoded. A half-working
  option is worse than none.
- **BREAKING** — the environment variable is `SOLIDCALENDAR_TIMEZONE`. `config.timezone`
  is unaffected and still takes precedence.
- Console messages are tagged `[SolidCalendar:*]`.

### Fixed

- The plugins package build banner claimed the Elastic License while the package had
  already been relicensed to MIT.

The GitHub repository moved to `Abw-0l0/solid-calendar`; GitHub redirects the old URL, so
existing clones and links keep working. Unchanged: the git history, and the `v0.2.0` tag and
release. Artifact filenames stay `calendar.*` — inside a package called `solidcalendar`,
`solidcalendar/dist/calendar.esm.js` reads correctly.

## [0.2.0] — 2026-08-11

The release that turns the initial code drop into a library. Nothing was published before this,
so the breaking changes below have no installed base to disrupt.

### Added

- **`config.fieldMap`** — declare the field names your API uses instead of reshaping your
  payload. Entities are `dataset`, `event`, `resource`, `secondaryResource`, `client` and
  `service`; a value is a name, an ordered candidate list, or a function, and names may be
  dotted paths. `DEFAULT_FIELD_MAP` and `HEALTHCARE_FIELD_MAP` are exported.
- **`translations` covers every user-visible string**, with `DEFAULT_TRANSLATIONS`,
  `JA_TRANSLATIONS` and `translate()` exported. Any language now works, including ones the
  library has never heard of.
- `config.onPrint`, defaulting to `window.print()`.
- `blockedStatuses` on `DragPersistencePlugin`.
- Normalised event fields: `resourceOwnerId`, `resourceOwnerName`, `clientName`,
  `serviceName`, `groupId`, `ignoresResourceFilter`.
- `ACCESSIBILITY.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, issue and PR templates,
  Dependabot, `.editorconfig`, `.nvmrc`, `.gitattributes`.
- CI: coverage, Windows and macOS runners, CodeQL, dependency review.

### Changed

- **BREAKING — the default field names are generic.** `therapist`, `patient`, `menu`,
  `equipment`, `booking_color`, `set_menu_id` and `staff` are no longer read by default.
  Use `assignee`/`owner`, `client`/`attendee`, `service`, `secondaryResources`, `color`,
  `groupId`, and `resources`. Existing payloads migrate in one line with
  `fieldMap: HEALTHCARE_FIELD_MAP`. If nothing resolves, the calendar now logs which names
  it looked for and which your payload has.
- **BREAKING — `dataset.resources` means the primary collection.** It previously named the
  secondary one. An old payload matches neither list and fails visibly rather than binding
  half of itself.
- **BREAKING — the resource filter now actually filters.** A stored `staffFilters: []`
  previously hid nothing and now hides everything.
- **BREAKING — `packages/pro` is MIT**, relicensed from the Elastic License 2.0.
- **BREAKING** — removed: `config.appData` (and `facilityUuid`, `contextId`,
  `staticCalendarData`, `reservationsData`), `config.translationsTwo`,
  `config.resourceTypes`, `PrintRenderer`, the `DateUtils` namespace,
  `parseLocalDateAsJSDate`, `BREAKPOINTS`, `CSS_PREFIX`, `getDurationDays`, `getViewDef`,
  and the 27 FullCalendar compatibility class names.
- **BREAKING** — `APP_TIMEZONE_DISPLAY` and `VITE_APP_TIMEZONE` are replaced by
  `SOLIDCALENDAR_TIMEZONE`.
- **BREAKING** — an unrecognised stored `resourceView` preference is rejected rather than
  migrated; `reservationData`, `allEquipmentsData` and `allTherapistsData` no longer map.
- `DragPersistencePlugin` reads the normalised `isCancelled` flag rather than a hardcoded
  list of raw status strings, so it honours your `statusResolver`. Its resize path now
  applies the same check as drop.
- CSS class names dropped the last of the old vocabulary: the `menu` and `equipment`
  modifiers became `service` and `secondary`. Custom event fields each carry a per-field
  class, replacing a hardcoded special case for one privileged field id.
- `formatTimeRange` takes a locale.
- The `./headless` subpath has its own type declarations.

### Fixed

- **The resource filter never hid anything.** `_applyFilter` read `event.therapist`, a
  field the mapper never wrote, so the id was always undefined and the guard always true.
- **The list view's resource and service columns were always blank**, and **the service
  line never rendered on an event card** — same cause.
- **A grouped event got its styling or its indicator, never both**: the class was keyed on
  `set_menu_id` and the indicator on `sourceData.group_id`.
- **A payload keyed by `uuid` built columns and then dropped every event against them**;
  resources resolved `id ?? uuid` while events read a bare `id`.
- **The Japanese minutes counter was appended in every locale**, on every event card.
- **`locale: 'ja'` produced a half-Japanese UI**: five modules received the value
  unnormalised. The date picker's Japanese header was unreachable for the same reason.
- **Closed days expressed as weekday numbers never matched**; only day names were compared.
- 18 of 46 runtime exports were undeclared, and `./headless` declared `CalendarApp`, which
  it does not export — TypeScript accepted an import that failed at runtime.
- **Every Japanese holiday shifted back a day in any negative-UTC-offset zone.**
  `holiday_jp` stores dates at UTC midnight and `JapaneseHolidayProvider` read them with
  local getters, so New Year's Day became 31 December, fell outside the year, and the
  calendar showed one fewer holiday than exist. Caught by CI, not by local testing.
- `MIN_EVENT_HEIGHT` was exported and separately redeclared, so changing it did nothing.
- The npm package README still instructed installing a dependency removed a release ago.

## [0.1.0] — unreleased

Initial version. Never published to npm.

### Added

- Continuous integration, `check:imports`, `test:smoke`, and pack verification.

### Changed

- The core has no runtime dependencies. `@js-temporal/polyfill` was a static import and
  therefore mandatory despite being declared an optional peer dependency; the ~15 Temporal
  operations used are now implemented on native `Date` and `Intl`. Delivered bytes dropped
  from 224.8 kB min / 57.8 kB gzip to 26.6 kB / 8.3 kB.
- `config.timezone` is honoured, defaulting to the system zone rather than a hardcoded
  `Asia/Tokyo`.
- `EventBus.emit` snapshots its handler set before dispatching, so a handler subscribing
  during dispatch is not invoked within that same emit.

### Fixed

- `CalendarApp.init()` renders the calendar. The views, toolbar, event rendering and
  interaction handlers were present in the source but imported by nothing, so `init()`
  loaded data and wrote no DOM.
- Four modules imported `getHoliday`/`getHolidayName` from a module exporting neither, so
  the entire view tree failed to bundle.
- Three resource-type vocabularies disagreed, leaving the resource filter dropdown
  permanently empty and the print legend unpopulated.
- One click on an empty slot fired `onSlotSelect` twice.
- Events whose resource had no column rendered under whichever column happened to be first.
- The toolbar threw at init when `config.translations` was absent.
- `require('solidcalendar')` returned an empty object, and the advertised `<script>`
  artifact was an ESM file with a bare import, so it could never load.
- Root `npm test` failed: `packages/pro` had a test script and no test files.

[0.5.0]: https://github.com/Abw-0l0/steady-calendar/releases/tag/v0.5.0
[0.4.0]: https://github.com/Abw-0l0/steady-calendar/releases/tag/v0.4.0
