import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CalendarConfig } from 'steadycalendar';
import { ScCalendarComponent } from '../calendar/sc-calendar.component';
import { CodeBlockComponent } from '../shell/code-block.component';
import { DemoFrameComponent } from '../shell/demo-frame.component';
import { demoDataSource } from '../data';

@Component({
  selector: 'page-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScCalendarComponent, DemoFrameComponent, CodeBlockComponent, RouterLink],
  template: `
    <div class="doc-content">
      <h1>SteadyCalendar</h1>
      <p class="doc-lead">
        A resource-scheduling calendar for booking and appointment apps — vanilla JavaScript, zero runtime
        dependencies, 27.1 kB gzipped. This site documents it and drives it live from an Angular application.
      </p>

      <div class="pill-row">
        <a class="btn btn--primary" routerLink="/getting-started">Get started</a>
        <a class="btn" routerLink="/angular">Angular integration</a>
        <a class="btn" routerLink="/playground">Open the playground</a>
      </div>

      <demo-frame label="Day view, five resources, real data" [height]="560">
        <sc-calendar [config]="config" />
      </demo-frame>

      <p>
        That calendar is the published npm package, unmodified. Drag a booking between columns, drag its lower
        edge to resize it, or drag across empty slots to select a range. The greyed bands are outside business
        hours; the red line is the current time.
      </p>

      <h2>Why it exists</h2>
      <p>
        Off-the-shelf scheduling calendars tend to mean taking on a large dependency and then working against
        its abstractions to get the behaviour a booking product actually needs: multi-resource columns,
        per-resource closed days, time blocks that are distinct from bookings, per-site business hours.
      </p>
      <p>
        SteadyCalendar inverts that trade. The core owns state, date arithmetic and event normalisation;
        rendering is a layer you can use, replace, or leave out entirely. Zero runtime dependencies is a
        constraint the architecture is organised around rather than a happy accident — a test fails if anything
        from <code>node_modules</code> reaches the bundle.
      </p>

      <h2>What it does</h2>
      <div class="card-grid">
        <div class="card">
          <h4>Resource columns</h4>
          <p>Day, 3-day and week grids with one column per person, room or machine.</p>
        </div>
        <div class="card">
          <h4>Six more views</h4>
          <p>Non-resource time grids, a month grid and a list view, all switchable at runtime.</p>
        </div>
        <div class="card">
          <h4>Direct manipulation</h4>
          <p>Drag to move across time and columns, drag an edge to resize, drag empty slots to create.</p>
        </div>
        <div class="card">
          <h4>Real opening hours</h4>
          <p>Business hours, per-resource schedules, closed days, date overrides and public holidays.</p>
        </div>
        <div class="card">
          <h4>Your field names</h4>
          <p>A declared field map reads your payload as it is, rather than making you reshape it.</p>
        </div>
        <div class="card">
          <h4>Your language</h4>
          <p>Locale and translations are independent, so a language the library never heard of works.</p>
        </div>
      </div>

      <h2>Install and run</h2>
      <code-block
        [code]="install"
        title="terminal" />
      <code-block [code]="quickstart" title="calendar.ts" />

      <h2>Bundle size</h2>
      <div class="table-scroll">
        <table class="doc-table">
          <thead>
            <tr><th>Artifact</th><th>Raw</th><th>Gzip</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>calendar.global.min.js</code> — everything, script-ready</td>
              <td>113.6 kB</td><td><strong>27.1 kB</strong></td>
            </tr>
            <tr>
              <td><code>calendar.esm.min.js</code> — everything, for bundlers</td>
              <td>113.2 kB</td><td>26.9 kB</td>
            </tr>
            <tr>
              <td><code>calendar.headless.min.js</code> — state and data only</td>
              <td>26.9 kB</td><td>8.7 kB</td>
            </tr>
            <tr><td><code>calendar.css</code></td><td>28.4 kB</td><td>5.0 kB</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        The library's own build fails if the browser bundle passes 40 kB gzip, so the number above is a budget
        rather than a measurement that drifts.
      </p>

      <h2>Where to go next</h2>
      <div class="card-grid">
        <div class="card">
          <h4><a routerLink="/getting-started">Getting started</a></h4>
          <p>Install it, load the stylesheet, render your first grid.</p>
        </div>
        <div class="card">
          <h4><a routerLink="/angular">Angular integration</a></h4>
          <p>The wrapper component this site uses, and the five lifecycle traps it handles.</p>
        </div>
        <div class="card">
          <h4><a routerLink="/playground">Playground</a></h4>
          <p>Every setting on one page, with the resulting config to copy.</p>
        </div>
        <div class="card">
          <h4><a routerLink="/accessibility">Accessibility</a></h4>
          <p>An honest account of what is not keyboard reachable yet. Read before adopting.</p>
        </div>
      </div>
    </div>
  `,
})
export class OverviewPage {
  /**
   * Held as a class field, not rebuilt in a getter. The wrapper rebuilds the calendar
   * whenever this reference changes, and a getter would hand it a new object on every
   * change detection pass — a rebuild loop rather than a calendar.
   */
  protected readonly config: CalendarConfig = {
    dataSource: demoDataSource,
    translations: { schedule: 'Studio schedule', resources: 'Team', resourceDisplay: 'Team' },
  };

  protected readonly install = `npm install steadycalendar`;

  protected readonly quickstart = `
import { CalendarApp } from 'steadycalendar';
import 'steadycalendar/styles';

const calendar = new CalendarApp({
  el: '#calendar',

  dataSource: {
    // Called once, cached 30 minutes.
    async fetchResources() {
      return {
        resources: [
          { id: 'a1', name: 'Alex Chen',  color: '#8935FF' },
          { id: 'a2', name: 'Blake Osei', color: '#007CBE' },
        ],
      };
    },
    // Called for the visible range, again when the date or view changes.
    async fetchEvents({ start, end }) {
      const res = await fetch(\`/api/bookings?from=\${start}&to=\${end}\`);
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
`;
}
