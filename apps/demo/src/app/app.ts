import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from './shell/theme.service';
import { NAV_GROUPS } from './app.routes';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="doc-shell">
      <aside class="doc-sidebar">
        <a class="doc-brand" routerLink="/">
          <span class="doc-brand-mark">SC</span>
          <span>SteadyCalendar</span>
          <span class="doc-brand-version">0.5.0</span>
        </a>

        <nav class="doc-nav">
          @for (group of navGroups; track group.title) {
            <div class="doc-nav-group">{{ group.title }}</div>
            @for (item of group.items; track item.path) {
              <a
                [routerLink]="item.path"
                routerLinkActive="active"
                [routerLinkActiveOptions]="{ exact: item.path === '' }"
                >{{ item.label }}</a
              >
            }
          }
        </nav>
      </aside>

      <main class="doc-main">
        <div class="doc-topbar">
          <a class="btn" href="https://www.npmjs.com/package/steadycalendar" target="_blank" rel="noreferrer">npm</a>
          <a class="btn" href="https://github.com/Abw-0l0/steady-calendar" target="_blank" rel="noreferrer">GitHub</a>
          <button class="btn" type="button" (click)="theme.toggle()">
            {{ theme.mode() === 'light' ? 'Dark' : 'Light' }}
          </button>
        </div>
        <router-outlet />
      </main>
    </div>
  `,
})
export class App {
  protected readonly theme = inject(ThemeService);
  protected readonly navGroups = NAV_GROUPS;
}
