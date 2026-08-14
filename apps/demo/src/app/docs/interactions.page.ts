import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CalendarConfig } from 'steadycalendar';
import { ScCalendarComponent } from '../calendar/sc-calendar.component';
import { CodeBlockComponent } from '../shell/code-block.component';
import { DemoFrameComponent } from '../shell/demo-frame.component';
import { EventLogComponent } from '../shell/event-log.component';
import type { EventDropDetail, EventResizeDetail, SlotSelectDetail } from '../calendar/sc-calendar.types';
import { demoDataSource } from '../data';

@Component({
  selector: 'page-interactions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScCalendarComponent, DemoFrameComponent, CodeBlockComponent, EventLogComponent, RouterLink],
  template: `
    <div class="doc-content">
      <h1>Interactions</h1>
      <p class="doc-lead">
        Drag to move, drag an edge to resize, drag across empty slots to create. Every gesture is wired by
        <code>init()</code> — there is nothing to enable — and each one asks your code for permission before
        anything is persisted.
      </p>

      <h2>Try each one</h2>
      <p>
        Rejections are simulated here: any move onto <strong>Corin Vale</strong>'s column is refused and
        reverted, which is what a real conflict check looks like from the outside.
      </p>

      <div class="split">
        <demo-frame label="Drag, resize, select" [height]="520">
          <sc-calendar
            [config]="config"
            (eventDrop)="onDrop($event)"
            (eventResize)="onResize($event)"
            (slotSelect)="onSlot($event)" />
        </demo-frame>
        <div class="log-column">
          <event-log />
        </div>
      </div>

      @if (rejected()) {
        <div class="note note--danger"><strong>Rejected</strong>{{ rejected() }}</div>
      }

      <h2>What each gesture does</h2>
      <div class="table-scroll">
        <table class="doc-table">
          <thead><tr><th>Gesture</th><th>Threshold</th><th>Emits</th><th>Notes</th></tr></thead>
          <tbody>
            <tr>
              <td>Drag an event</td><td>5 px</td><td><code>event:drop</code></td>
              <td>Moves across time, columns and dates. Snaps to the 12 px slot. <strong>Escape cancels.</strong></td>
            </tr>
            <tr>
              <td>Drag its lower edge</td><td>—</td><td><code>event:resize</code></td>
              <td>Minimum one slot. Clamped to the end of the day.</td>
            </tr>
            <tr>
              <td>Click an empty slot</td><td>—</td><td><code>slot:click</code></td>
              <td>Arrives at <code>onSlotSelect</code> with <code>endTime: null</code>.</td>
            </tr>
            <tr>
              <td>Drag across empty slots</td><td>6 px</td><td><code>slot:select</code></td>
              <td>Draws a mirror element while dragging.</td>
            </tr>
            <tr>
              <td>Click an event</td><td>—</td><td><code>event:click</code></td>
              <td>Suppressed for 300 ms after a drag or resize, so a gesture never fires a click too.</td>
            </tr>
            <tr>
              <td>Touch long-press</td><td>500 ms</td><td>as above</td>
              <td>Becomes a synthetic mousedown, with a 50 ms haptic buzz where supported.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="note">
        <strong>Handlers live on the container, not the view.</strong>
        <code>ViewManager</code> destroys and rebuilds the entire view subtree on every switch, so listeners
        bound inside it would die with it. Because they are bound once to the container, gestures survive any
        number of view changes — and <code>destroy()</code> still leaves zero document listeners behind.
      </div>

      <h2>Accepting or rejecting a move</h2>
      <p>
        Both <code>event:drop</code> and <code>event:resize</code> hand you a <code>revert()</code>. The
        element has already moved optimistically; calling it puts the element back. Do that when your write
        fails, and emit <code>data:refresh</code> when it succeeds.
      </p>
      <code-block [code]="dropHandler" />

      <h2>DragPersistencePlugin</h2>
      <p>
        The same thing packaged, with guards that run before the write and a status blocklist. Prefer it over
        hand-rolled handlers unless you need something it does not express.
      </p>
      <code-block [code]="plugin" />
      <p>
        Cancelled events are already blocked by the calendar itself, so they never reach
        <code>canDrop</code>. Without an <code>onError</code>, a throw from <code>onDrop</code> reverts
        automatically. A successful write emits <code>data:refresh</code> for you.
      </p>

      <h2>Creating from a selection</h2>
      <code-block [code]="selection" />
      <p>
        A click and a drag both arrive here; a click has <code>endTime: null</code>, so pick your own default
        duration for that case. In the non-resource views <code>resourceId</code> is <code>null</code>, since
        those views have no column identity.
      </p>

      <h2>What is not interactive</h2>
      <div class="note note--warn">
        <strong>Business hours are visual only.</strong>
        Nothing stops a drag onto a closed period, a holiday, or a resource's day off. The shading says
        "closed"; it does not enforce it. If bookings outside opening hours are invalid in your product,
        check for that in <code>canDrop</code> — see <a routerLink="/business-hours">hours and holidays</a>
        for the resolution rules to check against.
      </div>
      <div class="note note--warn">
        <strong>No keyboard equivalent.</strong>
        Every gesture on this page is pointer-only. There is no keyboard path to move, resize or create an
        event, and events are not focusable. See <a routerLink="/accessibility">accessibility</a>.
      </div>
    </div>
  `,
  styles: [
    `
      .split {
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
        gap: 1rem;
      }
      .log-column {
        margin: 1.25rem 0;
        min-height: 0;
      }
      @media (max-width: 1000px) {
        .split {
          grid-template-columns: 1fr;
        }
        .log-column {
          height: 320px;
        }
      }
    `,
  ],
})
export class InteractionsPage {
  protected readonly config: CalendarConfig = { dataSource: demoDataSource };
  protected readonly rejected = signal<string | null>(null);

