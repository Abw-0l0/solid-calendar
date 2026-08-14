/**
 * solidcalendar/headless — TypeScript declarations
 *
 * State, data and utilities, with no rendering layer.
 *
 * CalendarApp is deliberately absent: it statically imports the views, toolbar and
 * interaction handlers, so re-exporting it here would pull the whole rendering layer
 * back into your bundle and this entry point would save nothing. Compose the pieces
 * directly, or import CalendarApp from the package root with `{ headless: true }`.
 */

export * from './core.js';
