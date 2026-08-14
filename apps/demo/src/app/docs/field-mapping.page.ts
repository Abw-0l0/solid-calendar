import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import type { CalendarConfig } from 'steadycalendar';
import { HEALTHCARE_FIELD_MAP } from 'steadycalendar';
import { ScCalendarComponent } from '../calendar/sc-calendar.component';
import { CodeBlockComponent } from '../shell/code-block.component';
import { DemoFrameComponent } from '../shell/demo-frame.component';
import {
  HEALTHCARE_APPOINTMENTS,
  HEALTHCARE_DATA,
  WORKSHOP_DATA,
  WORKSHOP_FIELD_MAP,
  WORKSHOP_JOBS,
  demoDataSource,
  workshopStatusResolver,
} from '../data';

type Schema = 'default' | 'workshop' | 'healthcare';

@Component({
  selector: 'page-field-mapping',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScCalendarComponent, DemoFrameComponent, CodeBlockComponent],
  template: `
    <div class="doc-content">
      <h1>Field mapping</h1>
      <p class="doc-lead">
        The library reads your data in exactly two places, through a declared map. If your API names things
        differently, say so once instead of reshaping every response.
      </p>

      <h2>Three payloads, one calendar</h2>
      <p>
        These three datasets share almost no field names. Nothing is transformed before it reaches the
        calendar — only the <code>fieldMap</code> differs.
      </p>

      <div class="pill-row">
        <button class="btn" [class.btn--active]="schema() === 'default'" type="button" (click)="schema.set('default')">
          Default names
        </button>
        <button class="btn" [class.btn--active]="schema() === 'workshop'" type="button" (click)="schema.set('workshop')">
          Vehicle workshop
        </button>
        <button class="btn" [class.btn--active]="schema() === 'healthcare'" type="button" (click)="schema.set('healthcare')">
          Clinic (built-in preset)
        </button>
      </div>

      <demo-frame [label]="frameLabel()" [height]="460">
        <sc-calendar [config]="config()" />
      </demo-frame>

      <code-block [code]="payloadSample()" title="the payload" />
      <code-block [code]="mapSample()" title="the map that reads it" />

      <h2>What a field spec can be</h2>
      <p>A value is a name, an ordered list of candidates, or a function. Names may be dotted paths.</p>
      <code-block [code]="specs" />
      <p>
        The first candidate resolving to a non-nullish value wins — and empty string and zero
        <em>are</em> hits, so a field explicitly set to <code>''</code> stops the search rather than falling
        through to the next candidate.
      </p>

      <div class="note note--warn">
        <strong>Your entry replaces the default list; it does not extend it.</strong>
        Mapping <code>owner: 'assignedTo'</code> means the calendar stops looking for
        <code>assignee</code> and <code>owner</code> entirely. Spread the defaults back in if you need both —
        useful when migrating a schema gradually.
      </div>
      <code-block [code]="extend" />

      <h2>The entities and their keys</h2>
      <div class="table-scroll">
        <table class="doc-table">
          <thead><tr><th>Entity</th><th>Keys</th><th>Defaults look for</th></tr></thead>
          <tbody>
            <tr>
              <td><code>dataset</code></td>
              <td>resources, secondaryResources, businessHours, businessOverrides, holidaySettings, publicHolidays</td>
              <td><code>resources</code> also matches <code>assignees</code></td>
            </tr>
            <tr>
              <td><code>event</code></td>
              <td>id, date, startTime, endTime, title, owner, owners, client, service, secondaryResources, groupId</td>
              <td><code>start_time</code> or <code>startTime</code>; <code>assignee</code> or <code>owner</code></td>
            </tr>
            <tr>
              <td><code>resource</code></td>
              <td>id, name, color, closedDays, order, schedules, overrides, systemFlag</td>
              <td><code>closedDays</code> or <code>closed_days</code>; <code>isSystemResource</code></td>
            </tr>
            <tr><td><code>secondaryResource</code></td><td>id, name, color, order</td><td>as above, minus scheduling</td></tr>
            <tr><td><code>client</code></td><td>name</td><td><code>name</code> or <code>full_name</code></td></tr>
            <tr><td><code>service</code></td><td>name</td><td><code>name</code> or <code>title</code></td></tr>
          </tbody>
        </table>
      </div>

      <h2>The healthcare preset</h2>
      <p>
        <code>HEALTHCARE_FIELD_MAP</code> ships with the library for payloads using healthcare vocabulary —
        <code>therapists</code>, <code>patient</code>, <code>menu</code>, <code>booking_color</code>. An
        existing integration on that schema migrates in one line.
      </p>
      <code-block [code]="healthcarePreset" />

      <h2>When nothing resolves</h2>
      <p>
        A payload whose collections are named something the map does not look for would otherwise yield an
        empty calendar and no error at all. Instead the library names both sides in the console, which turns a
        long afternoon into a one-line diagnosis:
      </p>
      <code-block [code]="diagnostic" title="console" />
      <p>
        Note it only warns when the payload contains arrays it did not recognise. A genuinely empty response
        stays quiet, as it should.
      </p>

      <div class="note">
        <strong>Why only two places?</strong>
        Raw field names are read in <code>EventMapper</code> and <code>CalendarApp._buildResources</code>, and a
        test enforces that no renderer references one. That boundary exists because it was once broken: the
        resource filter silently stopped filtering and two list columns went permanently blank when raw-shape
        knowledge leaked out of the mapper.
      </div>
    </div>
  `,
})
export class FieldMappingPage {
  protected readonly schema = signal<Schema>('default');

