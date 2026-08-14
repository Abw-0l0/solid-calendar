/**
 * temporal.js — date/time utilities
 *
 * Built on native Date and Intl only. The core has no runtime dependencies, so the
 * small slice of the Temporal API this library actually needs — 15 operations — is
 * implemented here rather than pulled in as a 200 kB polyfill.
 *
 * Two rules keep this correct, and both are load-bearing:
 *
 *   1. All arithmetic runs on a UTC-midnight epoch and reads only getUTC* accessors.
 *      Local-time construction (`new Date(y, m - 1, d)`) is DST-unsafe: in zones that
 *      transition at midnight, local midnight does not exist on that date and Date
 *      silently yields 01:00. There is deliberately no local-time path below.
 *
 *   2. Month arithmetic clamps to the end of the target month. Jan 31 plus one month
 *      is Feb 28, not Mar 3. Naive `setUTCMonth` gets this wrong.
 *
 * temporal.differential.test.js checks this file against @js-temporal/polyfill (a
 * devDependency kept only as a test oracle) across ~18,600 dates.
 */

const MS_PER_DAY = 86400000;

const pad = (n, width = 2) => String(n).padStart(width, '0');

/**
 * Milliseconds at UTC midnight for a Y/M/D.
 * setUTCFullYear is used rather than Date.UTC because the latter maps two-digit
 * years into the 1900s (Date.UTC(99, 0, 1) is 1999, not year 99).
 * @returns {number}
 */
function epochAtUtcMidnight(year, month, day) {
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(0, 0, 0, 0);
    return date.getTime();
}

/**
 * Number of days in a month. Day 0 of the following month is the last day of this one.
 * @param {number} year
 * @param {number} month 1-12
 * @returns {number}
 */
function daysInMonthOf(year, month) {
    const date = new Date(0);
    date.setUTCFullYear(year, month, 0);
    date.setUTCHours(0, 0, 0, 0);
    return date.getUTCDate();
}

/**
 * A calendar date with no time and no zone, mirroring the slice of Temporal.PlainDate
 * this library uses. Callers read `.year`, `.month`, `.day`, `.dayOfWeek`,
 * `.daysInMonth`, and call `.add()`, `.subtract()`, `.toString()`.
 */
export class PlainDate {
    /**
     * Assumes already-valid fields; use `from` or `fromFields` to construct from input.
     * @param {number} year
     * @param {number} month 1-12
     * @param {number} day 1-31
     */
    constructor(year, month, day) {
        this.year = year;
        this.month = month;
        this.day = day;
        this._epoch = epochAtUtcMidnight(year, month, day);
    }

    /**
     * Strict ISO parse. Rejects dates that do not exist, matching Temporal.
     * @param {string} value 'YYYY-MM-DD'
     * @returns {PlainDate}
     * @throws {RangeError}
     */
    static from(value) {
        if (typeof value !== 'string') throw new RangeError(`Invalid date: ${String(value)}`);
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        if (!match) throw new RangeError(`Invalid ISO date: ${value}`);
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        if (month < 1 || month > 12) throw new RangeError(`Invalid month: ${value}`);
        if (day < 1 || day > daysInMonthOf(year, month)) throw new RangeError(`Invalid day: ${value}`);
        return new PlainDate(year, month, day);
    }

    /**
     * Lenient field construction: out-of-range values are constrained rather than
     * rejected, matching Temporal's property-bag form ({month: 2, day: 31} is Feb 28).
     * @returns {PlainDate}
     */
    static fromFields(year, month, day) {
        const m = Math.min(12, Math.max(1, Math.trunc(month)));
        const d = Math.min(daysInMonthOf(year, m), Math.max(1, Math.trunc(day)));
        return new PlainDate(year, m, d);
    }

    /** @param {number} ms @returns {PlainDate} */
    static fromEpoch(ms) {
        const date = new Date(ms);
        return new PlainDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    }

    /** @returns {-1|0|1} */
    static compare(a, b) {
        if (a._epoch < b._epoch) return -1;
        if (a._epoch > b._epoch) return 1;
        return 0;
    }

    /** ISO-8601 weekday: 1 = Monday .. 7 = Sunday. @returns {number} */
    get dayOfWeek() {
        const jsDay = new Date(this._epoch).getUTCDay();
        return jsDay === 0 ? 7 : jsDay;
    }

    /** @returns {number} */
    get daysInMonth() {
        return daysInMonthOf(this.year, this.month);
    }

