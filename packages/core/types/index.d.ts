/**
 * steadycalendar — TypeScript declarations
 *
 * The package root: the scheduling core plus the rendering layer. For state and data
 * with no DOM, import from `steadycalendar/headless` instead.
 */

export * from './core.js';

import type { CalendarConfig, CalendarState, EventBus, DataBridge, PreferencesBridge, PluginManager, InternalEvent, CalendarPlugin } from './core.js';

/**
 * The calendar. `init()` resolves the container, loads data, and mounts the UI.
 * Pass `headless: true` to skip the mount.
 */
export class CalendarApp {
    readonly bus: EventBus;
    readonly state: CalendarState;
    readonly config: CalendarConfig;
    readonly dataBridge: DataBridge;
    readonly preferencesBridge: PreferencesBridge;
    readonly pluginManager: PluginManager;
    readonly viewManager: ViewManager | null;
    readonly toolbar: CalendarModule | null;
    readonly eventRenderer: EventRenderer | null;
    constructor(config?: CalendarConfig);
    init(): Promise<void>;
    getContainer(): HTMLElement | null;
    destroy(): void;
}

/**
 * Rendering modules, exported so a host can compose its own shell instead of using
 * CalendarApp's default mount. Each takes `(state, bus, config)` and exposes
 * `init(container)` / `destroy()`.
 */
export interface CalendarModule {
    init(container: HTMLElement): void;
    destroy(): void;
}

type ModuleCtor = new (state: CalendarState, bus: EventBus, config: CalendarConfig) => CalendarModule;

export class ViewManager implements CalendarModule {
    constructor(state: CalendarState, bus: EventBus, config: CalendarConfig);
    init(container: HTMLElement): void;
    getCurrentView(): CalendarModule | null;
    destroy(): void;
}

export const CalendarToolbar: ModuleCtor;
export const ResourceTimeGridView: ModuleCtor;
export const SimpleTimeGridView: ModuleCtor;
export const MonthView: ModuleCtor;
export const ListView: ModuleCtor;
export const DateHeaderRenderer: ModuleCtor;
export const PrivacyRenderer: ModuleCtor;
export const EventClickHandler: ModuleCtor;
export const SelectionHandler: ModuleCtor;
export const DragHandler: ModuleCtor;
export const ResizeHandler: ModuleCtor;
export const TouchHandler: ModuleCtor;

export class EventRenderer implements CalendarModule {
    constructor(state: CalendarState, bus: EventBus, config: CalendarConfig);
    init(container: HTMLElement): void;
    render(events: InternalEvent[]): void;
    getElement(eventId: string): HTMLElement | null;
    destroy(): void;
}

/** The toolbar title for a date and view duration. ViewManager publishes it as `title:updated`. */
export function formatViewTitle(
    dateStr: string,
    duration: 'day' | '3day' | 'week' | 'month',
    locale?: string,
): string;

export interface DragChanges {
    date: string;
    startTime: string;
    resourceId: string | null;
    previousResourceId: string | null;
}

export interface ResizeChanges {
    endTime: string;
}

export interface DragPersistenceOptions {
    /** Persist a move. Throwing reverts the element unless onError handles it. */
    onDrop?(event: InternalEvent, changes: DragChanges): Promise<void> | void;
    /** Persist a resize. */
    onResize?(event: InternalEvent, changes: ResizeChanges): Promise<void> | void;
    /** Return false to reject a move before it is persisted. */
    canDrop?(event: InternalEvent, target: {
        newDate: string;
        newTime: string;
        newResourceId: string | null;
        oldResourceId: string | null;
    }): boolean;
    /** Return false to reject a resize before it is persisted. */
    canResize?(event: InternalEvent, target: { newEndTime: string }): boolean;
    /** Called when persistence throws. Call revert() to restore the element. */
    onError?(error: unknown, event: InternalEvent, revert: () => void): void;
    /**
     * Raw `sourceData.status` values that may not be moved or resized. Cancelled events
     * are already blocked via the calendar's own statusResolver.
     */
    blockedStatuses?: string[];
}

/**
 * Persists drag and resize gestures by listening for `event:drop` and `event:resize`.
 * Cancelled events are reverted without a call; add more states via blockedStatuses.
 * A successful write emits `data:refresh`.
 */
export class DragPersistencePlugin implements CalendarPlugin {
    readonly name: 'drag-persistence';
    constructor(options?: DragPersistenceOptions);
    init(context: { state: any; bus: any; config: any }): void;
    destroy(): void;
}
