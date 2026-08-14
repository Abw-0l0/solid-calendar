/**
 * Headless entry point: state, data and utilities, with no rendering layer.
 *
 * 8.9 kB gzip against 27.1 kB for the package root. Use it when you render the
 * calendar yourself and only want the scheduling core.
 *
 * CalendarApp is deliberately absent. It statically imports the views, toolbar and
 * interaction handlers, so re-exporting it here would pull the whole rendering layer
 * back into your bundle and this entry point would save nothing. Compose the pieces
 * directly instead:
 *
 *   const bus = new EventBus();
 *   const state = new CalendarState(bus);
 *   const data = new DataBridge(state, bus, { dataSource });
 *   data.init();
 *   bus.on('events:loaded', ({ events }) => render(events));
 *   await data.loadEvents();
 *
 * If you want CalendarApp's orchestration without any DOM, import it from the package
 * root and pass `{ headless: true }` — that skips the UI mount but does not shrink the
 * bundle, because the rendering code is still statically reachable.
 */

// Core
export { default as EventBus } from './core/EventBus.js';
export { default as CalendarState } from './core/CalendarState.js';
export * from './core/CalendarConfig.js';
export { DEFAULT_FIELD_MAP, HEALTHCARE_FIELD_MAP } from './core/FieldMap.js';
export { DEFAULT_TRANSLATIONS, JA_TRANSLATIONS, translate } from './core/Translations.js';

// Data adapters
export { default as DataBridge } from './data/DataBridge.js';
export { default as PreferencesBridge } from './data/PreferencesBridge.js';

// Events
export { default as EventMapper } from './events/EventMapper.js';

// Plugins
export { default as PluginManager } from './plugins/PluginManager.js';

// Utilities
export * as temporal from './utils/temporal.js';
export * as ColorUtils from './utils/ColorUtils.js';
// Pure lookup over plain state and config objects, with no imports of its own — the
// declarations always claimed it was here, and computing availability without being able
// to ask whether a date is a holiday was the gap that made the claim worth honouring.
export * as holidays from './utils/holidays.js';
