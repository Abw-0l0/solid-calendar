import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CalendarConfig } from 'steadycalendar';
import { ScCalendarComponent } from '../calendar/sc-calendar.component';
import { CodeBlockComponent } from '../shell/code-block.component';
import { DemoFrameComponent } from '../shell/demo-frame.component';
import { HOLIDAYS, STAFF, TODAY, createDemoDataSource } from '../data';

@Component({
  selector: 'page-business-hours',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScCalendarComponent, DemoFrameComponent, CodeBlockComponent, RouterLink],
  template: `
    <div class="doc-content">
      <h1>Hours and holidays</h1>
      <p class="doc-lead">
        Opening hours are resolved per resource, per day, through a chain of six sources. The shaded bands are
        the result. Getting this right is most of what separates a scheduling calendar from a grid of boxes.
      </p>

      <h2>The resolution chain</h2>
      <p>
        For each primary resource on each date, the first source that produces an answer wins, and the result
        is then intersected with the business's own hours — so a resource can never open wider than the
        business does.
      </p>
      <ol class="chain">
        <li><strong>Resource date override</strong> — <code>type: 'closed'</code> shades the day; <code>'open'</code> sets explicit hours.</li>
        <li><strong>Closed days</strong> — a weekly day off. Matches names and numbers alike.</li>
        <li><strong>Holiday policy</strong> — the resource's own, else the business-wide setting.</li>
        <li><strong>Weekly schedules</strong> — the resource's normal week.</li>
        <li><strong>Business date override</strong> — a company-wide closure or late opening.</li>
        <li><strong>Weekly business hours</strong> — the fallback. A weekday that is absent is closed.</li>
      </ol>
      <p>
        Secondary resources skip all of it and always use plain business hours. A result of "closed" shades
        the entire column.
      </p>

      <h2>Five resources, five branches</h2>
      <p>
        Each person in this dataset exercises a different link in that chain. Page forward a few days to see
        Dara's leave and the company closure appear.
      </p>
      <div class="table-scroll">
        <table class="doc-table">
          <thead><tr><th>Resource</th><th>Configured with</th><th>What you see</th></tr></thead>
          <tbody>
            <tr><td>Alex Chen</td><td>nothing</td><td>Falls through to plain business hours.</td></tr>
            <tr><td>Blake Osei</td><td><code>schedules</code> 08:00–16:00</td><td>Opens at 09:00 anyway — clamped by business hours.</td></tr>
            <tr><td>Corin Vale</td><td><code>closedDays: ['Wednesday', 0]</code></td><td>Wednesday and Sunday shaded closed.</td></tr>
            <tr><td>Dara Okonjo</td><td>two <code>overrides</code></td><td>Three days closed; one Saturday extended.</td></tr>
            <tr><td>Emre Sahin</td><td><code>holiday_hours_setting: 'closed'</code></td><td>Closed on holidays even though the business opens.</td></tr>
          </tbody>
        </table>
      </div>

      <div class="pill-row">
        <button class="btn" [class.btn--active]="!holidays()" type="button" (click)="holidays.set(false)">
          No holidays
        </button>
        <button class="btn" [class.btn--active]="holidays()" type="button" (click)="holidays.set(true)">
          With holidays
        </button>
        <button class="btn" type="button" (click)="goToHoliday()">Jump to a holiday</button>
      </div>

      <demo-frame label="Business hours shading" [height]="560">
        <sc-calendar [config]="config()" [(date)]="date" />
      </demo-frame>

      <h2>Weekly hours</h2>
      <code-block [code]="weekly" />
      <p>
        <code>day_of_week</code> accepts a name or a number, and several rows for one day are merged to the
        earliest start and latest end. A weekday with no row at all is closed.
      </p>

      <h2>Per-resource scheduling</h2>
      <code-block [code]="perResource" />

      <h2>Holidays: three sources</h2>
      <p>
        The library ships no holiday data for any country. A calendar used worldwide has no business
        privileging one, and the data changes yearly — so it comes from you, by whichever of three routes
        fits. They are consulted in this order.
      </p>
      <div class="table-scroll">
        <table class="doc-table">
          <thead><tr><th>#</th><th>Source</th><th>Gives you</th></tr></thead>
          <tbody>
            <tr><td>1</td><td><code>config.holidayProvider.getHoliday(date)</code></td><td>A name, and a localised name. Best for a live source.</td></tr>
            <tr><td>2</td><td><code>config.holidays</code></td><td>A date-to-name map. Simplest.</td></tr>
            <tr><td>3</td><td><code>publicHolidays</code> from <code>fetchResources</code></td><td>Presence only — the date is a holiday, with no name.</td></tr>
          </tbody>
        </table>
      </div>
      <code-block [code]="holidayMap" />
      <p>
        For a live source or a per-country package, implement <code>HolidayProvider</code> — see
        <a routerLink="/plugins">plugins</a>, where any registered plugin exposing <code>getHoliday</code> is
        adopted automatically.
      </p>

      <h2>What a holiday does</h2>
      <p>
        A holiday date is labelled in the header and coloured with <code>--sc-holiday-color</code>, and it
        switches hours resolution to the holiday policy:
      </p>
      <code-block [code]="holidayPolicy" />
      <p>
        A resource inherits the business policy unless it sets its own. <code>'follow'</code> is the default
        and means exactly that; <code>'normal'</code> means ignore the holiday and keep ordinary hours.
      </p>

      <div class="note note--warn">
        <strong>Shading is not enforcement.</strong>
        None of this blocks a drag, a resize or a slot selection. If a booking outside opening hours is
        invalid in your product, check for it in <code>canDrop</code> and in your own create flow.
      </div>
    </div>
  `,
  styles: [
    `
      .chain {
        margin: 0 0 1.25rem;
        padding-left: 1.35rem;
      }
      .chain li {
        margin-bottom: 0.35rem;
      }
    `,
  ],
})
export class BusinessHoursPage {
  protected readonly holidays = signal(true);
  protected readonly date = signal<string | undefined>(TODAY);

