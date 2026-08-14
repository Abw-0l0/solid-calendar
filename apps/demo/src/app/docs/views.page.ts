import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { CalendarConfig, ResourceMode } from 'steadycalendar';
import { RESOURCE_MODES, VIEW_TYPES } from 'steadycalendar';
import { ScCalendarComponent } from '../calendar/sc-calendar.component';
import { CodeBlockComponent } from '../shell/code-block.component';
import { DemoFrameComponent } from '../shell/demo-frame.component';
import { demoDataSource } from '../data';

const VIEW_LABELS: Record<string, string> = {
  resourceTimeGridDay: 'Resource day',
  resourceTimeGridThreeDay: 'Resource 3-day',
  resourceTimeGridWeek: 'Resource week',
  timeGridDay: 'Day',
  timeGridThreeDay: '3-day',
  timeGridWeek: 'Week',
  dayGridMonth: 'Month',
  list: 'List',
};

const MODE_LABELS: Record<ResourceMode, string> = {
  primaryView: 'Staff',
  secondaryView: 'Rooms',
  integratedView: 'Both',
  flatView: 'By date',
};

@Component({
  selector: 'page-views',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScCalendarComponent, DemoFrameComponent, CodeBlockComponent],
  template: `
    <div class="doc-content">
      <h1>Views and resource modes</h1>
      <p class="doc-lead">
        Eight views and four resource modes, switched at runtime through state setters rather than a rebuild.
        The two interact: choosing a non-resource view while in a resource mode reconciles automatically, so
        you cannot land in a combination that renders nothing.
      </p>

      <h2>Switch between them</h2>
      <div class="switcher">
        <div class="group">
          <span class="group-label">View</span>
          <div class="pill-row">
            @for (v of viewKeys; track v) {
              <button class="btn" [class.btn--active]="view() === v" type="button" (click)="view.set(v)">
                {{ label(v) }}
              </button>
            }
          </div>
        </div>
        <div class="group">
          <span class="group-label">Resource mode</span>
          <div class="pill-row">
            @for (m of modeKeys; track m) {
              <button
                class="btn"
                [class.btn--active]="mode() === m"
                [disabled]="!isResourceView()"
                type="button"
                (click)="mode.set(m)">
                {{ modeLabel(m) }}
              </button>
            }
          </div>
        </div>
      </div>
      @if (!isResourceView()) {
        <p class="hint">Resource modes apply only to the three resource views — the others have no columns to arrange.</p>
      }

      <demo-frame [label]="label(view() ?? '')" [height]="560">
        <sc-calendar [config]="config" [(view)]="view" [(resourceMode)]="mode" />
      </demo-frame>

      <code-block [code]="switching" />

      <h2>The eight views</h2>
      <p>This table is generated from the library's own <code>VIEW_TYPES</code> constant, not transcribed.</p>
      <div class="table-scroll">
        <table class="doc-table">
          <thead>
            <tr><th>Key</th><th>Duration</th><th>Resource columns</th><th>Renderer</th></tr>
          </thead>
          <tbody>
            @for (v of viewKeys; track v) {
              <tr>
                <td><code>{{ v }}</code></td>
                <td>{{ viewTypes[v].duration }}</td>
                <td>{{ viewTypes[v].isResource ? 'yes' : 'no' }}</td>
                <td><code>{{ renderer(v) }}</code></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p>
        <code>resourceTimeGridDay</code> is the default. There is no agenda view; <code>list</code> is the
        closest equivalent, covering seven days.
      </p>

      <h2>The four resource modes</h2>
      <div class="table-scroll">
        <table class="doc-table">
          <thead>
            <tr><th>Mode</th><th>Column set</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>primaryView</code></td><td>one per person</td>
              <td>The default. Only primary resources are filterable.</td>
            </tr>
            <tr>
              <td><code>secondaryView</code></td><td>one per room</td>
              <td>Secondary resources only. They are exempt from the resource filter.</td>
            </tr>
            <tr>
              <td><code>integratedView</code></td><td>both tiers</td>
              <td>People and rooms side by side. A booking occupying both appears in each.</td>
            </tr>
            <tr>
              <td><code>flatView</code></td><td>one per date</td>
              <td>Columns become dates, not resources. Multi-owner time blocks collapse to one row.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="note">
        <strong>Secondary resource ids are prefixed.</strong>
        The library rewrites them to <code>secondary-&lt;id&gt;</code> internally so they cannot collide with a
        primary id. If you match on ids in a drop handler, expect that prefix.
      </div>

      <h2>Grid geometry</h2>
      <p>
        The time grids are built from fixed constants rather than configuration:
        <code>SLOT_INTERVAL</code> is 10 minutes, drawn at <code>SLOT_HEIGHT</code> 12 px, labelled every
        <code>LABEL_INTERVAL</code> 30 minutes, across a full 24-hour day. An event is never shorter than
        <code>MIN_EVENT_HEIGHT</code> 20 px however brief it is.
      </p>
      <p>
        Slot height is also exposed as the <code>--sc-slot-height</code> custom property, so a denser or
        roomier grid is a theming change rather than a configuration one.
      </p>
      <code-block [code]="constants" />

      <h2>Navigation</h2>
      <p>
        There is no <code>next()</code> or <code>prev()</code> method — navigation is a state assignment, and
        the toolbar's own buttons do exactly this internally. Prev and next step by the view's duration, or by
        a whole month in <code>dayGridMonth</code>.
      </p>
      <code-block [code]="navigation" />
      <div class="note note--warn">
        <strong>No minimum or maximum date.</strong>
        The library has no date-range restriction, so nothing stops a user paging to 1970. If your product
        needs bounds, clamp in your own handler for <code>date:changed</code> and set the date back.
      </div>
    </div>
  `,
  styles: [
    `
      .switcher {
        display: flex;
        flex-wrap: wrap;
        gap: 1.5rem;
        padding: 0.85rem 1rem 0.35rem;
        border: 1px solid var(--sc-border-light);
        border-radius: var(--doc-radius);
        background: var(--sc-bg-alt);
      }
      .group-label {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--sc-text-muted);
      }
      .pill-row {
        margin: 0.35rem 0 0.5rem;
      }
      .btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .hint {
        font-size: 0.85rem;
        color: var(--sc-text-secondary);
        margin-top: 0.6rem;
      }
    `,
  ],
})
export class ViewsPage {
  protected readonly config: CalendarConfig = { dataSource: demoDataSource };

