/**
 * JapaneseHolidayProvider — Holiday data for Japan
 *
 * Implements CalendarPlugin + HolidayProvider interfaces.
 */
import holiday_jp from '@holiday-jp/holiday_jp';

/**
 * `YYYY-MM-DD` for a Date, read in UTC.
 * @param {Date|string|number} value
 * @returns {string}
 */
function utcDateKey(value) {
    const d = value instanceof Date ? value : new Date(value);
    return d.getUTCFullYear() + '-'
        + String(d.getUTCMonth() + 1).padStart(2, '0') + '-'
        + String(d.getUTCDate()).padStart(2, '0');
}

export default class JapaneseHolidayProvider {
    constructor() {
        this.name = 'japanese-holidays';
        this._cache = new Map();
        this._locale = 'ja-JP';
    }

    init(context) {
        this._locale = context.config.locale ?? 'ja-JP';
    }

    getHoliday(dateStr) {
        const year = parseInt(dateStr.substring(0, 4), 10);
        const yearMap = this._getHolidaysForYear(year);
        return yearMap.get(dateStr) || null;
    }

    getHolidayName(dateStr, locale) {
        const holiday = this.getHoliday(dateStr);
        if (!holiday) return '';
        const loc = locale ?? this._locale;
        return loc === 'ja-JP' ? holiday.name : (holiday.name_en || holiday.name);
    }

    preload(startDate, endDate) {
        const startYear = parseInt(startDate.substring(0, 4), 10);
        const endYear = parseInt(endDate.substring(0, 4), 10);
        for (let y = startYear; y <= endYear; y++) this._getHolidaysForYear(y);
    }

    _getHolidaysForYear(year) {
        if (this._cache.has(year)) return this._cache.get(year);

        // holiday_jp stores each date at UTC midnight, so the range and the keys must be
        // read in UTC too. Reading them with local getters shifted every holiday back a
        // day under any negative UTC offset — New Year's Day became 31 December, fell
        // outside the year, and the calendar quietly showed one fewer holiday than exist.
        const start = new Date(Date.UTC(year, 0, 1));
        const end = new Date(Date.UTC(year, 11, 31));

        const holidays = holiday_jp.between(start, end);
        const yearMap = new Map();
        for (const h of holidays) {
            yearMap.set(utcDateKey(h.date), h);
        }
        this._cache.set(year, yearMap);
        return yearMap;
    }

    clearCache() { this._cache.clear(); }
    destroy() { this._cache.clear(); }
}
