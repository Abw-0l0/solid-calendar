/**
 * Payloads that look nothing like the defaults, for the field-mapping page.
 *
 * The point of `fieldMap` is that you describe your API once instead of reshaping every
 * response into the calendar's vocabulary. These two datasets prove it from both ends:
 * one shares no field name with the defaults at all, the other is handled by a preset
 * the library already ships.
 */
import type { FieldMap } from 'steadycalendar';
import { TODAY } from './resources.data';
import { temporal } from 'steadycalendar';

const day = (offset: number) => temporal.addDaysToString(TODAY, offset);

// --- A vehicle workshop ----------------------------------------------------
//
// Not one field name overlaps with DEFAULT_FIELD_MAP: bays instead of resources, `ref`
// instead of `id`, `on`/`from`/`to` instead of date and times, and the customer is
// nested two levels deep to exercise dotted paths.

export const WORKSHOP_DATA = {
  crew: [
    { code: 'm1', displayName: 'Ines Duarte', swatch: '#2B6CB0', rank: 1 },
    { code: 'm2', displayName: 'Tomas Weber', swatch: '#C05621', rank: 2 },
    { code: 'm3', displayName: 'Yusuf Kaya', swatch: '#2F855A', rank: 3 },
  ],
  bays: [
    { code: 'b1', displayName: 'Lift 1', swatch: '#4A5568', rank: 1 },
    { code: 'b2', displayName: 'Lift 2', swatch: '#718096', rank: 2 },
  ],
  openingTimes: [
    { day_of_week: 'Monday', start_time: '08:00', end_time: '17:00' },
    { day_of_week: 'Tuesday', start_time: '08:00', end_time: '17:00' },
    { day_of_week: 'Wednesday', start_time: '08:00', end_time: '17:00' },
    { day_of_week: 'Thursday', start_time: '08:00', end_time: '17:00' },
    { day_of_week: 'Friday', start_time: '08:00', end_time: '16:00' },
  ],
};

export const WORKSHOP_JOBS = [
  {
    ref: 'j-1', on: day(0), from: '08:30', to: '10:00',
    assignedTo: { code: 'm1' }, booker: { person: { label: 'Halvorsen Haulage' } },
    job: { label: 'Brake overhaul' }, state: 'confirmed',
  },
  {
    ref: 'j-2', on: day(0), from: '09:00', to: '11:30',
    assignedTo: { code: 'm2' }, booker: { person: { label: 'K. Andrade' } },
    job: { label: 'Full service' }, state: 'confirmed',
  },
  {
    ref: 'j-3', on: day(0), from: '10:15', to: '11:00',
    assignedTo: { code: 'm1' }, booker: { person: { label: 'R. Ferreira' } },
    job: { label: 'Diagnostics' }, state: 'confirmed',
  },
  {
    ref: 'j-4', on: day(0), from: '13:00', to: '15:00',
    assignedTo: { code: 'm3' }, booker: { person: { label: 'Meridian Fleet' } },
    job: { label: 'Tyre replacement' }, state: 'void',
  },
  {
    ref: 'j-5', on: day(0), from: '14:00', to: '16:00',
    assignedTo: { code: 'm2' }, booker: { person: { label: 'S. Nakamura' } },
    job: { label: 'Clutch inspection' }, state: 'confirmed',
  },
  {
    // A title makes this a time block, exactly as in the default schema.
    ref: 'j-6', on: day(0), from: '12:00', to: '12:45',
    label: 'Workshop cleardown', assignedTo: { code: 'm3' }, state: 'confirmed',
  },
];

/**
 * A value is a name, an ordered list of candidates, or a function, and names may be
 * dotted paths. Your entry REPLACES that key's default list rather than extending it —
 * spread `DEFAULT_FIELD_MAP` if you want both.
 */
export const WORKSHOP_FIELD_MAP: FieldMap = {
  dataset: { resources: 'crew', secondaryResources: 'bays', businessHours: 'openingTimes' },
  event: {
    id: 'ref',
    date: 'on',
    startTime: 'from',
    endTime: 'to',
    title: 'label',
    owner: 'assignedTo',
    client: 'booker.person',
    service: 'job',
  },
  resource: { id: 'code', name: 'displayName', color: 'swatch', order: 'rank' },
  secondaryResource: { id: 'code', name: 'displayName', color: 'swatch', order: 'rank' },
  client: { name: 'label' },
  service: { name: 'label' },
};

/** This schema says 'void', not 'Cancelled', so the default status resolver needs replacing. */
export const workshopStatusResolver = (raw: any) => ({ cancelled: raw.state === 'void' });

// --- A clinic --------------------------------------------------------------
//
// Handled by the exported HEALTHCARE_FIELD_MAP with no custom mapping at all, which is
// the point: an existing integration using this vocabulary migrates in one line.

export const HEALTHCARE_DATA = {
  therapists: [
    { id: 'p1', full_name: 'Dr. Amara Nwosu', booking_color: '#6B46C1', order: 1 },
    { id: 'p2', full_name: 'Dr. Liam Fitzgerald', booking_color: '#00857C', order: 2 },
  ],
  equipment: [
    { id: 'e1', name: 'Ultrasound', color: '#4299E1', order: 1 },
    { id: 'e2', name: 'Treadmill', color: '#48BB78', order: 2 },
  ],
  facilityBusinessHours: [
    { day_of_week: 'Monday', start_time: '08:00', end_time: '17:00' },
    { day_of_week: 'Tuesday', start_time: '08:00', end_time: '17:00' },
    { day_of_week: 'Wednesday', start_time: '08:00', end_time: '17:00' },
    { day_of_week: 'Thursday', start_time: '08:00', end_time: '17:00' },
    { day_of_week: 'Friday', start_time: '08:00', end_time: '17:00' },
  ],
};

export const HEALTHCARE_APPOINTMENTS = [
  {
    id: 'a-1', date: day(0), start_time: '09:00', end_time: '09:45',
    therapist: { id: 'p1' }, patient: { full_name: 'E. Bergqvist' },
    menu: { name: 'Physiotherapy' }, status: 'Active',
  },
  {
    id: 'a-2', date: day(0), start_time: '09:30', end_time: '10:15',
    therapist: { id: 'p2' }, patient: { full_name: 'O. Adebayo' },
    menu: { name: 'Rehabilitation' }, equipment: [{ id: 'e2' }], status: 'Active',
  },
  {
    id: 'a-3', date: day(0), start_time: '11:00', end_time: '12:00',
    therapist: { id: 'p1' }, patient: { full_name: 'M. Lindqvist' },
    menu: { name: 'Assessment' }, set_menu_id: 'course-7', status: 'Active',
  },
  {
    id: 'a-4', date: day(0), start_time: '13:30', end_time: '14:15',
    therapist: { id: 'p2' }, patient: { full_name: 'C. Battaglia' },
    menu: { name: 'Follow-up' }, status: 'Cancelled',
  },
];
