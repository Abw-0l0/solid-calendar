/**
 * steadycalendar-pro — TypeScript declarations
 */
import type { CalendarPlugin, HolidayProvider, InternalEvent } from 'steadycalendar';

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

/**
 * Japanese public holidays, cached per year.
 *
 * Implements both CalendarPlugin and HolidayProvider, so passing it in `plugins` is
 * enough — CalendarApp adopts it as `config.holidayProvider` automatically.
 */
export class JapaneseHolidayProvider implements CalendarPlugin, HolidayProvider {
    readonly name: 'japanese-holidays';
    init(context: { config: { locale?: string } }): void;
    getHoliday(dateStr: string): { name: string; name_en?: string } | null;
    getHolidayName(dateStr: string, locale?: string): string;
    preload(startDate: string, endDate: string): void;
    clearCache(): void;
    destroy(): void;
}
