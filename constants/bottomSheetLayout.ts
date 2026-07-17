/**
 * Slide-up bottom sheet layout — digest detail, filters, quick settings, date picker, etc.
 * See docs/DESIGN-GUIDE.md (bottom sheet).
 */

/** Sheet shell max height — cap at 70% of the viewport (home digest, briefing, filters). */
export const BOTTOM_SHEET_MAX_HEIGHT = '70%' as const;

export const BOTTOM_SHEET_BACKDROP_COLOR = 'rgba(0,0,0,0.55)' as const;

/** Scroll region inside a capped sheet — shrink within the shell instead of a fixed px cap. */
export const BOTTOM_SHEET_SCROLL_STYLE = {
  flexGrow: 0,
  flexShrink: 1,
  minHeight: 0,
} as const;