  protected readonly config = computed<CalendarConfig>(() => {
    switch (this.schema()) {
      case 'workshop':
        return {
          dataSource: {
            fetchResources: async () => WORKSHOP_DATA,
            fetchEvents: async () => WORKSHOP_JOBS,
          },
          fieldMap: WORKSHOP_FIELD_MAP,
          statusResolver: workshopStatusResolver,
          translations: { schedule: 'Workshop', resources: 'Mechanics', resourceDisplay: 'Mechanics' },
        };
      case 'healthcare':
        return {
          dataSource: {
            fetchResources: async () => HEALTHCARE_DATA,
            fetchEvents: async () => HEALTHCARE_APPOINTMENTS,
          },
          fieldMap: HEALTHCARE_FIELD_MAP,
          translations: { schedule: 'Clinic', resources: 'Therapists', resourceDisplay: 'Therapists' },
        };
      default:
        return { dataSource: demoDataSource };
    }
  });

  protected readonly frameLabel = computed(() =>
    ({
      default: 'Default field names — no fieldMap at all',
      workshop: 'A schema sharing no names with the defaults',
      healthcare: 'HEALTHCARE_FIELD_MAP, unmodified',
    })[this.schema()],
  );

  protected readonly payloadSample = computed(() => SAMPLES[this.schema()].payload);
  protected readonly mapSample = computed(() => SAMPLES[this.schema()].map);

  protected readonly specs = `
new CalendarApp({
  fieldMap: {
    event: {
      id: 'ref',                              // a name
      owner: ['assignedTo', 'assignee'],      // ordered candidates, first non-null wins
      client: 'booker.person',                // a dotted path
      startTime: (raw) => raw.window?.[0],    // a function, for anything else
    },
  },
});
`;

  protected readonly extend = `
import { DEFAULT_FIELD_MAP } from 'steadycalendar';

// Replaces the default list — 'assignee' and 'owner' are no longer looked for.
event: { owner: 'assignedTo' }

// Extends it — the new name is tried first, then the defaults.
event: { owner: ['assignedTo', ...DEFAULT_FIELD_MAP.event.owner] }
`;