  private readonly log = viewChild.required(EventLogComponent);

  /** Stands in for a real conflict check — same shape, no server. */
  private readonly blockedResource = 's3';

  protected onDrop({ event, newDate, newTime, newResourceId, revert }: EventDropDetail): void {
    if (newResourceId === this.blockedResource) {
      revert();
      this.rejected.set(` — ${event.id} cannot move to Corin Vale. The element was reverted.`);
      this.log().push('event:drop', `REJECTED ${event.id}`);
      return;
    }
    this.rejected.set(null);
    this.log().push('event:drop', `${event.id} -> ${newDate} ${newTime}`);
  }

  protected onResize({ event, newEndTime }: EventResizeDetail): void {
    this.log().push('event:resize', `${event.id} ends ${newEndTime}`);
  }

  protected onSlot({ date, startTime, endTime, resourceId }: SlotSelectDetail): void {
    this.log().push('slot:select', `${date} ${startTime}${endTime ? '-' + endTime : ''} ${resourceId ?? ''}`);
  }

  protected readonly dropHandler = `
calendar.bus.on('event:drop', async ({ event, newDate, newTime, newResourceId, revert }) => {
  try {
    await fetch(\`/api/bookings/\${event.id}\`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: newDate, start_time: newTime, assignee_id: newResourceId }),
    });
    calendar.bus.emit('data:refresh');   // clears the cache and reloads
  } catch {
    revert();                            // puts the element back
  }
});
`;

  protected readonly plugin = `
import { CalendarApp, DragPersistencePlugin } from 'steadycalendar';

new CalendarApp({
  plugins: [
    new DragPersistencePlugin({
      async onDrop(event, { date, startTime, resourceId, previousResourceId }) {
        await api.moveBooking(event.id, { date, startTime, resourceId });
      },

      async onResize(event, { endTime }) {
        await api.resizeBooking(event.id, { endTime });
      },

      // Runs before onDrop. Return false to reject without a write.
      canDrop(event, { newDate, newTime, newResourceId }) {
        return !isOutsideOpeningHours(newDate, newTime, newResourceId);
      },

      canResize(event, { newEndTime }) {
        return newEndTime <= '18:00';
      },

      // Raw sourceData.status values that may not move. Cancelled is already blocked.
      blockedStatuses: ['Completed', 'Invoiced'],

      // Without this, a throw from onDrop reverts silently.
      onError(error, event, revert) {
        revert();
        toast.error(\`Could not move \${event.clientName}\`);
      },
    }),
  ],
});
`;

  protected readonly selection = `
new CalendarApp({
  onSlotSelect({ date, startTime, endTime, resourceId }) {
    // A click gives endTime: null — choose a default length for that case.
    const end = endTime ?? addMinutes(startTime, 30);
    openBookingDialog({ date, startTime, endTime: end, resourceId });
  },
});
`;
}
