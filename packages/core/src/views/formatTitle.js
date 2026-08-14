/**
 * formatTitle — the toolbar title string for a given date and view duration.
 *
 * ViewManager and DateNavigation each had their own copy of this, and they disagreed:
 * zero-padded versus bare month numbers, different handling of a 3-day span crossing a
 * month boundary, and DateNavigation called getLocale() with no argument so it always
 * rendered English regardless of config.locale. ViewManager now owns the calculation
 * and publishes it as `title:updated`; DateNavigation only renders what it receives.
 */
import { parseLocalDate, addDaysToString, formatDateJapanese } from '../utils/temporal.js';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const EN_DASH = '–';

const pad = (n) => String(n).padStart(2, '0');

/** '2026/03/04' or '2026年3月4日（水）' */
function dayTitle(dateStr, isJa) {
    if (isJa) return formatDateJapanese(dateStr);
    const date = parseLocalDate(dateStr);
    return `${date.year}/${pad(date.month)}/${pad(date.day)}`;
}

/** '2026/03/04 – 06', or '2026/03/30 – 04/01' across a month boundary */
function threeDayTitle(dateStr) {
    const start = parseLocalDate(dateStr);
    const end = parseLocalDate(addDaysToString(dateStr, 2));
    const head = `${start.year}/${pad(start.month)}/${pad(start.day)}`;

    return start.month === end.month
        ? `${head} ${EN_DASH} ${pad(end.day)}`
        : `${head} ${EN_DASH} ${pad(end.month)}/${pad(end.day)}`;
}

/** '2026/3/2–8', or '2026/3/30–4/5' across a month boundary */
function weekTitle(dateStr) {
    const start = parseLocalDate(dateStr);
    const end = parseLocalDate(addDaysToString(dateStr, 6));
    const head = `${start.year}/${start.month}/${start.day}`;

    return start.month === end.month
        ? `${head}${EN_DASH}${end.day}`
        : `${head}${EN_DASH}${end.month}/${end.day}`;
}

/** 'March 2026' or '2026年3月' */
function monthTitle(dateStr, isJa) {
    const date = parseLocalDate(dateStr);
    if (isJa) return `${date.year}年${date.month}月`;
    return `${MONTH_NAMES[date.month - 1]} ${date.year}`;
}

/**
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {string} duration 'day' | '3day' | 'week' | 'month'
 * @param {string} [locale]
 * @returns {string}
 */
export function formatViewTitle(dateStr, duration, locale) {
    const isJa = locale === 'ja-JP';

    switch (duration) {
        case '3day':
            return threeDayTitle(dateStr);
        case 'week':
            return weekTitle(dateStr);
        case 'month':
            return monthTitle(dateStr, isJa);
        case 'day':
        default:
            return dayTitle(dateStr, isJa);
    }
}