    /**
     * Years and months resolve together into a single month count, the day is clamped
     * to that month's length, and only then are days applied. That order matters:
     * 2024-01-31 plus {months: 1, days: 1} is 2024-03-01, not 2024-03-02.
     * @param {{years?: number, months?: number, days?: number}} duration
     * @returns {PlainDate}
     */
    add({ years = 0, months = 0, days = 0 } = {}) {
        const totalMonths = this.year * 12 + (this.month - 1) + years * 12 + months;
        const year = Math.floor(totalMonths / 12);
        const month = (((totalMonths % 12) + 12) % 12) + 1;
        const day = Math.min(this.day, daysInMonthOf(year, month));

        const shifted = new PlainDate(year, month, day);
        return days ? PlainDate.fromEpoch(shifted._epoch + days * MS_PER_DAY) : shifted;
    }

    /** @param {{years?: number, months?: number, days?: number}} duration @returns {PlainDate} */
    subtract({ years = 0, months = 0, days = 0 } = {}) {
        return this.add({ years: -years, months: -months, days: -days });
    }

    /** @returns {string} 'YYYY-MM-DD' */
    toString() {
        return `${pad(this.year, 4)}-${pad(this.month)}-${pad(this.day)}`;
    }

    /** Lets dates be compared with < and > directly. @returns {number} */
    valueOf() {
        return this._epoch;
    }
}

/** A wall-clock time with no date and no zone. */
export class PlainTime {
    constructor(hour, minute, second = 0) {
        this.hour = hour;
        this.minute = minute;
        this.second = second;
    }

    /**
     * @param {string} value 'HH:MM' or 'HH:MM:SS', zero-padded
     * @returns {PlainTime}
     * @throws {RangeError}
     */
    static from(value) {
        if (typeof value !== 'string') throw new RangeError(`Invalid time: ${String(value)}`);
        const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
        if (!match) throw new RangeError(`Invalid ISO time: ${value}`);
        const hour = Number(match[1]);
        const minute = Number(match[2]);
        const second = match[3] ? Number(match[3]) : 0;
        if (hour > 23 || minute > 59 || second > 59) throw new RangeError(`Time out of range: ${value}`);
        return new PlainTime(hour, minute, second);
    }

    /** @returns {string} 'HH:MM:SS' */
    toString() {
        return `${pad(this.hour)}:${pad(this.minute)}:${pad(this.second)}`;
    }
}

// --- Timezone resolution ---

// Intl.DateTimeFormat construction is expensive and isToday() runs once per rendered
// cell, so formatters are cached per zone.
const _dateFormatters = new Map();
const _timeFormatters = new Map();

function dateFormatterFor(timeZone) {
    let formatter = _dateFormatters.get(timeZone);
    if (!formatter) {
        // Throws RangeError on an unknown zone, which is the behaviour we want to keep.
        formatter = new Intl.DateTimeFormat('en-US', {
            timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
        });
        _dateFormatters.set(timeZone, formatter);
    }
    return formatter;
}

function timeFormatterFor(timeZone) {
    let formatter = _timeFormatters.get(timeZone);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-US', {
            timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        });
        _timeFormatters.set(timeZone, formatter);
    }
    return formatter;
}

/**
 * Read named parts rather than parsing a formatted string. Locale layout is a CLDR
 * property, not a guarantee: on a small-icu build, a locale chosen for its YYYY-MM-DD
 * layout silently falls back to M/D/YYYY and would parse into the wrong date without
 * ever throwing. Part names are layout-independent.
 */
function partsToFields(formatter, date) {
    const fields = {};
    for (const part of formatter.formatToParts(date)) {
        if (part.type !== 'literal') fields[part.type] = Number(part.value);
    }
    return fields;
}

/* global process */
function resolveEnvTimezone() {
    // Node, SSR and build-time only; guarded so browser bundles never touch `process`.
    // config.timezone takes precedence over this.
    if (typeof process !== 'undefined' && process?.env) {
        return process.env.STEADYCALENDAR_TIMEZONE || null;
    }
    return null;
}

function resolveSystemTimezone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
}

function isValidTimezone(timeZone) {
    if (typeof timeZone !== 'string' || !timeZone) return false;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone });
        return true;
    } catch {
        return false;
    }
}

let _defaultTimezone = resolveEnvTimezone() || resolveSystemTimezone();

/**
 * Set the zone used whenever a function needs "now". CalendarApp calls this once from
 * its constructor with `config.timezone`, before CalendarState reads the current date.
 *
 * This is module-level state, so two CalendarApp instances on one page cannot run in
 * different zones; pass an explicit `timezone` argument to the getters if you need that.
 *
 * @param {string|null} [timeZone] IANA name, or null/undefined to restore the default
 * @returns {string} the zone now in effect
 */
