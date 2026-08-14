/**
 * The DataSource the demo hands to every calendar on the site.
 *
 * A DataSource is two async functions. There is no store to register and no adapter to
 * implement — whatever `fetchEvents` resolves to is run through the field map and
 * rendered. The library caches static data for 30 minutes and events for 5 minutes per
 * range, so these functions are called far less often than a view switch might suggest;
 * `calendar.dataBridge.refresh(true)` clears both.
 */
import type { DataSource } from 'steadycalendar';
import { BUSINESS_HOURS, BUSINESS_OVERRIDES, HOLIDAY_SETTINGS, ROOMS, STAFF } from './resources.data';
import { bookingsInRange } from './bookings.data';

export interface DemoDataSourceOptions {
  /** Simulated network latency in ms, so the toolbar's loading indicator is visible. */
  latency?: number;
  /** Omit the room list, to show what `secondaryView` looks like with nothing to show. */
  includeRooms?: boolean;
  /** Omit hours and overrides, so every column renders fully open. */
  includeBusinessHours?: boolean;
}

const wait = (ms: number) => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve());

export function createDemoDataSource(options: DemoDataSourceOptions = {}): DataSource {
  const { latency = 120, includeRooms = true, includeBusinessHours = true } = options;

  return {
    async fetchResources() {
      await wait(latency);
      return {
        resources: STAFF,
        ...(includeRooms ? { secondaryResources: ROOMS } : {}),
        ...(includeBusinessHours
          ? {
              businessHours: BUSINESS_HOURS,
              businessOverrides: BUSINESS_OVERRIDES,
              holidaySettings: HOLIDAY_SETTINGS,
            }
          : {}),
      };
    },

    async fetchEvents({ start, end }) {
      await wait(latency);
      return bookingsInRange(start, end);
    },
  };
}

/** The shared default, so most pages need no data wiring of their own. */
export const demoDataSource = createDemoDataSource();
