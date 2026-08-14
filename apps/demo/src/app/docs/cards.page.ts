import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import type { CalendarConfig } from 'steadycalendar';
import { ScCalendarComponent } from '../calendar/sc-calendar.component';
import { CodeBlockComponent } from '../shell/code-block.component';
import { DemoFrameComponent } from '../shell/demo-frame.component';
import { demoDataSource } from '../data';

@Component({
  selector: 'page-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScCalendarComponent, DemoFrameComponent, CodeBlockComponent],
  template: `
    <div class="doc-content">
      <h1>Card content and privacy</h1>
      <p class="doc-lead">
        What appears on a booking card is yours to decide: which lines, in what order, with which badges, and
        which of them blur when privacy mode is on. It takes two settings that have to agree with each other,
        which is the part worth reading carefully.
      </p>

      <h2>Live</h2>
      <div class="controls">
        <label class="checkbox">
          <input type="checkbox" [checked]="custom()" (change)="custom.set($any($event.target).checked)" />
          Custom card fields
        </label>
        <label class="checkbox">
          <input type="checkbox" [checked]="badges()" (change)="badges.set($any($event.target).checked)" />
          Badges
        </label>
        <label class="checkbox">
          <input type="checkbox" [checked]="privacy()" (change)="privacy.set($any($event.target).checked)" />
          Privacy mode
        </label>
      </div>

      <demo-frame [label]="custom() ? 'Custom fields' : 'Default card layout'" [height]="500">
        <sc-calendar [config]="config()" [privacyMode]="privacy()" />
      </demo-frame>

      <p>
        With privacy on, the client name blurs but the service and time do not — that split is
        <code>privacySuppression</code>, and it is per field id rather than all-or-nothing.
      </p>

      <h2>Without settings: the default card</h2>
      <p>
        Supply no <code>cardDisplaySettings</code> and each card shows title, time and service. For a booking
        the title is built from the client and service names; for a time block it is the
        <code>title</code> field.
      </p>
      <div class="note">
        <strong>Time blocks ignore all of this.</strong>
        A time block renders its title and time and returns early — custom fields and badges never apply to
        one. If you need richer time blocks, they have to be bookings with a different
        <code>eventTypeResolver</code>.
      </div>

      <h2>Custom fields</h2>
      <p>Two pieces have to line up, and neither works alone:</p>
      <ol>
        <li><code>cardDisplaySettings.textItems</code> declares which ids to show, in what order.</li>
        <li><code>callbacks.resolveEventFields</code> supplies the values for those ids, per event.</li>
      </ol>
      <code-block [code]="textFields" />
      <p>
        <code>'time'</code> is the one reserved id: it renders the formatted time range rather than reading
        <code>textFields</code>. Everything else is looked up in the object your callback returned, and any id
        resolving to empty string is skipped entirely — so a card never shows a blank line.
      </p>
      <p>
        The first visible field with a value gets <code>.sc-event-title</code> whatever it is called; the rest
        get <code>.sc-event-field--&lt;id&gt;</code>, which is your styling hook.
      </p>

      <h2>Badges</h2>
      <div class="note note--danger">
        <strong>The shipped type declaration for <code>Badge</code> does not match what the renderer reads.</strong>
        <code>types/core.d.ts</code> declares <code>&#123; id, style, bgColor, textColor, text &#125;</code>,
        but <code>EventContentBuilder</code> reads <code>typeId</code>, <code>label</code>,
        <code>tooltip</code>, <code>count</code> and <code>meta</code>, taking every visual property from
        <code>config.badgeTypes</code> instead. A badge authored against the declaration typechecks and then
        renders nothing. Verified against 0.5.0 — the working shape is below.
      </div>

      <p>Three things must agree for a badge to appear:</p>
      <ol>
        <li>The event carries a badge whose <code>typeId</code> matches a <code>badgeItems</code> entry's <code>id</code>.</li>
        <li>That <code>badgeItems</code> entry has <code>visible: true</code>.</li>
        <li><code>config.badgeTypes</code> has an entry under that same id — no entry, no badge, silently.</li>
      </ol>
      <code-block [code]="badgeExample" />

      <div class="table-scroll">
        <table class="doc-table">
          <thead><tr><th>Comes from</th><th>Property</th><th>Effect</th></tr></thead>
          <tbody>
            <tr><td rowspan="4">the badge on the event</td><td><code>typeId</code></td><td>Matches it to a <code>badgeItems</code> id. Required.</td></tr>
            <tr><td><code>label</code></td><td>The text.</td></tr>
            <tr><td><code>count</code></td><td>Appended in parentheses.</td></tr>
            <tr><td><code>tooltip</code></td><td>Becomes the <code>title</code> attribute.</td></tr>
            <tr><td rowspan="5"><code>config.badgeTypes[id]</code></td><td><code>style</code></td><td>Class suffix; defaults to <code>filled</code>.</td></tr>
            <tr><td><code>bgColor</code> / <code>textColor</code> / <code>borderColor</code></td><td>Inline colours.</td></tr>
            <tr><td><code>maxWidth</code></td><td>Pixel cap on width.</td></tr>
            <tr><td><code>createIcon()</code></td><td>Returns a node prepended inside the badge.</td></tr>
            <tr><td><code>createSecondaryIcon()</code></td><td>Used when the badge sets <code>meta.showSecondaryIcon</code>.</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Privacy mode</h2>
      <p>
        Privacy mode adds <code>.sc-privacy-blur</code> to the fields and badges you nominate. It is a display
        state, not a security control — the values are still in the DOM, and the class is a CSS blur. It is
        meant for a screen in a public-facing reception area, not for withholding data from the user.
      </p>
      <code-block [code]="privacyConfig" />
      <p>
        Toggle it from the toolbar, through <code>state.setPrivacyMode(true)</code>, or with the wrapper's
        <code>[(privacyMode)]</code> binding. It persists as a user preference when preferences are wired up.
      </p>

      <h2>Styling hooks</h2>
      <code-block [code]="cssHooks" title="your stylesheet" />
    </div>
  `,
  styles: [
    `
      .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem 1.5rem;
        padding: 0.85rem 1rem;
        border: 1px solid var(--sc-border-light);
        border-radius: var(--doc-radius);
        background: var(--sc-bg-alt);
      }
      .controls .checkbox {
        margin: 0;
      }
      ol {
        margin: 0 0 1rem;
        padding-left: 1.25rem;
      }
      ol li {
        margin-bottom: 0.3rem;
      }
    `,
  ],
})
export class CardsPage {
  protected readonly custom = signal(true);
  protected readonly badges = signal(true);
  protected readonly privacy = signal(false);

