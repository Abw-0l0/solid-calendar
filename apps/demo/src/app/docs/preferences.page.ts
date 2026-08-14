import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { CalendarConfig, CalendarPreferences, PreferencesAdapter } from 'steadycalendar';
import { ScCalendarComponent } from '../calendar/sc-calendar.component';
import { CodeBlockComponent } from '../shell/code-block.component';
import { DemoFrameComponent } from '../shell/demo-frame.component';
import { demoDataSource } from '../data';

const KEY = 'steadycalendar-demo-prefs';

@Component({
  selector: 'page-preferences',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScCalendarComponent, DemoFrameComponent, CodeBlockComponent],
  template: `
    <div class="doc-content">
      <h1>Preferences</h1>
      <p class="doc-lead">
        The calendar can remember where a user left off — which view, which date, which resource mode, which
        columns were filtered in. You supply the storage; it decides when to write.
      </p>

      <h2>Live, backed by localStorage</h2>
      <p>
        Change the view, filter some resources, then reload this page. It comes back as you left it. The saved
        payload is shown underneath, updating as it is written.
      </p>

      <demo-frame label="Preferences persisted to localStorage" [height]="500">
        <sc-calendar [config]="config" />
      </demo-frame>

      <div class="pill-row">
        <button class="btn" type="button" (click)="clear()">Clear stored preferences</button>
        <span class="hint">writes: <code>{{ writes() }}</code></span>
      </div>
      <code-block [code]="stored()" title="localStorage — steadycalendar-demo-prefs" />

      <h2>The adapter</h2>
      <code-block [code]="adapter" />
      <div class="note note--warn">
        <strong><code>contextId</code> is required.</strong>
        Without it the preferences bridge does nothing at all — no fetch, no save, no warning. It is the
        identity the preferences belong to, so it is usually a user id, or a user and location pair.
      </div>

      <h2>The shape</h2>
      <code-block [code]="shape" />
      <p>
        Restored values are validated: an unknown <code>viewType</code> or <code>resourceMode</code> is
        rejected rather than applied, so a stored preference left over from a removed view cannot break the
        calendar. The two are then reconciled — a non-resource view stored alongside a resource mode resolves
        to a coherent pair.
      </p>

      <h2>When it saves</h2>
      <p>
        Saves are debounced by one second (<code>PREFERENCE_SAVE_DELAY</code>) and triggered by
        <code>date:changed</code>, <code>view:changed</code>, <code>resource:changed</code> and
        <code>filter:changed</code>. Dragging across a week therefore produces one write, not seven.
      </p>
      <p>
        The fetch happens first in <code>init()</code>, before any data is loaded, so the first fetch is
        already for the restored date rather than today's — no flash of the wrong range.
      </p>

      <h2>With an HTTP backend</h2>
      <code-block [code]="http" title="calendar-preferences.service.ts" />
      <div class="note">
        <strong>The fetch must resolve to <code>&#123; success, preferences &#125;</code>.</strong>
        A response missing <code>success: true</code> is treated as "nothing stored", which is also the right
        answer for a first-time user — so a 404 from your API is best mapped to
        <code>&#123; success: false &#125;</code> rather than thrown.
      </div>

      <h2>Reading and writing manually</h2>
      <code-block [code]="manual" />
    </div>
  `,
  styles: [
    `
      .hint {
        font-size: 0.85rem;
        color: var(--sc-text-secondary);
        align-self: center;
      }
    `,
  ],
})
export class PreferencesPage {
  protected readonly writes = signal(0);
  protected readonly stored = signal(read() ?? '// nothing stored yet');

  private readonly adapterImpl: PreferencesAdapter = {
    fetch: async () => {
      const raw = read();
      if (!raw) return { success: false };
      try {
        return { success: true, preferences: JSON.parse(raw) as CalendarPreferences };
      } catch {
        return { success: false };
      }
    },
    save: async (_contextId: string, prefs: CalendarPreferences) => {
      const json = JSON.stringify(prefs, null, 2);
      try {
        localStorage.setItem(KEY, json);
      } catch {
        // Storage is unavailable in some embedding contexts; the demo still works.
      }
      this.stored.set(json);
      this.writes.update((n) => n + 1);
    },
  };

  protected readonly config: CalendarConfig = {
    dataSource: demoDataSource,
    contextId: 'demo-user',
    preferences: this.adapterImpl,
  };

  protected clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Nothing to clear if storage was never available.
    }
    this.stored.set('// nothing stored yet');
    this.writes.set(0);
  }

  protected readonly adapter = `
new CalendarApp({
  // Identifies whose preferences these are. Without it, nothing happens.
  contextId: currentUser.id,

  preferences: {
    async fetch(contextId) {
      const res = await fetch(\`/api/users/\${contextId}/calendar-prefs\`);
      if (!res.ok) return { success: false };
      return { success: true, preferences: await res.json() };
    },

    async save(contextId, prefs) {
      await fetch(\`/api/users/\${contextId}/calendar-prefs\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
    },
  },
});

// The older equivalent, still supported:
// callbacks: { fetchPreferences, savePreferences }
`;

  protected readonly shape = `
interface CalendarPreferences {
  viewType: string;         // validated against VIEW_TYPES
  date: string;             // 'YYYY-MM-DD'
  resourceFilters: string[];
  resourceMode: ResourceMode;  // validated against RESOURCE_MODES
}
`;

  protected readonly http = `
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type { PreferencesAdapter } from 'steadycalendar';

@Injectable({ providedIn: 'root' })
export class CalendarPreferencesService {
  private readonly http = inject(HttpClient);

  readonly adapter: PreferencesAdapter = {
    fetch: (contextId) =>
      firstValueFrom(
        this.http.get<any>(\`/api/calendar-prefs/\${contextId}\`).pipe(
          // A first-time user is a normal case, not an error.
          catchError(() => of(null)),
        ),
      ).then((preferences) => (preferences ? { success: true, preferences } : { success: false })),

    save: (contextId, prefs) =>
      firstValueFrom(this.http.put(\`/api/calendar-prefs/\${contextId}\`, prefs)).then(() => undefined),
  };
}
`;

  protected readonly manual = `
// What would be saved right now.
const prefs = calendar.state.toPreferences();
// { viewType, date, resourceFilters, resourceMode }

// Apply a set yourself — validated and reconciled, same as a restore.
calendar.state.applyPreferences({
  viewType: 'resourceTimeGridWeek',
  date: '2026-08-17',
  resourceFilters: ['s1', 's2'],
  resourceMode: 'primaryView',
});
`;
}

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
