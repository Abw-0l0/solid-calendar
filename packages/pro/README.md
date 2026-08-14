# steadycalendar-pro

Optional plugins for [`steadycalendar`](../core): drag/resize persistence and Japanese public holidays.


## Install

```bash
npm install steadycalendar steadycalendar-pro
```

`steadycalendar` is a peer dependency. Unlike the core, this package has one runtime dependency: [`@holiday-jp/holiday_jp`](https://github.com/holiday-jp/holiday_jp-js), which supplies the holiday data.

## DragPersistencePlugin

Listens for `event:drop` and `event:resize` and writes the change through your API. On success it emits `data:refresh`; on failure it reverts the element.

```js
import { CalendarApp } from 'steadycalendar';
import { DragPersistencePlugin } from 'steadycalendar-pro';

const calendar = new CalendarApp({
  el: '#calendar',
  dataSource: { /* … */ },
  plugins: [
    new DragPersistencePlugin({
      async onDrop(event, { date, startTime, resourceId, previousResourceId }) {
        await fetch(`/api/reservations/${event.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, start_time: startTime, staff_id: resourceId }),
        });
      },

      async onResize(event, { endTime }) {
        await fetch(`/api/reservations/${event.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ end_time: endTime }),
        });
      },

      // Reject a move before it is written. Returning false reverts the element.
      canDrop(event, { newResourceId }) {
        return event.sourceData.service?.staff_ids?.includes(newResourceId) ?? true;
      },

      onError(error, event, revert) {
        revert();
        toast(`Could not move ${event.title}`);
      },
    }),
  ],
});
```

Cancelled events are reverted without calling your handler — read from the normalised flag, so it honours whatever `config.statusResolver` you set. Add further blocked states with `blockedStatuses: ['Completed']`; nothing else is blocked by default.

| Option | Signature | Purpose |
|---|---|---|
| `onDrop` | `(event, { date, startTime, resourceId, previousResourceId })` | Persist a move |
| `onResize` | `(event, { endTime })` | Persist a resize |
| `canDrop` | `(event, target) => boolean` | Reject a move before writing |
| `canResize` | `(event, target) => boolean` | Reject a resize before writing |
| `onError` | `(error, event, revert)` | Handle a failed write; call `revert()` to restore |
| `blockedStatuses` | `string[]` | Raw statuses that may not be moved or resized |

## JapaneseHolidayProvider

Supplies Japanese public holidays, cached per year. Passing it in `plugins` is enough — `CalendarApp` adopts any registered plugin implementing `getHoliday` as `config.holidayProvider`.

```js
import { JapaneseHolidayProvider } from 'steadycalendar-pro';

const calendar = new CalendarApp({
  el: '#calendar',
  locale: 'ja-JP',
  plugins: [new JapaneseHolidayProvider()],
  dataSource: { /* … */ },
});
```

Holidays then drive date-header styling, holiday names, and business-hours shading. Names follow `config.locale`: `ja-JP` yields 元日, anything else yields the English name where the dataset has one.

| Method | Returns |
|---|---|
| `getHoliday(dateStr)` | `{ name, name_en }` or `null` |
| `getHolidayName(dateStr, locale?)` | Display name, or `''` |
| `preload(startDate, endDate)` | Warms the per-year cache |
| `clearCache()` | Empties it |

## Testing

```bash
npm test -w packages/pro
```

The suite runs under six timezones in CI, spanning UTC+14 to UTC-11. That matters here: the provider builds its lookup from local `Date` objects, which is correct because `holiday_jp` represents dates the same way, but it is the shape that breaks first if the two ever diverge.

## License

MIT — see [LICENSE](./LICENSE).
