/**
 * Payload types for the events SteadyCalendar publishes on its bus.
 *
 * The library ships hand-written declarations for its own surface (`CalendarConfig`,
 * `InternalEvent`, `CalendarState`, …) but not for the bus payloads — `EventBus.on`
 * is untyped by design, since a plugin may emit anything. These interfaces name the
 * payloads the wrapper re-emits as Angular outputs, so a consumer gets real types on
 * `(eventDrop)` instead of `any`.
 *
 * Sourced from the event table in the library README and verified against the
 * emitting call sites.
 */
import type { InternalEvent, ResourceMode } from 'steadycalendar';

/** `slot:select` and `slot:click`, normalised by CalendarApp into one shape. */
export interface SlotSelectDetail {
  date: string;
  startTime: string;
  /** Null for a click; a time for a drag across slots. */
  endTime: string | null;
  /** Null in the non-resource views, which have no column identity. */
  resourceId: string | null;
}

/** `event:drop` — a booking dragged to a new time, column or date. */
export interface EventDropDetail {
  event: InternalEvent;
  newDate: string;
  newTime: string;
  newResourceId: string | null;
  oldResourceId: string | null;
  /** Restores the element. Call it to reject the move. */
  revert: () => void;
}

/** `event:resize` — a booking's end dragged. */
export interface EventResizeDetail {
  event: InternalEvent;
  newEndTime: string;
  revert: () => void;
}

/** `view:changed` — carries the resource mode too, since the two are reconciled together. */
export interface ViewChangeDetail {
  view: string;
  resourceMode: ResourceMode;
}

/** `event:click` — the element is supplied so a host can anchor a popover to it. */
export interface EventClickDetail {
  event: InternalEvent;
  element: HTMLElement;
}