  protected readonly healthcarePreset = `
import { CalendarApp, HEALTHCARE_FIELD_MAP } from 'steadycalendar';

new CalendarApp({ fieldMap: HEALTHCARE_FIELD_MAP, dataSource });

// It reads: therapists / staff / assignees, patient / client / attendee,
// menu / service, booking_color / color, set_menu_id / groupId / group_id,
// full_name / name, is_system_staff.
//
// Layer your own on top by spreading it:
// fieldMap: { ...HEALTHCARE_FIELD_MAP, event: { ...HEALTHCARE_FIELD_MAP.event, id: 'uid' } }
`;

  protected readonly diagnostic = `
[SteadyCalendar:CalendarApp] No resources resolved. Looked for resources, assignees,
secondaryResources; the payload has crew, bays. Set config.fieldMap.dataset to map them.
`;
}

const SAMPLES: Record<Schema, { payload: string; map: string }> = {
  default: {
    payload: `
// Field names already match DEFAULT_FIELD_MAP.
{
  resources: [{ id: 's1', name: 'Alex Chen', color: '#8935FF' }],
  secondaryResources: [{ id: 'r1', name: 'Room A' }],
}

{
  id: 'bk-1', date: '2026-08-15', start_time: '09:00', end_time: '09:30',
  assignee: { id: 's1' }, client: { name: 'J. Ferreira' },
  service: { name: 'Follow-up' }, status: 'Active',
}
`,
    map: `
// No fieldMap needed. This is the whole configuration.
new CalendarApp({ dataSource });
`,
  },
  workshop: {
    payload: `
// Not one name overlaps with the defaults, and the customer is two levels deep.
{
  crew: [{ code: 'm1', displayName: 'Ines Duarte', swatch: '#2B6CB0', rank: 1 }],
  bays: [{ code: 'b1', displayName: 'Lift 1', swatch: '#4A5568', rank: 1 }],
  openingTimes: [{ day_of_week: 'Monday', start_time: '08:00', end_time: '17:00' }],
}

{
  ref: 'j-1', on: '2026-08-15', from: '08:30', to: '10:00',
  assignedTo: { code: 'm1' },
  booker: { person: { label: 'Halvorsen Haulage' } },
  job: { label: 'Brake overhaul' },
  state: 'confirmed',
}
`,
    map: `
new CalendarApp({
  fieldMap: {
    dataset: { resources: 'crew', secondaryResources: 'bays', businessHours: 'openingTimes' },
    event: {
      id: 'ref', date: 'on', startTime: 'from', endTime: 'to', title: 'label',
      owner: 'assignedTo',
      client: 'booker.person',   // dotted path
      service: 'job',
    },
    resource: { id: 'code', name: 'displayName', color: 'swatch', order: 'rank' },
    secondaryResource: { id: 'code', name: 'displayName', color: 'swatch', order: 'rank' },
    client: { name: 'label' },
    service: { name: 'label' },
  },

  // This schema says 'void', not 'Cancelled', so the default resolver needs replacing.
  statusResolver: (raw) => ({ cancelled: raw.state === 'void' }),
});
`,
  },
  healthcare: {
    payload: `
{
  therapists: [{ id: 'p1', full_name: 'Dr. Amara Nwosu', booking_color: '#6B46C1' }],
  equipment:  [{ id: 'e1', name: 'Ultrasound', color: '#4299E1' }],
  facilityBusinessHours: [{ day_of_week: 'Monday', start_time: '08:00', end_time: '17:00' }],
}

{
  id: 'a-1', date: '2026-08-15', start_time: '09:00', end_time: '09:45',
  therapist: { id: 'p1' }, patient: { full_name: 'E. Bergqvist' },
  menu: { name: 'Physiotherapy' }, set_menu_id: 'course-7', status: 'Active',
}
`,
    map: `
import { HEALTHCARE_FIELD_MAP } from 'steadycalendar';

// One line. The preset already knows this vocabulary.
new CalendarApp({ fieldMap: HEALTHCARE_FIELD_MAP, dataSource });
`,
  },
};