  protected readonly config = computed<CalendarConfig>(() => ({
    dataSource: createDemoDataSource(),
    ...(this.holidays() ? { holidays: HOLIDAYS } : {}),
  }));

  protected goToHoliday(): void {
    this.holidays.set(true);
    this.date.set(Object.keys(HOLIDAYS).sort()[1]);
  }

  protected readonly weekly = `
async fetchResources() {
  return {
    resources: [ /* ... */ ],
    businessHours: [
      { day_of_week: 'Monday',    start_time: '09:00', end_time: '18:00' },
      { day_of_week: 'Thursday',  start_time: '09:00', end_time: '20:00' },
      { day_of_week: 'Saturday',  start_time: '10:00', end_time: '14:00' },
      // Sunday is absent, so Sunday is closed.
    ],
    businessOverrides: [
      { from_date: '2026-12-24', to_date: '2026-12-26', type: 'closed' },
      { from_date: '2026-11-28', type: 'open', start_time: '11:00', end_time: '22:00' },
    ],
  };
}
`;

  protected readonly perResource = `
{
  id: 's4',
  name: 'Dara Okonjo',

  // A weekly day off. Names and numbers both match; 0 is Sunday.
  closedDays: ['Wednesday', 0],

  // The normal week, if it differs from the business's.
  schedules: [
    { day_of_week: 'Monday', start_time: '08:00', end_time: '16:00' },
  ],

  // Date exceptions. These beat everything else.
  overrides: [
    { from_date: '2026-08-18', to_date: '2026-08-20', type: 'closed' },
    { from_date: '2026-08-23', type: 'open', start_time: '07:00', end_time: '20:00' },
  ],

  // What this person does on a public holiday.
  holiday_hours_setting: 'custom',
  holiday_hours: [{ start_time: '11:00', end_time: '15:00' }],
}
`;

  protected readonly holidayMap = `
new CalendarApp({
  holidays: {
    '2026-01-01': 'New Year',
    '2026-05-01': 'Labour Day',
  },
});
`;

  protected readonly holidayPolicy = `
// On the business, from fetchResources:
holidaySettings: {
  holiday_hours_setting: 'custom',                        // 'follow' | 'closed' | 'custom' | 'normal'
  holiday_hours: [{ start_time: '11:00', end_time: '15:00' }],
}

// On a single resource, overriding the business:
{ id: 's5', name: 'Emre Sahin', holiday_hours_setting: 'closed' }
`;
}
