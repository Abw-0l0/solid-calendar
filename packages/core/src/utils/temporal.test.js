import { describe, it, expect } from 'vitest';
import {
    convertTimeToMinutes, convertMinutesToTime, addMinutesToTime,
    timeDiff, timeDiffDetailed,
    addDaysToString, addMonths,
    getMonthRange, getWeekRange, getMonthDates,
    parseLocalDate,
    formatDate, formatDateJapanese, formatTime,
    isSameDay, isBefore, isAfter, isWithinRange,
    getCurrentDate, getCurrentTime,
    getWeekdayNames, getLocale,
    WEEKDAYS_JA_SHORT, WEEKDAYS_EN_SHORT,
} from './temporal.js';

describe('temporal utilities', () => {
    describe('convertTimeToMinutes', () => {
        it('should_convert_midnight', () => {
            expect(convertTimeToMinutes('00:00')).toBe(0);
        });
        it('should_convert_noon', () => {
            expect(convertTimeToMinutes('12:00')).toBe(720);
        });
        it('should_convert_end_of_day', () => {
            expect(convertTimeToMinutes('23:59')).toBe(1439);
        });
        it('should_handle_null', () => {
            expect(convertTimeToMinutes(null)).toBe(0);
        });
    });

    describe('convertMinutesToTime', () => {
        it('should_convert_0', () => {
            expect(convertMinutesToTime(0)).toBe('00:00');
        });
        it('should_convert_720', () => {
            expect(convertMinutesToTime(720)).toBe('12:00');
        });
        it('should_wrap_past_midnight', () => {
            expect(convertMinutesToTime(1500)).toBe('01:00');
        });
        it('should_handle_negative', () => {
            expect(convertMinutesToTime(-60)).toBe('23:00');
        });
    });

    describe('addMinutesToTime', () => {
        it('should_add_minutes', () => {
            expect(addMinutesToTime('09:00', 30)).toBe('09:30');
        });
        it('should_wrap_midnight', () => {
            expect(addMinutesToTime('23:30', 60)).toBe('00:30');
        });
    });

    describe('timeDiff', () => {
        it('should_compute_positive_diff', () => {
            expect(timeDiff('09:00', '10:30')).toBe(90);
        });
        it('should_compute_negative_diff', () => {
            expect(timeDiff('10:30', '09:00')).toBe(-90);
        });
    });

    describe('timeDiffDetailed', () => {
        it('should_return_hours_and_minutes', () => {
            const result = timeDiffDetailed('09:00', '10:30');
            expect(result).toEqual({ hours: 1, minutes: 30, totalMinutes: 90 });
        });
    });

    describe('addDaysToString', () => {
        it('should_add_days', () => {
            expect(addDaysToString('2026-03-15', 3)).toBe('2026-03-18');
        });
        it('should_cross_month_boundary', () => {
            expect(addDaysToString('2026-03-30', 3)).toBe('2026-04-02');
        });
        it('should_handle_zero', () => {
            expect(addDaysToString('2026-03-15', 0)).toBe('2026-03-15');
        });
    });

    describe('addMonths', () => {
        it('should_add_months', () => {
            expect(addMonths('2026-01-15', 2)).toBe('2026-03-15');
        });
    });

    describe('getMonthRange', () => {
        it('should_return_correct_range', () => {
            const range = getMonthRange(2026, 3);
            expect(range.start).toBe('2026-03-01');
            expect(range.end).toBe('2026-03-31');
            expect(range.daysInMonth).toBe(31);
        });
        it('should_handle_february', () => {
            const range = getMonthRange(2026, 2);
            expect(range.daysInMonth).toBe(28);
        });
        it('should_handle_leap_year', () => {
            const range = getMonthRange(2024, 2);
            expect(range.daysInMonth).toBe(29);
        });
    });

    describe('getWeekRange', () => {
        it('should_return_sunday_to_saturday', () => {
            const range = getWeekRange('2026-03-18'); // Wednesday
            expect(range.start).toBe('2026-03-15'); // Sunday
            expect(range.end).toBe('2026-03-21'); // Saturday
        });
    });

    describe('getMonthDates', () => {
        it('should_return_all_dates', () => {
            const dates = getMonthDates(2026, 3);
            expect(dates.length).toBe(31);
            expect(dates[0]).toBe('2026-03-01');
            expect(dates[30]).toBe('2026-03-31');
        });
    });

    describe('parseLocalDate', () => {
        it('should_parse_date_string', () => {
            const date = parseLocalDate('2026-03-15');
            expect(date.year).toBe(2026);
            expect(date.month).toBe(3);
            expect(date.day).toBe(15);
        });
        it('should_return_today_for_null', () => {
            const date = parseLocalDate(null);
            expect(date.year).toBeGreaterThan(2020);
        });
    });

    describe('formatDate', () => {
        it('should_format_english', () => {
            const result = formatDate('2026-03-15', 'en-US');
            expect(result).toContain('2026/03/15');
            expect(result).toContain('Sun');
        });
        it('should_format_japanese', () => {
            const result = formatDate('2026-03-15', 'ja-JP');
            expect(result).toContain('2026/03/15');
            expect(result).toContain('日');
        });
    });

    describe('formatDateJapanese', () => {
        it('should_format_in_japanese_style', () => {
            const result = formatDateJapanese('2026-03-15');
            expect(result).toContain('2026年');
            expect(result).toContain('3月');
            expect(result).toContain('15日');
        });
    });

    describe('formatTime', () => {
        it('should_format_time', () => {
            expect(formatTime('09:30')).toBe('09:30');
        });
        it('should_extract_from_iso', () => {
            expect(formatTime('2026-03-15T09:30:00')).toBe('09:30');
        });
        it('should_handle_empty', () => {
            expect(formatTime('')).toBe('');
        });
    });

    describe('isSameDay', () => {
        it('should_return_true_for_same_day', () => {
            expect(isSameDay('2026-03-15', '2026-03-15')).toBe(true);
        });
        it('should_return_false_for_different_days', () => {
            expect(isSameDay('2026-03-15', '2026-03-16')).toBe(false);
        });
    });

    describe('isBefore / isAfter', () => {
        it('should_compare_dates', () => {
            expect(isBefore('2026-03-15', '2026-03-16')).toBe(true);
            expect(isAfter('2026-03-16', '2026-03-15')).toBe(true);
            expect(isBefore('2026-03-15', '2026-03-15')).toBe(false);
        });
    });

    describe('isWithinRange', () => {
        it('should_be_inclusive', () => {
            expect(isWithinRange('2026-03-15', '2026-03-15', '2026-03-20')).toBe(true);
            expect(isWithinRange('2026-03-20', '2026-03-15', '2026-03-20')).toBe(true);
            expect(isWithinRange('2026-03-17', '2026-03-15', '2026-03-20')).toBe(true);
        });
        it('should_return_false_outside_range', () => {
            expect(isWithinRange('2026-03-14', '2026-03-15', '2026-03-20')).toBe(false);
            expect(isWithinRange('2026-03-21', '2026-03-15', '2026-03-20')).toBe(false);
        });
    });

    describe('getCurrentDate / getCurrentTime', () => {
        it('should_return_valid_date_string', () => {
            const date = getCurrentDate();
            expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
        it('should_return_valid_time_string', () => {
            const time = getCurrentTime();
            expect(time).toMatch(/^\d{2}:\d{2}$/);
        });
    });

    describe('getWeekdayNames', () => {
        it('should_return_english_names', () => {
            expect(getWeekdayNames('en-US')).toBe(WEEKDAYS_EN_SHORT);
        });
        it('should_return_japanese_names', () => {
            expect(getWeekdayNames('ja-JP')).toBe(WEEKDAYS_JA_SHORT);
        });
    });

    describe('getLocale', () => {
        it('should_normalize_locale', () => {
            expect(getLocale('ja')).toBe('ja-JP');
            expect(getLocale('en')).toBe('en-US');
            expect(getLocale('ja_JP')).toBe('ja-JP');
        });
    });
});
