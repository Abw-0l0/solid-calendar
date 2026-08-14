/**
 * The demo's people, rooms and opening hours.
 *
 * Field names here match SteadyCalendar's DEFAULT_FIELD_MAP, so this dataset needs no
 * `fieldMap` at all. The deliberately foreign payloads live in `foreign-schemas.data.ts`.
 *
 * Every staff member exercises a different branch of BusinessHoursOverlay's resolution
 * chain, which runs in this order for a primary resource:
 *
 *   resource date override -> closedDays -> holiday policy -> weekly schedules
 *   -> business date override -> weekly business hours
 *
 * ...and the result is then intersected with business hours, so a resource can never open
 * wider than the business does. Secondary resources always use plain business hours.
 */
import { temporal } from 'steadycalendar';

/** Anchor for every relative date below. Resolved once so a session stays coherent. */
export const TODAY = temporal.getCurrentDate();

const day = (offset: number) => temporal.addDaysToString(TODAY, offset);

export interface DemoStaff {
  id: string;
  name: string;
  color: string;
  order: number;
  closedDays?: Array<string | number>;
  schedules?: Array<{ day_of_week: string; start_time: string; end_time: string }>;
  overrides?: Array<{
    from_date: string;
    to_date?: string;
    type: 'closed' | 'open';
    start_time?: string;
    end_time?: string;
  }>;
  holiday_hours_setting?: 'follow' | 'closed' | 'custom' | 'normal';
  holiday_hours?: Array<{ start_time: string; end_time: string }>;
  isSystemResource?: boolean;
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;

const weekdaySchedule = (start: string, end: string) =>
  WEEKDAYS.map((d) => ({ day_of_week: d, start_time: start, end_time: end }));

export const STAFF: DemoStaff[] = [
  {
    // The plain case: no closed days, no schedule, no overrides. Falls all the way
    // through to the weekly business hours.
    id: 's1',
    name: 'Alex Chen',
    color: '#8935FF',
    order: 1,
  },
  {
    // A narrower personal schedule. Intersected with business hours, so the 08:00 start
    // is clamped to the shop's 09:00 rather than opening an hour early.
    id: 's2',
    name: 'Blake Osei',
    color: '#007CBE',
    order: 2,
    schedules: weekdaySchedule('08:00', '16:00'),
  },
  {
    // closedDays matches names and numbers alike (0 = Sunday), so both forms are here
    // on purpose: Wednesday by name, Sunday by number.
    id: 's3',
    name: 'Corin Vale',
    color: '#38A169',
    order: 3,
    closedDays: ['Wednesday', 0],
  },
  {
    // Date overrides beat everything else. One closed block for leave, one 'open' that
    // extends a Saturday — still clamped by the business's own Saturday hours.
    id: 's4',
    name: 'Dara Okonjo',
    color: '#D69E2E',
    order: 4,
    overrides: [
      { from_date: day(3), to_date: day(5), type: 'closed' },
      { from_date: day(8), type: 'open', start_time: '07:00', end_time: '20:00' },
    ],
  },
  {
    // Opts out of holidays entirely, whatever the business-wide policy says.
    id: 's5',
    name: 'Emre Sahin',
    color: '#E53E3E',
    order: 5,
    holiday_hours_setting: 'closed',
  },
];

export interface DemoRoom {
  id: string;
  name: string;
  color: string;
  order: number;
}

/**
 * Secondary resources. The library prefixes their ids with `secondary-` internally so
 * they cannot collide with a primary id, and they are exempt from the resource filter.
 */
export const ROOMS: DemoRoom[] = [
  { id: 'r1', name: 'Room A', color: '#DD6B20', order: 1 },
  { id: 'r2', name: 'Room B', color: '#319795', order: 2 },
  { id: 'r3', name: 'Studio C', color: '#805AD5', order: 3 },
];

/** Weekly opening hours. Sunday is absent, which shades the whole column closed. */
export const BUSINESS_HOURS = [
  { day_of_week: 'Monday', start_time: '09:00', end_time: '18:00' },
  { day_of_week: 'Tuesday', start_time: '09:00', end_time: '18:00' },
  { day_of_week: 'Wednesday', start_time: '09:00', end_time: '18:00' },
  { day_of_week: 'Thursday', start_time: '09:00', end_time: '20:00' },
  { day_of_week: 'Friday', start_time: '09:00', end_time: '18:00' },
  { day_of_week: 'Saturday', start_time: '10:00', end_time: '14:00' },
];

/** Business-wide date exceptions: a stocktake closure and one late opening. */
export const BUSINESS_OVERRIDES = [
  { from_date: day(10), type: 'closed' as const },
  { from_date: day(12), type: 'open' as const, start_time: '11:00', end_time: '22:00' },
];

/**
 * What the business does on a public holiday. `follow` is the default a resource
 * inherits, so this setting reaches everyone who has not opted out.
 */
export const HOLIDAY_SETTINGS = {
  holiday_hours_setting: 'custom' as const,
  holiday_hours: [{ start_time: '11:00', end_time: '15:00' }],
};

/**
 * The simplest of the three holiday sources: a date-to-name map on `config.holidays`.
 * The library ships no holiday data for any country by design — see the plugins page for
 * the HolidayProvider route, which suits a live source or a per-country package.
 */
export const HOLIDAYS: Record<string, string> = {
  [day(2)]: 'Founders Day',
  [day(16)]: 'Midsummer Holiday',
  [day(-9)]: 'Spring Bank Holiday',
};
