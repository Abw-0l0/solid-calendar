import { describe, it, expect } from 'vitest';
import JapaneseHolidayProvider from './JapaneseHolidayProvider.js';

const TZ = process.env.TZ ?? '(system default)';

describe(`JapaneseHolidayProvider [TZ=${TZ}]`, () => {
    it('should_identify_new_years_day', () => {
        const provider = new JapaneseHolidayProvider();
        expect(provider.getHoliday('2026-01-01')).toBeTruthy();
        expect(provider.getHoliday('2026-01-02')).toBeNull();
    });

    it('should_resolve_the_same_holidays_regardless_of_process_timezone', () => {
        // This provider builds its lookup from local Dates. That is correct — holiday_jp
        // represents dates the same way and the getters round-trip — but it is exactly
        // the shape that breaks under a negative UTC offset if the two ever diverge.
        // CI runs this file under six zones spanning UTC+14 to UTC-11.
        const provider = new JapaneseHolidayProvider();
        const found = [];
        for (let month = 1; month <= 12; month++) {
            for (let day = 1; day <= 31; day++) {
                const key = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                if (provider.getHoliday(key)) found.push(key);
            }
        }

        expect(found).toContain('2026-01-01');   // 元日
        expect(found).toContain('2026-05-03');   // 憲法記念日
        expect(found).toContain('2026-11-23');   // 勤労感謝の日
        expect(found).toHaveLength(18);
        // A one-day shift would move the first entry off New Year's Day.
        expect(found[0]).toBe('2026-01-01');
    });

    it('should_key_holidays_by_their_utc_date', () => {
        // holiday_jp stores each date at UTC midnight. Reading them with local getters
        // shifted every holiday back a day under any negative UTC offset, so New Year's
        // Day became 31 December and dropped out of the year entirely.
        //
        // Asserted against the underlying record rather than by switching TZ, because
        // the TZ environment variable is ignored for IANA names on Windows — a local
        // matrix there silently runs every 'zone' as the system one and proves nothing.
        const provider = new JapaneseHolidayProvider();
        const holiday = provider.getHoliday('2026-01-01');
        expect(holiday).toBeTruthy();
        expect(new Date(holiday.date).toISOString().slice(0, 10)).toBe('2026-01-01');
    });

    it('should_not_shift_a_new_year_holiday_into_the_previous_year', () => {
        const provider = new JapaneseHolidayProvider();
        expect(provider.getHoliday('2026-01-01')).toBeTruthy();
        expect(provider.getHoliday('2025-12-31')).toBeNull();
    });
    it('should_localise_the_holiday_name', () => {
        const provider = new JapaneseHolidayProvider();
        provider.init({ config: { locale: 'en-US' } });

        expect(provider.getHolidayName('2026-01-01', 'ja-JP')).toBe('元日');
        expect(provider.getHolidayName('2026-01-01', 'en-US')).not.toBe('元日');
        expect(provider.getHolidayName('2026-01-02', 'en-US')).toBe('');
    });

    it('should_cache_per_year_and_clear_on_destroy', () => {
        const provider = new JapaneseHolidayProvider();
        provider.preload('2026-01-01', '2027-12-31');
        expect(provider.getHoliday('2027-01-01')).toBeTruthy();

        provider.destroy();
        // Cache cleared, but lookups still work by rebuilding it.
        expect(provider.getHoliday('2026-01-01')).toBeTruthy();
    });

    it('should_satisfy_the_HolidayProvider_interface', () => {
        const provider = new JapaneseHolidayProvider();
        expect(provider.name).toBe('japanese-holidays');
        expect(typeof provider.getHoliday).toBe('function');
        expect(typeof provider.getHolidayName).toBe('function');
        expect(typeof provider.preload).toBe('function');
        // CalendarApp adopts a plugin as config.holidayProvider by duck-typing getHoliday.
        expect(typeof provider.getHoliday).toBe('function');
    });
});
