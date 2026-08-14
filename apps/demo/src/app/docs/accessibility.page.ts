import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CalendarConfig } from 'steadycalendar';
import { ScCalendarComponent } from '../calendar/sc-calendar.component';
import { CodeBlockComponent } from '../shell/code-block.component';
import { DemoFrameComponent } from '../shell/demo-frame.component';
import { demoDataSource } from '../data';

@Component({
  selector: 'page-accessibility',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScCalendarComponent, DemoFrameComponent, CodeBlockComponent, RouterLink],
  template: `
    <div class="doc-content">
      <h1>Accessibility</h1>

      <div class="note note--danger headline">
        <strong>SteadyCalendar is pointer-driven today.</strong>
        A keyboard user cannot focus, read, move, resize or create an event. If keyboard access is a
        requirement for you, this library is not ready — and this page exists so you find that out here rather
        than after integrating it.
      </div>

      <p class="doc-lead">
        This is a stated gap, not an oversight, and not a claim of partial conformance. There is no WCAG
        conformance claim of any level.
      </p>

      <h2>Check it yourself</h2>
      <p>
        Click into the calendar below and press <kbd>Tab</kbd> repeatedly. You will reach every toolbar
        control — today, previous, next, the two dropdowns, the resource filter, the privacy toggle, print and
        add — and then leave the component entirely. Focus never enters the grid.
      </p>

      <demo-frame label="Tab through it" [height]="480">
        <sc-calendar [config]="config" />
      </demo-frame>

      <h2>What works</h2>
      <ul class="list">
        <li>
          <strong>Toolbar controls are reachable.</strong> All of them are native <code>&lt;button&gt;</code>
          elements, so they are in the tab order and activate with <kbd>Enter</kbd> and <kbd>Space</kbd>.
        </li>
        <li>
          <strong>ARIA roles and state on the toolbar.</strong> Dropdowns carry <code>role="listbox"</code>
          with <code>role="option"</code> and <code>aria-selected</code>; triggers carry
          <code>aria-haspopup</code> and <code>aria-expanded</code>, kept in sync. The privacy toggle carries
          <code>aria-pressed</code>. The toolbar itself carries <code>role="toolbar"</code> and a label.
        </li>
        <li><strong>The date title announces changes</strong> through <code>aria-live="polite"</code>.</li>
        <li>
          <strong>Every user-visible string is translatable</strong>, so accessible names follow
          <a routerLink="/i18n"><code>config.translations</code></a> rather than being frozen in English.
        </li>
      </ul>

      <h2>What does not</h2>
      <div class="table-scroll">
        <table class="doc-table">
          <thead><tr><th>Gap</th><th>Effect</th></tr></thead>
          <tbody>
            <tr><td>Events have no <code>tabindex</code></td><td>Cannot be focused. The entire grid is unreachable by keyboard.</td></tr>
            <tr><td>Events have no <code>role</code> or accessible name</td><td>A screen reader announces nothing meaningful, even if focus could reach them.</td></tr>
            <tr><td>No <code>:focus</code> or <code>:focus-visible</code> styles anywhere in the stylesheet</td><td>Even where focus lands, it is invisible.</td></tr>
            <tr><td>Drag, resize and slot selection are pointer and touch only</td><td>No keyboard path to move, resize or create a booking. The only key handler in the codebase is Escape-to-cancel an in-flight drag.</td></tr>
            <tr><td>Dropdowns have no arrow-key navigation</td><td>The <code>role="listbox"</code> markup is declarative only; a screen reader announces a listbox that cannot be operated. There is no <code>aria-activedescendant</code>.</td></tr>
            <tr><td>No focus management on open or close</td><td>Opening a dropdown or the date picker does not move focus, and closing does not restore it. The date picker declares <code>aria-haspopup="dialog"</code> with no focus trap.</td></tr>
            <tr><td>The grid has no table or grid semantics</td><td>No <code>role="grid"</code>, <code>columnheader</code> or <code>gridcell</code>; no text alternative for business-hours shading, closed days or the current-time indicator.</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Already handled</h2>
      <p>Two things worth noting, because they are common failures elsewhere:</p>
      <ul class="list">
        <li>
          <strong>Colour is configurable, not fixed.</strong> Resource colours come from your data, so contrast
          is under your control. <code>ColorUtils.getContrastTextColor</code> is exported and used for label
          contrast.
        </li>
        <li>
          <strong>No motion.</strong> There are no animations or transitions that would need a
          <code>prefers-reduced-motion</code> guard.
        </li>
      </ul>
      <code-block [code]="contrast" />

      <h2>The roadmap</h2>
      <p>
        Sequenced so each step is independently useful. None of it is scheduled; each item is a reasonable
        first pull request.
      </p>
      <ol class="list">
        <li><strong>Make events focusable and named.</strong> <code>tabindex="0"</code>, a role, and a name composed from the same normalised fields the card already renders. Enter and Space fire the existing <code>event:click</code> path.</li>
        <li><strong>Focus styles.</strong> <code>:focus-visible</code> rules for events, slots and toolbar controls.</li>
        <li><strong>Operable dropdowns.</strong> Arrow keys, <code>aria-activedescendant</code>, focus moved on open and restored on close, Escape to dismiss, and a focus trap for the date picker.</li>
        <li><strong>Grid semantics.</strong> Roles and headers on the column structure, plus text alternatives for the states that are currently colour-only.</li>
        <li><strong>A keyboard model for moving and resizing.</strong> The largest piece, and it needs a design before code — something like Enter to grab, arrows to move by slot or column, Enter to drop, Escape to cancel, with live-region announcements as the position changes.</li>
      </ol>

      <h2>What you can do in the meantime</h2>
      <p>
        The gap is in the grid, not in the data. Everything the calendar knows is available through
        <a routerLink="/headless">headless mode</a> and the state getters, so a keyboard-operable and
        screen-reader-friendly alternative view is a reasonable thing to build alongside it — a list of the
        day's bookings, rendered by your own framework, with your own controls.
      </p>
      <code-block [code]="alternative" title="an accessible alternative view" />
      <p>
        The <a routerLink="/views">list view</a> is closer to that shape than the grid is, but note it is
        rendered by the library and carries the same gaps — it is not a keyboard-accessible fallback.
      </p>

      <h2>Reporting</h2>
      <p>
        Accessibility issues are ordinary bugs. If you have tested with a screen reader and can describe what
        was announced, include that detail — it is hard to reconstruct second-hand.
      </p>
    </div>
  `,
  styles: [
    `
      .headline {
        margin-top: 0;
      }
      .list {
        padding-left: 1.25rem;
        margin: 0 0 1.25rem;
      }
      .list li {
        margin-bottom: 0.5rem;
      }
      kbd {
        font-family: var(--doc-mono);
        font-size: 0.78em;
        padding: 0.05em 0.35em;
        border: 1px solid var(--sc-border);
        border-bottom-width: 2px;
        border-radius: 4px;
        background: var(--sc-bg-alt);
      }
    `,
  ],
})
export class AccessibilityPage {
  protected readonly config: CalendarConfig = { dataSource: demoDataSource };

  protected readonly contrast = `
import { ColorUtils } from 'steadycalendar';

// Used internally for card labels, and exported so you can check your own palette.
ColorUtils.getContrastTextColor('#8935FF');   // '#FFFFFF'
ColorUtils.getContrastTextColor('#F6E05E');   // '#000000'
`;

  protected readonly alternative = `
// The same data the grid draws, with none of its markup — so you can render a
// keyboard-operable view beside the calendar rather than instead of it.
calendar.bus.on('events:loaded', ({ events }) => {
  this.agenda.set(
    events
      .filter((e) => !e.isCancelled)
      .map((e) => ({
        id: e.id,
        label: \`\${e.startTime}–\${e.endTime}, \${e.clientName}, \${e.serviceName}\`,
        resource: e.resourceOwnerName,
      })),
  );
});
`;
}
