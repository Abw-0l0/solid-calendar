// Core
export { default as CalendarApp } from './CalendarApp.js';
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
export { default as DragPersistencePlugin } from './plugins/DragPersistencePlugin.js';

// Utilities
export * as temporal from './utils/temporal.js';
export * as ColorUtils from './utils/ColorUtils.js';

// Rendering — exported so a host can compose its own shell instead of using
// CalendarApp's default mount. Each takes (state, bus, config) and exposes
// init(container) / destroy(), with two documented exceptions: DatePicker takes
// init(triggerEl, mountEl).
// The internal builders are deliberately not exported; their contracts are unstable.
export { default as ViewManager } from './views/ViewManager.js';
export { default as ResourceTimeGridView } from './views/ResourceTimeGridView.js';
export { default as SimpleTimeGridView } from './views/SimpleTimeGridView.js';
export { default as MonthView } from './views/MonthView.js';
export { default as ListView } from './views/ListView.js';
export { formatViewTitle } from './views/formatTitle.js';

export { default as CalendarToolbar } from './toolbar/CalendarToolbar.js';

export { default as EventRenderer } from './events/EventRenderer.js';
export { default as EventClickHandler } from './events/EventClickHandler.js';
export { default as SelectionHandler } from './events/SelectionHandler.js';
export { default as DragHandler } from './events/DragHandler.js';
export { default as ResizeHandler } from './events/ResizeHandler.js';
export { default as TouchHandler } from './events/TouchHandler.js';

export { default as PrivacyRenderer } from './rendering/PrivacyRenderer.js';
export { default as DateHeaderRenderer } from './rendering/DateHeaderRenderer.js';

// Holiday resolution, for hosts implementing a custom provider.
export * as holidays from './utils/holidays.js';
