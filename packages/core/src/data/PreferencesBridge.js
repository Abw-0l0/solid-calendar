/**
 * PreferencesBridge — Adapter for calendar preference persistence
 */
import { PREFERENCE_SAVE_DELAY } from '../core/CalendarConfig.js';

export default class PreferencesBridge {
    constructor(state, bus, config = {}) {
        this.state = state;
        this.bus = bus;
        this.config = config;
        this._saveTimer = null;
        this._unsubscribers = [];
    }

    async init() {
        await this._loadPreferences();
        this._unsubscribers.push(
            this.bus.on('date:changed', () => this._debouncedSave()),
            this.bus.on('view:changed', () => this._debouncedSave()),
            this.bus.on('resource:changed', () => this._debouncedSave()),
            this.bus.on('filter:changed', () => this._debouncedSave())
        );
    }

    async _loadPreferences() {
        const contextId = this.config.contextId;
        if (!contextId) return;
        const fetchFn = this.config.preferences?.fetch ?? this.config.callbacks?.fetchPreferences;
        if (typeof fetchFn !== 'function') return;
        try {
            const result = await fetchFn(contextId);
            if (result.success && result.preferences) this.state.applyPreferences(result.preferences);
        } catch (err) {
            console.error('[SteadyCalendar:PreferencesBridge] Failed to load preferences:', err);
        }
    }

    _debouncedSave() {
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => this._save(), PREFERENCE_SAVE_DELAY);
    }

    async _save() {
        const contextId = this.config.contextId;
        if (!contextId) return;
        const saveFn = this.config.preferences?.save ?? this.config.callbacks?.savePreferences;
        if (typeof saveFn !== 'function') return;
        try {
            await saveFn(contextId, this.state.toPreferences());
        } catch (err) {
            console.error('[SteadyCalendar:PreferencesBridge] Failed to save preferences:', err);
        }
    }

    destroy() {
        if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
        for (const unsub of this._unsubscribers) unsub();
        this._unsubscribers = [];
    }
}
