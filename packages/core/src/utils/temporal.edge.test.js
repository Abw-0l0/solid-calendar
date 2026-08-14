/**
 * Edge cases for the date layer.
 *
 * These pin the behaviours a naive Date-based implementation gets wrong — month-end
 * clamping above all — so they must pass BEFORE the engine is swapped, not after.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    parseLocalDate, parseTime,
    addDaysToString, addMonths, addYears,
    getMonthRange, getMonthDates, getWeekRange,
    getCurrentDate, getCurrentTime,
    isToday, checkIfPast, isFuture,
} from './temporal.js';

const dow = (iso) => parseLocalDate(iso).dayOfWeek;

describe('temporal edge cases', () => {
    afterEach(() => { vi.useRealTimers(); });

    describe('month-end clamping', () => {
        // Naive month arithmetic rolls Jan 31 + 1 month over into March.
        it('should_clamp_jan_31_plus_one_month_to_feb_28', () => {
            expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
        });
        it('should_clamp_to_feb_29_in_a_leap_year', () => {
            expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
        });
        it('should_clamp_when_subtracting_months', () => {
            expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
            expect(addMonths('2026-08-31', -6)).toBe('2026-02-28');
        });
        it('should_clamp_leap_day_plus_one_year', () => {
            expect(addYears('2024-02-29', 1)).toBe('2025-02-28');
        });
        it('should_not_clamp_when_the_day_fits', () => {
            expect(addMonths('2026-01-15', 1)).toBe('2026-02-15');
        });
    });

    describe('year boundaries', () => {
        it('should_roll_forward_across_new_year', () => {
            expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
            expect(addDaysToString('2026-12-31', 1)).toBe('2027-01-01');
        });
        it('should_roll_backward_across_new_year', () => {
            expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
            expect(addDaysToString('2027-01-01', -1)).toBe('2026-12-31');
        });
        it('should_add_twelve_months_as_one_year', () => {
            expect(addMonths('2026-06-30', 12)).toBe('2027-06-30');
            expect(addMonths('2026-06-30', -13)).toBe('2025-05-30');
        });
    });

    describe('leap and century years', () => {
        it('should_step_onto_the_leap_day', () => {
            expect(addDaysToString('2024-02-28', 1)).toBe('2024-02-29');
            expect(addDaysToString('2024-02-29', 1)).toBe('2024-03-01');
        });
        it('should_step_back_over_a_month_boundary', () => {
            expect(addDaysToString('2026-03-01', -1)).toBe('2026-02-28');
            expect(addDaysToString('2024-03-01', -1)).toBe('2024-02-29');
        });
        it('should_apply_the_century_rule', () => {
            expect(getMonthRange(2100, 2).daysInMonth).toBe(28);   // divisible by 100, not 400
            expect(getMonthRange(2000, 2).daysInMonth).toBe(29);   // divisible by 400
        });
        it('should_enumerate_a_leap_february', () => {
            const dates = getMonthDates(2024, 2);
            expect(dates).toHaveLength(29);
            expect(dates[28]).toBe('2024-02-29');
        });
    });

    describe('dayOfWeek numbering', () => {
        // ISO-8601: 1 = Monday .. 7 = Sunday. Callers rely on `dayOfWeek % 7` giving
        // 0 for Sunday, and on `dayOfWeek === 7` meaning Sunday.
        it('should_number_a_full_week_from_sunday', () => {
            expect([
                dow('2026-03-15'), dow('2026-03-16'), dow('2026-03-17'), dow('2026-03-18'),
                dow('2026-03-19'), dow('2026-03-20'), dow('2026-03-21'),
            ]).toEqual([7, 1, 2, 3, 4, 5, 6]);
        });
        it('should_map_sunday_to_zero_via_modulo', () => {
            expect(dow('2026-03-15') % 7).toBe(0);
        });
    });

    describe('getWeekRange', () => {
        it('should_return_the_same_day_when_given_a_sunday', () => {
            expect(getWeekRange('2026-03-15')).toEqual({ start: '2026-03-15', end: '2026-03-21' });
        });
        it('should_snap_back_from_a_saturday', () => {
            expect(getWeekRange('2026-03-21')).toEqual({ start: '2026-03-15', end: '2026-03-21' });
        });
        it('should_span_a_month_boundary', () => {
            expect(getWeekRange('2026-04-01')).toEqual({ start: '2026-03-29', end: '2026-04-04' });
        });
        it('should_span_a_year_boundary', () => {
            expect(getWeekRange('2027-01-01')).toEqual({ start: '2026-12-27', end: '2027-01-02' });
        });
    });

    describe('parsing', () => {
        it('should_reject_a_day_that_does_not_exist', () => {
            expect(() => parseLocalDate('2026-02-30')).toThrow();
            expect(() => parseLocalDate('2026-13-01')).toThrow();
        });
        it('should_take_the_date_part_of_a_timestamp', () => {
            expect(parseLocalDate('2026-03-15T09:30:00Z').toString()).toBe('2026-03-15');
        });
        it('should_accept_an_object_with_an_iso_toString', () => {
            const like = { toString: () => '2026-03-15T00:00' };
            expect(parseLocalDate(like).toString()).toBe('2026-03-15');
        });
        it('should_fall_back_to_today_for_falsy_input', () => {
            expect(parseLocalDate('').toString()).toBe(getCurrentDate());
            expect(parseLocalDate(undefined).toString()).toBe(getCurrentDate());
        });
        it('should_constrain_out_of_range_fields_in_getMonthRange', () => {
            expect(getMonthRange(2026, 2).end).toBe('2026-02-28');
        });
    });

    describe('parseTime', () => {
        it('should_parse_a_zero_padded_time', () => {
            expect(parseTime('09:30').toString()).toBe('09:30:00');
        });
        it('should_return_null_for_malformed_input', () => {
            expect(parseTime('25:00')).toBeNull();
            expect(parseTime('9:30')).toBeNull();
            expect(parseTime('')).toBeNull();
            expect(parseTime(null)).toBeNull();
        });
    });

    describe('timezone resolution', () => {
        it('should_differ_across_the_date_line', () => {
            // Kiritimati is UTC+14, Niue UTC-11: 25 hours apart, so they disagree daily.
            expect(getCurrentDate('Pacific/Kiritimati')).not.toBe(getCurrentDate('Pacific/Niue'));
        });
        it('should_roll_the_date_forward_in_tokyo', () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-03-15T16:00:00Z'));        // 01:00 JST on the 16th
            expect(getCurrentDate('UTC')).toBe('2026-03-15');
            expect(getCurrentDate('Asia/Tokyo')).toBe('2026-03-16');   // UTC+9
            expect(getCurrentDate('America/New_York')).toBe('2026-03-15');
        });
        it('should_report_midnight_as_00_00_not_24_00', () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-03-15T15:00:00Z'));        // 00:00 JST
            expect(getCurrentTime('Asia/Tokyo')).toBe('00:00');
        });
        it('should_reject_an_unknown_zone', () => {
            expect(() => getCurrentDate('Not/AZone')).toThrow();
        });
    });

    describe('relative-to-today comparisons', () => {
        it('should_classify_yesterday_today_and_tomorrow', () => {
            const today = getCurrentDate();
            expect(isToday(today)).toBe(true);
            expect(checkIfPast(addDaysToString(today, -1))).toBe(true);
            expect(isFuture(addDaysToString(today, 1))).toBe(true);
            expect(checkIfPast(today)).toBe(false);
            expect(isFuture(today)).toBe(false);
        });
    });
});
