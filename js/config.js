export const API_BASE = (window.TVR_CONFIG && window.TVR_CONFIG.API_BASE) || 'https://tvr-with-manus.onrender.com';

// How many clicks on the site title (within CLICK_WINDOW_MS) reveal the
// hidden admin login. Matches the existing site's convention.
export const ADMIN_REVEAL_CLICKS = 5;
export const ADMIN_REVEAL_WINDOW_MS = 2500;

// How many special episodes show in the collapsed horizontal-scroll row
// before the visitor has to tap the tile to see the rest.
export const SPECIAL_COLLAPSED_COUNT = 6;

// Comment list polling interval while a viewer has an episode open.
export const COMMENT_POLL_MS = 8000;

// An episode counts as "New" if uploaded within this many hours.
export const NEW_BADGE_HOURS = 24;
