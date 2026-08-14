# steadycalendar

A resource-scheduling calendar for booking and appointment apps. Vanilla JavaScript, zero runtime dependencies, 27.1 kB gzipped.

Built for, and proven in, a commercial booking product at scale — then generalised so the shape of your data is your choice, not the calendar's.

- Day, 3-day and week grids with one column per person, room, or machine
- Month and list views
- Drag to move between columns and times, drag an edge to resize, drag across empty slots to create
- Business hours, closed days, public holidays, current-time indicator
- Time blocks distinct from bookings, resource filtering, privacy mode, persisted view preferences
- Any field names, any language, any timezone

Full documentation: **[github.com/Abw-0l0/steady-calendar](https://github.com/Abw-0l0/steady-calendar#readme)**

## Install

```bash
npm install steadycalendar
```

There is nothing else to install. Node 18+ to build from source.

## Quickstart

```js
import { CalendarApp } from 'steadycalendar';
import 'steadycalendar/styles';

const calendar = new CalendarApp({
  el: '#calendar',

  dataSource: {
    async fetchResources() {
      return {
        resources: [
          { id: 'a1', name: 'Alex Chen', color: '#8935FF' },
          { id: 'a2', name: 'Blake Osei', color: '#007CBE' },
        ],
      };
    },
    async fetchEvents({ start, end }) {
      const res = await fetch(`/api/bookings?from=${start}&to=${end}`);
      return res.json();
    },
  },

  onSlotSelect({ date, startTime, endTime, resourceId }) {
    openBookingDialog({ date, startTime, endTime, resourceId });
  },
  onEventClick(event) {
    openBooking(event.sourceData);
  },
});

await calendar.init();
```

The container needs a height — the calendar fills what it is given. A booking looks like:

```js
{ id: 'b1', date: '2026-08-11', start_time: '09:00', end_time: '09:30',
  assignee: { id: 'a1' }, client: { name: 'J. Ferreira' }, service: { name: 'Consultation' } }
```

An event carrying a `title` is treated as a time block rather than a booking. Both defaults are overridable.

## Your field names

If your API calls them something else, say so once rather than reshaping your payload:

```js
new CalendarApp({
  fieldMap: {
    dataset: { resources: 'crew', secondaryResources: 'bays' },
    event:   { id: 'ref', date: 'on', startTime: 'from', endTime: 'to',
               owner: 'assignedTo', client: 'booker', service: 'job' },
  },
})
```

A value may be a name, an ordered list of candidates, or a function; names may be dotted paths. `HEALTHCARE_FIELD_MAP` is shipped for payloads using healthcare vocabulary.

## Your language

`locale` formats dates and numbers; `translations` supplies strings. They are independent, so any language works without the library knowing it exists.

```js
import { JA_TRANSLATIONS } from 'steadycalendar';

new CalendarApp({ locale: 'ja-JP', translations: JA_TRANSLATIONS, /* … */ });
```

## Entry points

| Import | What you get |
|---|---|
| `steadycalendar` | The calendar. 27.1 kB gzip. |
| `steadycalendar/headless` | State, data and date utilities, no DOM. 8.7 kB gzip. |
| `steadycalendar/styles` | The stylesheet. |

A `<script>` build is published too — `dist/calendar.global.min.js` exposes `window.SteadyCalendar` and needs no loader.

## Accessibility

The calendar is currently pointer-driven: events are not keyboard focusable and there is no keyboard equivalent for moving, resizing or creating them. This is a known gap with a published roadmap — see [ACCESSIBILITY.md](https://github.com/Abw-0l0/steady-calendar/blob/main/ACCESSIBILITY.md) before adopting it somewhere keyboard access is required.

## License

MIT
