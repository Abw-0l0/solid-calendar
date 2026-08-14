import { describe, it, expect, vi } from 'vitest';
import CalendarState from './CalendarState.js';
import EventBus from './EventBus.js';

describe('CalendarState', () => {
    function createState() {
        const bus = new EventBus();
        const state = new CalendarState(bus);
        return { bus, state };
    }

    it('should_have_default_values', () => {
        const { state } = createState();
        expect(state.currentView).toBe('resourceTimeGridDay');
        expect(state.currentResourceMode).toBe('primaryView');
        expect(state.privacyMode).toBe(false);
        expect(state.isLoading).toBe(false);
        expect(state.resources).toEqual([]);
        expect(state.events).toEqual([]);
    });

    it('should_emit_date_changed', () => {
        const { bus, state } = createState();
        const handler = vi.fn();
        bus.on('date:changed', handler);
        state.setCurrentDate('2026-03-15');
        expect(handler).toHaveBeenCalledWith({ date: '2026-03-15' });
        expect(state.currentDate).toBe('2026-03-15');
    });

    it('should_not_emit_if_date_unchanged', () => {
        const { bus, state } = createState();
        const handler = vi.fn();
        const initialDate = state.currentDate;
        bus.on('date:changed', handler);
        state.setCurrentDate(initialDate);
        expect(handler).not.toHaveBeenCalled();
    });

    it('should_emit_view_changed', () => {
        const { bus, state } = createState();
        const handler = vi.fn();
        bus.on('view:changed', handler);
        state.setCurrentView('resourceTimeGridWeek');
        expect(handler).toHaveBeenCalledWith({
            view: 'resourceTimeGridWeek',
            resourceMode: 'primaryView'
        });
    });

    it('should_emit_events_loaded', () => {
        const { bus, state } = createState();
        const handler = vi.fn();
        bus.on('events:loaded', handler);
        const events = [{ id: '1', title: 'Test' }];
        state.setEvents(events);
        expect(handler).toHaveBeenCalledWith({ events });
    });

    it('should_compute_date_range_for_day_view', () => {
        const { state } = createState();
        state.setCurrentDate('2026-03-15');
        state.setCurrentView('resourceTimeGridDay');
        const range = state.dateRange;
        expect(range.start).toBe('2026-03-15');
        expect(range.end).toBe('2026-03-15');
    });

    it('should_compute_date_range_for_week_view', () => {
        const { state } = createState();
        state.setCurrentDate('2026-03-15');
        state.setCurrentView('resourceTimeGridWeek');
        const range = state.dateRange;
        expect(range.start).toBe('2026-03-15');
        expect(range.end).toBe('2026-03-21');
    });

    it('should_cache_date_range', () => {
        const { state } = createState();
        state.setCurrentDate('2026-03-15');
        const range1 = state.dateRange;
        const range2 = state.dateRange;
        expect(range1).toBe(range2);
    });

    it('should_invalidate_cache_on_date_change', () => {
        const { state } = createState();
        const range1 = state.dateRange;
        state.setCurrentDate('2026-04-01');
        const range2 = state.dateRange;
        expect(range1).not.toBe(range2);
    });

    it('should_apply_preferences', () => {
        const { state } = createState();
        state.applyPreferences({
            viewType: 'resourceTimeGridWeek',
            date: '2026-06-01',
            resourceFilters: ['a', 'b'],
            resourceMode: 'integratedView'
        });
        expect(state.currentView).toBe('resourceTimeGridWeek');
        expect(state.currentDate).toBe('2026-06-01');
        expect(state.resourceFilters).toEqual(['a', 'b']);
        expect(state.currentResourceMode).toBe('integratedView');
    });

    it('should_reconcile_flat_view_with_resource_view', () => {
        const { state } = createState();
        state.applyPreferences({
            viewType: 'resourceTimeGridDay',
            resourceMode: 'flatView'
        });
        // flatView needs non-resource view
        expect(state.currentView).toBe('timeGridDay');
    });

    it('should_export_preferences', () => {
        const { state } = createState();
        state.setCurrentDate('2026-05-01');
        state.setCurrentView('resourceTimeGridWeek');
        state.setResourceFilters(['x']);
        const prefs = state.toPreferences();
        expect(prefs).toEqual({
            viewType: 'resourceTimeGridWeek',
            date: '2026-05-01',
            resourceFilters: ['x'],
            resourceMode: 'primaryView'
        });
    });

    it('should_set_business_hours', () => {
        const { state } = createState();
        const hours = { 1: { start: '09:00', end: '17:00' } };
        state.setBusinessHours(hours);
        expect(state.businessHours).toBe(hours);
    });

    it('should_emit_privacy_changed', () => {
        const { bus, state } = createState();
        const handler = vi.fn();
        bus.on('privacy:changed', handler);
        state.setPrivacyMode(true);
        expect(handler).toHaveBeenCalledWith({ enabled: true });
    });

    it('should_emit_card_settings_changed', () => {
        const { bus, state } = createState();
        const handler = vi.fn();
        bus.on('cardSettings:changed', handler);
        const settings = { textItems: [], badgeItems: [] };
        state.setCardDisplaySettings(settings);
        expect(handler).toHaveBeenCalledWith({ settings });
    });
});