  protected readonly config = computed<CalendarConfig>(() => {
    if (!this.custom()) return { dataSource: demoDataSource };

    const withBadges = this.badges();

    return {
      dataSource: demoDataSource,

      cardDisplaySettings: {
        textItems: [
          { id: 'client', name: 'Client', visible: true, order: 1 },
          { id: 'time', name: 'Time', visible: true, order: 2 },
          { id: 'service', name: 'Service', visible: true, order: 3 },
          { id: 'reference', name: 'Reference', visible: true, order: 4 },
        ],
        // Declared as required even though the renderer guards for its absence, so an
        // empty array rather than a conditional spread.
        badgeItems: withBadges ? [{ id: 'status', name: 'Status', visible: true, order: 1 }] : [],
      },

      ...(withBadges
        ? {
            badgeTypes: {
              status: { style: 'filled', bgColor: '#1f2937', textColor: '#f9fafb', maxWidth: 90 },
            },
          }
        : {}),

      privacySuppression: { textFieldIds: ['client'], badgeIds: [] },

      callbacks: {
        resolveEventFields: (raw: any, mapped: any) => ({
          textFields: {
            client: mapped?.clientName ?? '',
            service: mapped?.serviceName ?? '',
            reference: String(raw?.id ?? '').slice(-6).toUpperCase(),
          },
          ...(withBadges && raw?.status === 'Completed'
            ? { badges: [{ typeId: 'status', label: 'Done', tooltip: 'Marked complete' } as any] }
            : {}),
        }),
      },
    };
  });

  protected readonly textFields = `
new CalendarApp({
  // 1. Which lines a card shows, and in what order.
  cardDisplaySettings: {
    textItems: [
      { id: 'client',    name: 'Client',    visible: true, order: 1 },
      { id: 'time',      name: 'Time',      visible: true, order: 2 },  // reserved id
      { id: 'service',   name: 'Service',   visible: true, order: 3 },
      { id: 'reference', name: 'Reference', visible: true, order: 4 },
    ],
  },

  callbacks: {
    // 2. The values for those ids, per event. \`raw\` is your untouched record;
    //    \`mapped\` is the normalised one, so prefer its projections where they exist.
    resolveEventFields: (raw, mapped) => ({
      textFields: {
        client: mapped.clientName,
        service: mapped.serviceName,
        reference: raw.reference_code ?? '',   // '' is skipped, not rendered blank
      },
    }),
  },
});
`;

  protected readonly badgeExample = `
new CalendarApp({
  // (1) and (2): declare the badge slot.
  cardDisplaySettings: {
    textItems: [ /* ... */ ],
    badgeItems: [{ id: 'status', name: 'Status', visible: true, order: 1 }],
  },

  // (3) Without this entry the badge is skipped, with no warning.
  badgeTypes: {
    status: {
      style: 'filled',          // -> .sc-event-badge--filled
      bgColor: '#1f2937',
      textColor: '#f9fafb',
      maxWidth: 90,
      createIcon: () => {
        const dot = document.createElement('span');
        dot.className = 'my-badge-dot';
        return dot;
      },
    },
  },

  callbacks: {
    resolveEventFields: (raw) => ({
      badges: raw.status === 'Completed'
        // typeId — NOT id, whatever the .d.ts says.
        ? [{ typeId: 'status', label: 'Done', count: undefined, tooltip: 'Marked complete' }]
        : [],
    }),
  },
});
`;

  protected readonly privacyConfig = `
new CalendarApp({
  privacySuppression: {
    textFieldIds: ['client', 'reference'],  // blurred when privacy is on
    badgeIds: ['status'],
  },
});

calendar.state.setPrivacyMode(true);
`;

  protected readonly cssHooks = `
/* Cards */
.sc-event { }
.sc-event--cancelled { }        /* struck through; not draggable */
.sc-event--timeblock { }        /* a break or maintenance window */
.sc-event--secondary { }        /* rendered in a secondary-resource column */
.sc-event--group { }            /* shares a groupId with another event */

/* Card content */
.sc-event-title { }             /* the first visible field, whatever its id */
.sc-event-time { }
.sc-event-field--reference { }  /* .sc-event-field--<id> for the rest */
.sc-event-badges { }
.sc-event-badge--filled { }

/* Privacy */
.sc-privacy-blur { filter: blur(4px); }
`;
}
