import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CalendarConfig } from 'steadycalendar';
import { ScCalendarComponent } from '../calendar/sc-calendar.component';
import { CodeBlockComponent } from '../shell/code-block.component';
import { DemoFrameComponent } from '../shell/demo-frame.component';
import { demoDataSource } from '../data';

@Component({
  selector: 'page-getting-started',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScCalendarComponent, DemoFrameComponent, CodeBlockComponent, RouterLink],
  template: `
    <div class="doc-content">
      <h1>Getting started</h1>
      <p class="doc-lead">
        Install the package, load one stylesheet, give the container a height. That is the whole setup — there
        is no module to register and no provider to configure.
      </p>

      <h2>1. Install</h2>
      <code-block [code]="install" title="terminal" />
      <p>
        One package, nothing to install at runtime. It runs on Node 18 and above, and CI proves that by
        installing the published tarball on 18, 20, 22 and 24 and using it.
      </p>

      <h2>2. Entry points</h2>
      <div class="table-scroll">
        <table class="doc-table">
          <thead>
            <tr><th>Import</th><th>Artifact</th><th>Use for</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>import &#123; CalendarApp &#125; from 'steadycalendar'</code></td>
              <td><code>dist/calendar.esm.js</code></td>
              <td>Bundlers — Angular, Vite, webpack.</td>
            </tr>
            <tr>
              <td><code>require('steadycalendar')</code></td>
              <td><code>dist/calendar.cjs</code></td>
              <td>CommonJS consumers.</td>
            </tr>
            <tr>
              <td><code>&lt;script src="…/calendar.global.min.js"&gt;</code></td>
              <td><code>window.SteadyCalendar</code></td>
              <td>No build step at all.</td>
            </tr>
            <tr>
              <td><code>import 'steadycalendar/styles'</code></td>
              <td><code>dist/calendar.css</code></td>
              <td>Required — the grid has no inline styles.</td>
            </tr>
            <tr>
              <td><code>from 'steadycalendar/headless'</code></td>
              <td><code>calendar.headless.esm.js</code></td>
              <td>State and data with no DOM, 8.7 kB gzip.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>3. Load the stylesheet</h2>
      <p>
        In an Angular application, register it as a <strong>global</strong> style rather than a component
        style:
      </p>
      <code-block [code]="angularJson" title="angular.json" />
      <div class="note note--warn">
        <strong>Why global, and not <code>styleUrls</code>?</strong>
        The calendar builds its own DOM subtree, which Angular never compiles. Emulated view encapsulation
        works by stamping an attribute onto elements the compiler has seen, so scoped rules would never match
        the grid. Component styles here produce a stylesheet that applies to nothing.
      </div>

      <h2>4. Give the container a height</h2>
      <p>
        The calendar fills the height it is given and does not grow to fit its content. A container with
        <code>height: auto</code> collapses the grid to nothing, which is by a distance the most common
        integration problem.
      </p>
      <code-block [code]="heightCss" title="styles.css" />

      <h2>5. Render it</h2>
      <p>
        The vanilla form, which is what the <a routerLink="/angular">Angular wrapper</a> does for you under
        the hood:
      </p>
      <code-block [code]="vanilla" title="calendar.ts" />

      <demo-frame label="The result" [height]="480">
        <sc-calendar [config]="config" />
      </demo-frame>

      <h2>The two defaults that surprise people</h2>
      <div class="note">
        <strong>A <code>title</code> makes an event a time block, not a booking.</strong>
        The default resolver is <code>raw => raw.title?.trim() ? 'timeblock' : 'event'</code>. A booking's
        label is built from its client and service names instead. Override it with
        <code>eventTypeResolver</code> if your schema disagrees.
      </div>
      <div class="note note--danger">
        <strong>The assignee must be an object with an id.</strong>
        A flat <code>assignee_id: 'a1'</code> resolves to nothing, and the event is dropped from resource
        views without an error. Use <code>assignee: &#123; id: 'a1' &#125;</code>, or map the flat field with
        <a routerLink="/field-mapping"><code>fieldMap</code></a>.
      </div>

      <p>A booking, in the default schema:</p>
      <code-block [code]="booking" />

      <h2>What you get for free</h2>
      <p>
        <code>init()</code> renders the grid and wires every gesture: click and drag to select empty slots,
        drag events between columns and times, drag an event's lower edge to resize, touch long-press to drag
        on mobile, a live current-time indicator, business-hours shading and the toolbar with its date picker,
        view switcher, resource filter and privacy toggle.
      </p>
      <p>
        Next: <a routerLink="/angular">the Angular integration</a>, or
        <a routerLink="/configuration">every configuration option</a>.
      </p>
    </div>
  `,
})
export class GettingStartedPage {
  protected readonly config: CalendarConfig = { dataSource: demoDataSource };

  protected readonly install = `npm install steadycalendar`;

  protected readonly angularJson = `
{
  "projects": {
    "your-app": {
      "architect": {
        "build": {
          "options": {
            "styles": [
              "node_modules/steadycalendar/dist/calendar.css",
              "src/styles.css"
            ]
          }
        }
      }
    }
  }
}
`;

  protected readonly heightCss = `
/* The calendar claims the height its container gives it — and no more. */
.calendar-shell {
  height: calc(100vh - 120px);
}
`;

  protected readonly vanilla = `
import { CalendarApp } from 'steadycalendar';

const calendar = new CalendarApp({
  el: '#calendar',
  dataSource: {
    async fetchResources() {
      return {
        resources: [
          { id: 'a1', name: 'Alex Chen',  color: '#8935FF' },
          { id: 'a2', name: 'Blake Osei', color: '#007CBE' },
        ],
      };
    },
    async fetchEvents({ start, end }) {
      const res = await fetch(\`/api/bookings?from=\${start}&to=\${end}\`);
      return res.json();
    },
  },
});

await calendar.init();

// Later, when the view is torn down:
calendar.destroy();
`;

  protected readonly booking = `
{
  id: 'b1',
  date: '2026-08-11',
  start_time: '09:00',
  end_time: '09:30',
  assignee: { id: 'a1' },              // an object, not a flat id
  client:   { name: 'J. Ferreira' },
  service:  { name: 'Consultation' },
  status:   'Active',                  // 'Cancelled' strikes it through and locks it
}
`;
}