export function setDefaultTimezone(timeZone) {
    if (timeZone == null) {
        _defaultTimezone = resolveEnvTimezone() || resolveSystemTimezone();
        return _defaultTimezone;
    }
    if (!isValidTimezone(timeZone)) {
        console.warn(`[SteadyCalendar:temporal] Unknown timezone "${timeZone}"; keeping "${_defaultTimezone}".`);
        return _defaultTimezone;
    }
    _defaultTimezone = timeZone;
    return _defaultTimezone;
}

/** @returns {string} */
export function getDefaultTimezone() {
    return _defaultTimezone;
}

/** @returns {PlainDate} today in the given (or default) zone */
function todayIn(timeZone) {
    const { year, month, day } = partsToFields(dateFormatterFor(timeZone || _defaultTimezone), new Date());
    return new PlainDate(year, month, day);
}

/** @returns {{hour: number, minute: number}} */
function nowTimeIn(timeZone) {
    const { hour, minute } = partsToFields(timeFormatterFor(timeZone || _defaultTimezone), new Date());
    // Some ICU builds render midnight as 24 under an h23 cycle.
    return { hour: hour % 24, minute };
}

// --- Constants ---

export const WEEKDAYS_JA_SHORT = ['日', '月', '火', '水', '木', '金', '土'];
export const WEEKDAYS_EN_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function getWeekdayNames(locale) {
    const loc = getLocale(locale);
    return loc === 'ja-JP' ? WEEKDAYS_JA_SHORT : WEEKDAYS_EN_SHORT;
}

export function getLocale(locale) {
    const map = {
        'ja': 'ja-JP', 'ja-JP': 'ja-JP', 'ja_JP': 'ja-JP',
        'en': 'en-US', 'en-US': 'en-US', 'en_US': 'en-US',
    };
    return map[locale] || locale || 'en-US';
}

// --- Parsing ---

export function parseLocalDate(dateString) {
    if (!dateString) return todayIn();
    if (typeof dateString === 'object' && dateString.toString) {
        const str = dateString.toString();
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
            return PlainDate.from(str.substring(0, 10));
        }
    }
    if (typeof dateString === 'string') {
        const datePart = dateString.substring(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
            return PlainDate.from(datePart);
        }
    }
    return todayIn();
}

export function parseTime(timeString) {
    if (!timeString || typeof timeString !== 'string') return null;
    try {
        return PlainTime.from(timeString);
    } catch {
        return null;
    }
}

export function extractTime(isoString) {
    if (!isoString) return '';
    const match = isoString.match(/(\d{2}:\d{2})/);
    return match ? match[1] : '';
}

// --- Formatting ---

export function formatDate(dateString, locale = 'en-US') {
    if (!dateString) return '';
    const date = parseLocalDate(dateString);
    const dow = date.dayOfWeek % 7;
    const weekdays = getWeekdayNames(getLocale(locale));
    const y = date.year;
    const m = String(date.month).padStart(2, '0');
    const d = String(date.day).padStart(2, '0');
    return `${y}/${m}/${d} (${weekdays[dow]})`;
}

export function formatDateJapanese(dateString) {
    if (!dateString) return '';
    const date = parseLocalDate(dateString);
    const dow = date.dayOfWeek % 7;
    return `${date.year}年${date.month}月${date.day}日（${WEEKDAYS_JA_SHORT[dow]}）`;
}

export function formatDateWithDetails(dateString, locale = 'en-US') {
    const date = parseLocalDate(dateString);
    const dow = date.dayOfWeek % 7;
    const weekdays = getWeekdayNames(getLocale(locale));
    return {
        formatted: formatDate(dateString, locale),
        year: date.year,
        month: date.month,
        day: date.day,
        weekday: weekdays[dow],
    };
}

export function formatTime(timeStr) {
    if (!timeStr) return '';
    const timeMatch = timeStr.match(/(\d{2}:\d{2})/);
    return timeMatch ? timeMatch[1] : timeStr;
}

/** Locale-appropriate suffix for a duration in minutes. */
function durationUnit(locale) {
    return getLocale(locale) === 'ja-JP' ? '分' : ' min';
}

/**
 * @param {string} startTime 'HH:MM'
 * @param {number} durationMinutes
 * @param {string} [locale]
 * @returns {string} e.g. '09:00 - 09:30 (30 min)' or '09:00 - 09:30 (30分)'
 */
