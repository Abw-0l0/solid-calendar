/**
 * holidays.js — one holiday lookup for the whole calendar.
 *
 * Holiday data arrived here in four incompatible shapes, each read by a different
 * module, so a host could get red date headers in one view and not another:
 *
 *   config.holidayProvider   getHoliday(dateStr) -> object, getHolidayName(dateStr, locale)
 *   config.holidays          Record<'YYYY-MM-DD', string> — a plain date-to-name map
 *   state.publicHolidays     Record<'YYYY-MM-DD', boolean> — presence only, no names
 *   temporal.getHoliday      imported by four modules; never existed
 *
 * They are resolved here in priority order instead. Every caller has `state` and
 * `config` to hand, so these stay plain functions rather than another class to wire.
 */

/**
 * @typedef {{ name: string, name_en?: string }} Holiday
 */

/**
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {object} state
 * @param {object} config
 * @returns {Holiday|null}
 */
export function resolveHoliday(dateStr, state, config) {
    if (!dateStr) return null;

    const provider = config?.holidayProvider;
    if (typeof provider?.getHoliday === 'function') {
        const holiday = provider.getHoliday(dateStr);
        if (holiday) return holiday;
    }

    const mapped = config?.holidays?.[dateStr];
    if (mapped) return { name: mapped };

    // Presence-only source: a holiday with no name to display.
    if (state?.publicHolidays?.[dateStr]) return { name: '' };

    return null;
}

/**
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {string} [locale]
 * @param {object} state
 * @param {object} config
 * @returns {string} display name, or '' when the date is not a holiday or has no name
 */
export function resolveHolidayName(dateStr, locale, state, config) {
    const provider = config?.holidayProvider;
    if (typeof provider?.getHolidayName === 'function') {
        const name = provider.getHolidayName(dateStr, locale);
        if (name) return name;
    }

    const holiday = resolveHoliday(dateStr, state, config);
    if (!holiday) return '';

    // Providers modelled on @holiday-jp carry a localised name alongside the native one.
    if (locale && locale !== 'ja-JP' && holiday.name_en) return holiday.name_en;
    return holiday.name ?? '';
}

/**
 * Cheaper than resolveHoliday when only the flag matters, e.g. shading non-business hours.
 * @returns {boolean}
 */
export function isHoliday(dateStr, state, config) {
    return resolveHoliday(dateStr, state, config) !== null;
}
