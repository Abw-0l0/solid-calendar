# `<sc-calendar>` — SteadyCalendar for Angular

Two files, no dependencies beyond Angular and `steadycalendar`. Copy them into your project
and delete this README.

```
sc-calendar.component.ts   the component
sc-calendar.types.ts       payload types for the bus events it re-emits
```

There is deliberately no `steadycalendar-angular` package on npm. This is small enough to
own, and owning it means no Angular version range to wait on.

## Install

```bash
npm install steadycalendar
```

Register the stylesheet as a **global** style, not a component style:

```jsonc
// angular.json
"styles": [
  "node_modules/steadycalendar/dist/calendar.css",
  "src/styles.css"
]
```

The calendar builds its own DOM subtree, which Angular never compiles. Emulated view
encapsulation works by stamping an attribute onto elements the compiler has seen, so a
component stylesheet would produce rules that match nothing.

## Use

```html
<div class="calendar-shell">
  <sc-calendar
    [config]="config"
    [(date)]="date"
    [(view)]="view"
    (slotSelect)="onSlotSelect($event)"
    (eventDrop)="onDrop($event)" />
</div>
```

```ts
import { Component, signal } from '@angular/core';
import type { CalendarConfig } from 'steadycalendar';
import { ScCalendarComponent } from './calendar/sc-calendar.component';

@Component({
  selector: 'booking-page',
  imports: [ScCalendarComponent],
  templateUrl: './booking-page.component.html',
})
export class BookingPage {
  // A stable reference. See "Config is not reactive" below.
  protected readonly config: CalendarConfig = {
    dataSource: {
      fetchResources: () => this.api.resources(),
      fetchEvents: ({ start, end }) => this.api.bookings(start, end),
    },
  };

  protected readonly date = signal<string | undefined>(undefined);
  protected readonly view = signal('resourceTimeGridDay');
}
```

The container needs a definite height — the calendar fills what it is given and does not
grow to fit its content:

```css
.calendar-shell { height: calc(100vh - 120px); }
```

## API

| Input | Type | Notes |
|---|---|---|
| `config` | `CalendarConfig` | Required. Changing the **reference** rebuilds the calendar. `el` is ignored. |
| `date` | `string` | Two-way. `'YYYY-MM-DD'`. |
| `view` | `string` | Two-way. A `VIEW_TYPES` key. |
| `resourceMode` | `ResourceMode` | Two-way. |
| `resourceFilters` | `string[]` | Two-way. Primary resource ids. |
| `privacyMode` | `boolean` | Two-way. |

| Output | Payload |
|---|---|
| `ready` | `CalendarApp` — the live instance, for `dataBridge.refresh()` and direct bus access |
| `beforeDestroy` | `CalendarApp` — fired immediately before teardown |
| `eventClick` | `{ event, element }` |
| `slotSelect` | `{ date, startTime, endTime, resourceId }` — a click has `endTime: null` |
| `eventDrop` | `{ event, newDate, newTime, newResourceId, oldResourceId, revert }` |
| `eventResize` | `{ event, newEndTime, revert }` |
| `dateHeaderClick` | `string` |
| `viewChanged` | `{ view, resourceMode }` |
| `eventsLoaded` | `InternalEvent[]` |
| `loadingChange` | `boolean` |
| `titleChange` | `string` |

## Five things worth knowing

These come from the library's design, not from this wrapper. Each one caused a real bug
before it was handled here.

**1. Config is not reactive.** `CalendarApp` reads `this.config.*` live and has no setter,
so a changed config means destroy-and-recreate. The wrapper keys off the config
*reference*, so never build one in a getter or inline in the template:

```html
<!-- WRONG: a new object every change detection pass — an endless rebuild loop -->
<sc-calendar [config]="{ dataSource }" />
```

**2. `CalendarApp` mutates the config it is given.** It assigns `config.holidayProvider`
when a registered plugin implements `getHoliday`. The wrapper passes each instance a fresh
shallow copy, so a frozen or shared object is safe here — but not if you use `CalendarApp`
directly.

**3. Routine changes go through `state`, not config.** Date, view, resource mode, filters
and privacy have setters that refetch and re-render, which is far cheaper than a rebuild.
That is why they are separate inputs. Each is echo-guarded against the value the bus
reports back.

**4. Browser only.** `init()` calls `document.querySelector` immediately, so the mount runs
in `afterNextRender` and is safe under SSR and prerendering.

**5. Timezone is module-global.** The `CalendarApp` constructor calls `setDefaultTimezone`,
which writes module-level state in the library: one zone per page, last constructor wins.
It is not a separate input here, because that would imply a per-instance isolation the
library does not provide. Put it in `config`.

## Change detection

Bus handlers run outside Angular's knowledge. Under zoneless change detection that is fine
— the wrapper's models are signals, so writing one schedules change detection by itself.
Under zone.js it is also fine, because `output.emit` and signal writes both notify.

You only need `ngZone.run()` if you bypass the wrapper, subscribe to `calendar.bus`
yourself, and mutate plain non-signal fields.

## Teardown

`destroy()` unwinds in reverse mount order, disconnects the resize observer, removes every
document-level listener and leaves the container empty. The wrapper calls it from
`DestroyRef.onDestroy` and separately unsubscribes each bus handler it registered — a
handler closing over your component would otherwise keep the component alive.
