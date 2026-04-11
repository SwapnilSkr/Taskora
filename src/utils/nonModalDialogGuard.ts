/**
 * Radix `Dialog` with `modal={false}` closes on outside pointer/focus. Opening from a context menu
 * (or any control that tears down an overlay in the same gesture) often ends with that “outside”
 * event — the sheet/confirm would open and instantly dismiss without a short guard window.
 */
export const NON_MODAL_DIALOG_OUTSIDE_GUARD_MS = 450
