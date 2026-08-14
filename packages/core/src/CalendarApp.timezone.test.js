import { describe, it, expect, afterEach } from 'vitest';
import CalendarApp from './CalendarApp.js';
import { setDefaultTimezone, getDefaultTimezone, getCurrentDate } from './utils/temporal.js';

describe('CalendarApp timezone configuration', () => {
    afterEach(() => { setDefaultTimezone(null); });

    it('should_apply_config_timezone_before_state_reads_today', () => {
        // Kiritimati is UTC+14 and Niue UTC-11 — 25 hours apart, so they never agree
        // on the current date. If the zone were applied after CalendarState is built,
        // both would report the same day and this would silently pass.
        const east = new CalendarApp({ timezone: 'Pacific/Kiritimati' });
        const eastDate = east.state.currentDate;

        const west = new CalendarApp({ timezone: 'Pacific/Niue' });
        const westDate = west.state.currentDate;

        expect(eastDate).toBe(getCurrentDate('Pacific/Kiritimati'));
        expect(westDate).toBe(getCurrentDate('Pacific/Niue'));
        expect(eastDate).not.toBe(westDate);
    });

    it('should_default_to_the_system_zone_when_none_is_configured', () => {
        const systemZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        new CalendarApp({});
        expect(getDefaultTimezone()).toBe(systemZone);
    });

    it('should_keep_the_current_zone_and_warn_on_an_unknown_one', () => {
        setDefaultTimezone('Asia/Tokyo');
        const kept = setDefaultTimezone('Not/AZone');
        expect(kept).toBe('Asia/Tokyo');
        expect(getDefaultTimezone()).toBe('Asia/Tokyo');
    });
});