export function formatTimeRange(startTime, durationMinutes, locale) {
    const endTime = addMinutesToTime(startTime, durationMinutes);
    return `${formatTime(startTime)} - ${formatTime(endTime)} (${durationMinutes}${durationUnit(locale)})`;
}

// --- Time Calculations ---

export function convertTimeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return hours * 60 + minutes;
}

export function convertMinutesToTime(totalMinutes) {
    const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
    const hours = Math.floor(wrapped / 60);
    const minutes = wrapped % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function addMinutesToTime(timeStr, minutesToAdd) {
    return convertMinutesToTime(convertTimeToMinutes(timeStr) + minutesToAdd);
}

export function timeDiff(startTime, endTime) {
    return convertTimeToMinutes(endTime) - convertTimeToMinutes(startTime);
}

export function timeDiffDetailed(startTime, endTime) {
    const total = timeDiff(startTime, endTime);
    return {
        hours: Math.floor(Math.abs(total) / 60),
        minutes: Math.abs(total) % 60,
        totalMinutes: total,
    };
}

// --- Date Arithmetic ---

export function addDays(dateString, days) {
    return parseLocalDate(dateString).add({ days });
}

export function addDaysToString(dateString, days) {
    return addDays(dateString, days).toString();
}

/**
 * Months clamp to the end of the target month: Jan 31 + 1 month is Feb 28.
 *
 * NOTE THE RETURN TYPE. These two return a 'YYYY-MM-DD' string, while addDays returns a
 * PlainDate and addDaysToString returns a string. That asymmetry — a string-returning
 * adder with neither a ToString suffix nor an object-returning sibling — is what left
 * DatePicker reading .year off a string for two releases. For the object form, call
 * parseLocalDate(s).add({ months }) directly, which is all this does.
 *
 * @returns {string} 'YYYY-MM-DD'
 */
export function addMonths(dateString, months) {
    return parseLocalDate(dateString).add({ months }).toString();
}

/** @returns {string} 'YYYY-MM-DD' — see the note on addMonths. */
export function addYears(dateString, years) {
    return parseLocalDate(dateString).add({ years }).toString();
}

// --- Date Ranges ---

export function getMonthRange(year, month) {
    const start = PlainDate.fromFields(year, month, 1);
    const daysInMonth = start.daysInMonth;
    const end = PlainDate.fromFields(year, month, daysInMonth);
    return { start: start.toString(), end: end.toString(), year, month, daysInMonth };
}

export function getWeekRange(dateString) {
    const date = parseLocalDate(dateString);
    const dow = date.dayOfWeek % 7;
    const start = date.subtract({ days: dow });
    const end = start.add({ days: 6 });
    return { start: start.toString(), end: end.toString() };
}

export function getMonthDates(year, month) {
    const { daysInMonth } = getMonthRange(year, month);
    const dates = [];
    for (let d = 1; d <= daysInMonth; d++) {
        dates.push(PlainDate.fromFields(year, month, d).toString());
    }
    return dates;
}

// --- Comparisons ---

export function checkIfPast(dateString, timezone) {
    return PlainDate.compare(parseLocalDate(dateString), todayIn(timezone)) < 0;
}

export function isToday(dateString, timezone) {
    return PlainDate.compare(parseLocalDate(dateString), todayIn(timezone)) === 0;
}

export function isFuture(dateString, timezone) {
    return PlainDate.compare(parseLocalDate(dateString), todayIn(timezone)) > 0;
}

export function isSameDay(date1, date2) {
    return PlainDate.compare(parseLocalDate(date1), parseLocalDate(date2)) === 0;
}

export function isBefore(date1, date2) {
    return PlainDate.compare(parseLocalDate(date1), parseLocalDate(date2)) < 0;
}

export function isAfter(date1, date2) {
    return PlainDate.compare(parseLocalDate(date1), parseLocalDate(date2)) > 0;
}

export function isWithinRange(date, startDate, endDate) {
    return !isBefore(date, startDate) && !isAfter(date, endDate);
}

// --- Current Date/Time ---

export function getCurrentDate(timezone) {
    return todayIn(timezone).toString();
}

export function getCurrentTime(timezone) {
    const { hour, minute } = nowTimeIn(timezone);
    return `${pad(hour)}:${pad(minute)}`;
}

export function getCurrentHour(timezone) {
    return nowTimeIn(timezone).hour;
}

export function getCurrentMinute(timezone) {
    return nowTimeIn(timezone).minute;
}
