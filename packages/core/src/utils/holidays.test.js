import { describe, it, expect } from 'vitest';
import { resolveHoliday, resolveHolidayName, isHoliday } from './holidays.js';

const NEW_YEAR = '2026-01-01';

const provider = {
    getHoliday: (d) => (d === NEW_YEAR ? { name: '元日', name_en: 'New Year' } : null),
    getHolidayName: (d, locale) => {
        if (d !== NEW_YEAR) return '';
        return locale === 'ja-JP' ? '元日' : 'New Year';
    },
};

describe('holiday resolution', () => {
    describe('sources', () => {
        it('should_read_a_holiday_provider', () => {
            const config = { holidayProvider: provider };
            expect(isHoliday(NEW_YEAR, {}, config)).toBe(true);
            expect(resolveHolidayName(NEW_YEAR, 'en-US', {}, config)).toBe('New Year');
            expect(resolveHolidayName(NEW_YEAR, 'ja-JP', {}, config)).toBe('元日');
        });

        it('should_read_a_date_to_name_map', () => {
            const config = { holidays: { [NEW_YEAR]: 'New Year' } };
            expect(isHoliday(NEW_YEAR, {}, config)).toBe(true);
            expect(resolveHolidayName(NEW_YEAR, 'en-US', {}, config)).toBe('New Year');
        });

        it('should_read_the_presence_only_state_map', () => {
            const state = { publicHolidays: { [NEW_YEAR]: true } };
            expect(isHoliday(NEW_YEAR, state, {})).toBe(true);
            // Presence-only: flagged as a holiday, but there is no name to show.
            expect(resolveHolidayName(NEW_YEAR, 'en-US', state, {})).toBe('');
        });

        it('should_report_a_normal_day_as_not_a_holiday', () => {
            const config = { holidayProvider: provider, holidays: { [NEW_YEAR]: 'New Year' } };
            const state = { publicHolidays: { [NEW_YEAR]: true } };
            expect(isHoliday('2026-01-02', state, config)).toBe(false);
            expect(resolveHoliday('2026-01-02', state, config)).toBeNull();
            expect(resolveHolidayName('2026-01-02', 'en-US', state, config)).toBe('');
        });
    });

    describe('precedence', () => {
        it('should_prefer_the_provider_over_the_map_and_state', () => {
            const config = { holidayProvider: provider, holidays: { [NEW_YEAR]: 'From map' } };
            const state = { publicHolidays: { [NEW_YEAR]: true } };
            expect(resolveHolidayName(NEW_YEAR, 'en-US', state, config)).toBe('New Year');
        });

        it('should_prefer_the_map_over_state_when_no_provider_is_set', () => {
            const config = { holidays: { [NEW_YEAR]: 'From map' } };
            const state = { publicHolidays: { [NEW_YEAR]: true } };
            expect(resolveHolidayName(NEW_YEAR, 'en-US', state, config)).toBe('From map');
        });

        it('should_fall_through_a_provider_that_does_not_know_the_date', () => {
            const config = {
                holidayProvider: { getHoliday: () => null },
                holidays: { [NEW_YEAR]: 'From map' },
            };
            expect(resolveHolidayName(NEW_YEAR, 'en-US', {}, config)).toBe('From map');
        });
    });

    describe('robustness', () => {
        it('should_tolerate_absent_state_and_config', () => {
            expect(isHoliday(NEW_YEAR, undefined, undefined)).toBe(false);
            expect(resolveHoliday(NEW_YEAR, null, null)).toBeNull();
            expect(resolveHolidayName(NEW_YEAR, 'en-US', null, null)).toBe('');
        });

        it('should_tolerate_a_provider_missing_getHolidayName', () => {
            const config = { holidayProvider: { getHoliday: () => ({ name: '元日', name_en: 'New Year' }) } };
            expect(resolveHolidayName(NEW_YEAR, 'en-US', {}, config)).toBe('New Year');
            expect(resolveHolidayName(NEW_YEAR, 'ja-JP', {}, config)).toBe('元日');
        });

        it('should_return_falsy_for_an_empty_date', () => {
            expect(resolveHoliday('', {}, { holidays: {} })).toBeNull();
        });
    });
});