  protected readonly view = signal<string | undefined>('resourceTimeGridDay');
  protected readonly mode = signal<ResourceMode | undefined>('primaryView');

  protected readonly viewTypes = VIEW_TYPES;
  protected readonly viewKeys = Object.keys(VIEW_TYPES);
  protected readonly modeKeys = Object.keys(RESOURCE_MODES) as ResourceMode[];

  protected label(key: string): string {
    return VIEW_LABELS[key] ?? key;
  }

  protected modeLabel(key: ResourceMode): string {
    return MODE_LABELS[key] ?? key;
  }

  protected isResourceView(): boolean {
    const v = this.view();
    return !!v && !!VIEW_TYPES[v]?.isResource;
  }

  protected renderer(key: string): string {
    if (VIEW_TYPES[key]?.isResource) return 'ResourceTimeGridView';
    if (key === 'dayGridMonth') return 'MonthView';
    if (key === 'list') return 'ListView';
    return 'SimpleTimeGridView';
  }

  protected readonly switching = `
// Cheap: a setter triggers a refetch and re-render, not a rebuild.
calendar.state.setCurrentView('dayGridMonth');
calendar.state.setCurrentResourceMode('integratedView');

// Through the Angular wrapper, the same thing as a two-way binding:
// <sc-calendar [config]="config" [(view)]="view" [(resourceMode)]="mode" />
`;

  protected readonly constants = `
import { SLOT_INTERVAL, SLOT_HEIGHT, LABEL_INTERVAL, MIN_EVENT_HEIGHT } from 'steadycalendar';

SLOT_INTERVAL     // 10  — minutes per slot
SLOT_HEIGHT       // 12  — px per slot
LABEL_INTERVAL    // 30  — minutes between time-axis labels
MIN_EVENT_HEIGHT  // 20  — px floor, so a 10-minute booking stays legible
`;

  protected readonly navigation = `
import { temporal } from 'steadycalendar';

// Jump to a date.
calendar.state.setCurrentDate('2026-08-20');

// Step forward a week, using the library's own date maths rather than new Date(),
// which is unsafe in zones that shift at midnight.
const next = temporal.addDaysToString(calendar.state.currentDate, 7);
calendar.state.setCurrentDate(next);

// The visible range, recomputed whenever the date or view changes.
const { start, end } = calendar.state.dateRange;
`;
}
