import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { CalendarConfig, DataSource } from 'steadycalendar';
import { ScCalendarComponent } from './sc-calendar.component';

/**
 * jsdom has no layout engine, so these prove structure rather than appearance — the same
 * split the library's own suite draws. What they are here to catch is the wrapper's own
 * job: that a mount produces exactly one calendar, that a rebuild does not leave two, and
 * that teardown leaves nothing behind.
 */

const dataSource: DataSource = {
  async fetchResources() {
    return {
      resources: [
        { id: 's1', name: 'Alex Chen', color: '#8935FF' },
        { id: 's2', name: 'Blake Osei', color: '#007CBE' },
      ],
      businessHours: [{ day_of_week: 'Monday', start_time: '09:00', end_time: '18:00' }],
    };
  },
  async fetchEvents({ start }) {
    return [
      {
        id: 'bk-1',
        date: start,
        start_time: '09:00',
        end_time: '09:30',
        assignee: { id: 's1' },
        client: { name: 'J. Ferreira' },
        service: { name: 'Follow-up' },
        status: 'Active',
      },
    ];
  },
};

@Component({
  imports: [ScCalendarComponent],
  template: '<sc-calendar [config]="config()" />',
})
class Host {
  readonly config = signal<CalendarConfig>({ dataSource });
}

/**
 * `init()` awaits two fetches, and `afterNextRender` has to run first. Rather than guess a
 * delay, poll until a selector appears.
 *
 * The default is `.sc-event` rather than `.sc-toolbar` on purpose: the toolbar mounts
 * before `loadEvents()` is awaited, so waiting on it would return while the grid is still
 * empty and make any assertion about events flaky.
 */
async function settle(
  fixture: { detectChanges(): void },
  selector = '.sc-event',
  attempts = 60,
): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (document.querySelector(selector)) return;
  }
}

describe('ScCalendarComponent', () => {
  it('should_mount_the_calendar_into_its_host', async () => {
    const fixture = TestBed.createComponent(Host);
    await settle(fixture);

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.sc-toolbar')).toHaveLength(1);
    expect(host.querySelectorAll('.sc-grid')).toHaveLength(1);
    // CalendarApp adds this class to whatever it was given; without it, absolutely
    // positioned events pile up at the page origin instead of inside the grid.
    expect(host.querySelector('.sc-calendar-host')?.classList).toContain('sc-calendar-container');

    fixture.destroy();
  });

  it('should_render_the_mapped_events', async () => {
    const fixture = TestBed.createComponent(Host);
    await settle(fixture);

    const events = (fixture.nativeElement as HTMLElement).querySelectorAll('.sc-event');
    expect(events.length).toBeGreaterThan(0);

    fixture.destroy();
  });

  it('should_leave_the_container_empty_after_destroy', async () => {
    const fixture = TestBed.createComponent(Host);
    await settle(fixture);

    const mount = (fixture.nativeElement as HTMLElement).querySelector('.sc-calendar-host') as HTMLElement;
    expect(mount.children.length).toBeGreaterThan(0);

    fixture.destroy();

    expect(mount.children.length).toBe(0);
    expect(mount.classList.contains('sc-calendar-container')).toBe(false);
  });

  it('should_not_accumulate_calendars_across_repeated_mounts', async () => {
    // The route-thrash case: ten navigations in and out of a page holding a calendar.
    for (let i = 0; i < 10; i++) {
      const fixture = TestBed.createComponent(Host);
      await settle(fixture);
      expect(document.querySelectorAll('.sc-toolbar')).toHaveLength(1);
      fixture.destroy();
      expect(document.querySelectorAll('.sc-toolbar')).toHaveLength(0);
    }
  });

  it('should_rebuild_exactly_once_when_the_config_reference_changes', async () => {
    const fixture = TestBed.createComponent(Host);
    await settle(fixture);

    fixture.componentInstance.config.set({ dataSource, locale: 'ja-JP' });
    await settle(fixture);

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.sc-toolbar')).toHaveLength(1);
    expect(host.querySelectorAll('.sc-grid')).toHaveLength(1);

    fixture.destroy();
  });
});
