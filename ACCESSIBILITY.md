# Accessibility

**SolidCalendar is pointer-driven today. A keyboard user cannot focus, read, move, resize, or create an event.** If keyboard access is a requirement for you, this library is not ready, and this page exists so you find that out here rather than after integrating it.

This is a stated gap, not an oversight, and not a claim of partial conformance. There is no WCAG conformance claim of any level.

## What works

- **Toolbar controls are reachable.** Today, previous, next, the view and resource dropdowns, the resource filter, the privacy toggle, print, and add are native `<button>` elements, so they are in the tab order and activate with Enter and Space.
- **ARIA roles and state on the toolbar.** Dropdowns carry `role="listbox"` with `role="option"` and `aria-selected`; triggers carry `aria-haspopup` and `aria-expanded`, kept in sync. The privacy toggle carries `aria-pressed`. The toolbar itself carries `role="toolbar"` and a label.
- **The date title announces changes** via `aria-live="polite"`.
- **Every user-visible string is translatable**, so accessible names follow `config.translations` rather than being frozen in English.

## What does not

| Gap | Effect |
|---|---|
| Events have no `tabindex` | Cannot be focused. The entire grid is unreachable by keyboard. |
| Events have no `role` or accessible name | A screen reader announces nothing meaningful, even if focus could reach them. |
| No `:focus` or `:focus-visible` styles anywhere in the stylesheet | Even where focus lands, it is invisible. |
| Drag, resize, and slot selection are mouse and touch only | No keyboard path to move, resize, or create a booking. The only key handler in the codebase is Escape-to-cancel an in-flight mouse drag. |
| Dropdowns have no arrow-key navigation | The `role="listbox"` markup is declarative only; a screen reader announces a listbox that cannot be operated. There is no `aria-activedescendant`. |
| No focus management on open or close | Opening the view switcher, resource filter, or date picker does not move focus, and closing does not restore it. The date picker declares `aria-haspopup="dialog"` with no focus trap. |
| The grid has no table or grid semantics | No `role="grid"`, `columnheader`, or `gridcell`; no text alternative for business-hours shading, closed days, or the current-time indicator. |

## Roadmap

Sequenced so each step is independently useful. None of it is scheduled; contributions are welcome, and each item is a reasonable first pull request.

1. **Make events focusable and named.** `tabindex="0"`, an appropriate role, and an accessible name composed from the same normalised fields the card already renders. Enter and Space fire the existing `event:click` path.
2. **Focus styles.** `:focus-visible` rules for events, slots, and toolbar controls — currently the stylesheet has none at all.
3. **Operable dropdowns.** Arrow-key navigation, `aria-activedescendant`, focus moved on open and restored on close, Escape to dismiss. A focus trap for the date picker, which already claims to be a dialog.
4. **Grid semantics.** Roles and headers on the column structure, plus text alternatives for the shading and indicator states that are currently colour-only.
5. **A keyboard model for moving and resizing.** The largest piece, and it needs a design before code: something like Enter to grab, arrows to move by slot or column, Enter to drop, Escape to cancel — with live-region announcements as the position changes.

## Related

Two things are already handled and worth noting, because they are common failures elsewhere:

- **Colour is configurable, not fixed.** Resource colours come from your data, so contrast is under your control. `ColorUtils.getContrastTextColor` is exported and used for label contrast.
- **No motion.** There are no animations or transitions that would need a `prefers-reduced-motion` guard.

## Reporting

Accessibility issues are ordinary bugs — open an issue. If you have tested with a screen reader and can describe what was announced, please include it; that detail is hard to reconstruct second-hand.
