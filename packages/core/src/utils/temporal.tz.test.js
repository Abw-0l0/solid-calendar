/**
 * Timezone and DST behaviour.
 *
 * Calendar dates are civil dates: 'the day after 2026-03-07' is 2026-03-08 everywhere,
 * regardless of whether the local day was 23, 24 or 25 hours long. That only holds if
 * every arithmetic operation runs on a UTC anchor. An implementation built on local-time
 * Date construction passes under TZ=UTC and fails in America/New_York or Australia/Sydney,
 * which is why CI runs this suite under six zones.
 *
 * The zones that actually find bugs: America/Santiago transitions at local midnight (so
 * local midnight does not exist on that date), and Pacific/Kiritimati is UTC+14.
 */
import { describe, it, expect } from 'vitest';
import {
    parseLocalDate, addDaysToString, addMonths, getWeekRange, getMonthDates, isSameDay,
} from './temporal.js';

const TZ = process.env.TZ ?? '(system default)';

describe(`date arithmetic is timezone-independent [TZ=${TZ}]`, () => {
    describe('crossing a DST boundary', () => {
        // US spring-forward 2026-03-08 (local day is 23 hours).
        it('should_step_across_us_spring_forward', () => {
            expect(addDaysToString('2026-03-07', 1)).toBe('2026-03-08');
            expect(addDaysToString('2026-03-08', 1)).toBe('2026-03-09');
            expect(addDaysToString('2026-03-09', -1)).toBe('2026-03-08');
        });

        // US fall-back 2026-11-01 (local day is 25 hours).
        it('should_step_across_us_fall_back', () => {
            expect(addDaysToString('2026-10-31', 1)).toBe('2026-11-01');
            expect(addDaysToString('2026-11-01', 1)).toBe('2026-11-02');
        });

        // Southern-hemisphere transition, opposite direction to the northern one.
        it('should_step_across_sydney_dst', () => {
            expect(addDaysToString('2026-10-03', 1)).toBe('2026-10-04');
            expect(addDaysToString('2026-04-04', 1)).toBe('2026-04-05');
        });

        // Santiago springs forward at 00:00, so local midnight is skipped entirely.
        // A local-midnight anchor silently yields 01:00 and can round to the wrong day.
        it('should_round_trip_a_date_whose_local_midnight_does_not_exist', () => {
            expect(parseLocalDate('2026-09-06').toString()).toBe('2026-09-06');
            expect(addDaysToString('2026-09-05', 1)).toBe('2026-09-06');
            expect(addDaysToString('2026-09-06', 1)).toBe('2026-09-07');
        });
    });

    describe('longer spans are unaffected by transitions', () => {
        it('should_add_a_month_across_a_transition', () => {
            expect(addMonths('2026-02-15', 1)).toBe('2026-03-15');   // spans US spring-forward
            expect(addMonths('2026-10-15', 1)).toBe('2026-11-15');   // spans US fall-back
        });

        it('should_produce_364_days_of_offset_over_a_year_of_weeks', () => {
            let date = '2026-01-04';                                  // a Sunday
            for (let i = 0; i < 52; i++) date = addDaysToString(date, 7);
            expect(date).toBe('2027-01-03');
        });

        it('should_keep_a_week_range_exactly_seven_days_wide', () => {
            for (const iso of ['2026-03-08', '2026-11-01', '2026-09-06', '2026-10-04']) {
                const { start, end } = getWeekRange(iso);
                expect(addDaysToString(start, 6)).toBe(end);
            }
        });

        it('should_enumerate_every_day_of_a_month_containing_a_transition', () => {
            const march = getMonthDates(2026, 3);
            expect(march).toHaveLength(31);
            expect(march[0]).toBe('2026-03-01');
            expect(march[30]).toBe('2026-03-31');
            // No duplicates and no gaps, which is how an off-by-an-hour bug shows up.
            expect(new Set(march).size).toBe(31);
        });
    });

    describe('comparisons', () => {
        it('should_treat_a_transition_date_as_equal_to_itself', () => {
            expect(isSameDay('2026-03-08', '2026-03-08')).toBe(true);
            expect(isSameDay('2026-03-08', '2026-03-09')).toBe(false);
        });
    });
});
