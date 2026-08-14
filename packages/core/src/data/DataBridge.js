/**
 * DataBridge — Fetches calendar data from a configurable data source
 *
 * Supports URL-based or function-based data sources.
 */
import EventMapper from '../events/EventMapper.js';

const STATIC_CACHE_MS = 30 * 60 * 1000;
const EVENTS_CACHE_MS = 5 * 60 * 1000;
const FETCH_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' };

export default class DataBridge {
    constructor(state, bus, config = {}) {
        this.state = state;
        this.bus = bus;
        this.config = config;
        this._staticData = null;
        this._staticTimestamp = 0;
        this._eventsCache = null;
        this._eventsCacheRange = null;
        this._eventsTimestamp = 0;
        this._unsubscribers = [];
        this._loadEventsPending = false;
        this._eventMapper = new EventMapper(state, bus, config);
    }

    init() {
        const debouncedLoad = () => {
            if (!this._loadEventsPending) {
                this._loadEventsPending = true;
                queueMicrotask(() => { this._loadEventsPending = false; this.loadEvents(); });
            }
        };
        this._unsubscribers.push(
            this.bus.on('date:changed', debouncedLoad),
            this.bus.on('view:changed', debouncedLoad),
            this.bus.on('resource:changed', debouncedLoad),
            this.bus.on('data:refresh', () => this.refresh())
        );
    }

    async loadStaticData() {
        const now = Date.now();
        if (this._staticData && now - this._staticTimestamp < STATIC_CACHE_MS) return this._staticData;
        try {
            this.state.setLoading(true);
            const ds = this.config.dataSource;
            let data;
            if (typeof ds?.fetchResources === 'function') {
                data = await ds.fetchResources();
            } else {
                const url = ds?.resourcesUrl;
                if (!url) throw new Error('No resource data source configured');
                const r = await fetch(url, { headers: FETCH_HEADERS });
                if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
                data = await r.json();
            }
            this._staticData = data;
            this._staticTimestamp = now;
            return data;
        } catch (err) {
            console.error('[SolidCalendar:DataBridge] Failed to load static data:', err);
            throw err;
        } finally {
            this.state.setLoading(false);
        }
    }

    async loadEvents() {
        const { start, end } = this.state.dateRange;
        try {
            this.state.setLoading(true);
            if (!this._staticData) await this.loadStaticData();
            const rawEvents = await this._fetchEvents(start, end);
            const events = this._eventMapper.mapAll(rawEvents);
            this.state.setEvents(events);
        } catch (err) {
            console.error('[SolidCalendar:DataBridge] Failed to load events:', err);
        } finally {
            this.state.setLoading(false);
        }
    }

    async _fetchEvents(startDate, endDate) {
        const now = Date.now();
        const rangeKey = `${startDate}_${endDate}`;
        if (this._eventsCache && this._eventsCacheRange === rangeKey && now - this._eventsTimestamp < EVENTS_CACHE_MS) {
            return this._eventsCache;
        }
        const ds = this.config.dataSource;
        let events;
        if (typeof ds?.fetchEvents === 'function') {
            events = await ds.fetchEvents({ start: startDate, end: endDate });
        } else {
            const url = ds?.eventsUrl;
            if (!url) throw new Error('No events data source configured');
            const r = await fetch(`${url}?start_date=${startDate}&end_date=${endDate}`, { headers: FETCH_HEADERS });
            if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
            const data = await r.json();
            events = data.events ?? data;
        }
        this._eventsCache = events;
        this._eventsCacheRange = rangeKey;
        this._eventsTimestamp = now;
        return events;
    }

    async refresh(refreshStatic = false) {
        this._eventsCache = null;
        this._eventsCacheRange = null;
        this._eventsTimestamp = 0;
        if (refreshStatic) { this._staticData = null; this._staticTimestamp = 0; }
        await this.loadEvents();
    }

    getStaticData() { return this._staticData; }

    destroy() {
        for (const unsub of this._unsubscribers) unsub();
        this._unsubscribers = [];
    }
}
