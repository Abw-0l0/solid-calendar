/**
 * CalendarConfig — Constants, view definitions, defaults
 */

/** Slot interval in minutes (each grid row) */
export const SLOT_INTERVAL = 10;

/** Label interval in minutes (time labels on the axis) */
export const LABEL_INTERVAL = 30;

/** Grid display range (full 24-hour day) */
export const DEFAULT_BUSINESS_HOURS = { start: '00:00', end: '24:00' };

/** View type definitions */
export const VIEW_TYPES = {
    resourceTimeGridDay: { duration: 'day', isResource: true, label: 'Day' },
    resourceTimeGridThreeDay: { duration: '3day', isResource: true, label: '3 Day' },
    resourceTimeGridWeek: { duration: 'week', isResource: true, label: 'Week' },
    timeGridDay: { duration: 'day', isResource: false, label: 'Day' },
    timeGridThreeDay: { duration: '3day', isResource: false, label: '3 Day' },
    timeGridWeek: { duration: 'week', isResource: false, label: 'Week' },
    dayGridMonth: { duration: 'month', isResource: false, label: 'Month' },
    list: { duration: 'week', isResource: false, label: 'List' }
};

/** Canonical resource type values, as written by CalendarApp._buildResources */
export const RESOURCE_TYPES = { STAFF: 'staff', RESOURCE: 'resource' };

/** Resource mode definitions */
export const RESOURCE_MODES = {
    staffView: { label: 'Staff', type: 'staff' },
    resourceView: { label: 'Resource', type: 'resource' },
    integratedView: { label: 'Integrated', type: 'both' },
    flatView: { label: 'Flat', type: 'flat' }
};

/** Duration to number of days mapping */
export const DURATION_DAYS = {
    day: 1,
    '3day': 3,
    week: 7
};

/** Default state values */
export const DEFAULTS = {
    view: 'resourceTimeGridDay',
    resourceMode: 'staffView',
    privacyMode: false
};

/** Slot height in pixels */
export const SLOT_HEIGHT = 12;

/** Minimum event height in pixels */
export const MIN_EVENT_HEIGHT = 20;

/** Fallback colour for a resource or appointment that supplies none. */
export const DEFAULT_RESOURCE_COLOR = '#6B73FF';

/** Fallback colour for time blocks and secondary resources — deliberately neutral. */
export const DEFAULT_NEUTRAL_COLOR = '#6B7280';

/** Debounce delay for preference saving (ms) */
export const PREFERENCE_SAVE_DELAY = 1000;

/** Now indicator update interval (ms) */
export const NOW_INDICATOR_INTERVAL = 60000;

/**
 * True when the mode shows date columns rather than one column per resource.
 * @param {string} mode
 * @returns {boolean}
 */
export function isFlatMode(mode) {
    return RESOURCE_MODES[mode]?.type === 'flat';
}

/**
 * Check if a view type is a resource view
 * @param {string} viewType
 * @returns {boolean}
 */
export function isResourceView(viewType) {
    return VIEW_TYPES[viewType]?.isResource ?? false;
}

export default {
    SLOT_INTERVAL, LABEL_INTERVAL, DEFAULT_BUSINESS_HOURS,
    VIEW_TYPES, RESOURCE_MODES, RESOURCE_TYPES, DURATION_DAYS, DEFAULTS,
    SLOT_HEIGHT, MIN_EVENT_HEIGHT, DEFAULT_RESOURCE_COLOR, DEFAULT_NEUTRAL_COLOR,
    PREFERENCE_SAVE_DELAY, NOW_INDICATOR_INTERVAL,
    isResourceView, isFlatMode
};
