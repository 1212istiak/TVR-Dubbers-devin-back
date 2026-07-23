export function showToast(message, duration = 2600) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('show'), duration);
}

// Stable per-browser id used for "one reaction per visitor" and resume-watching.
export function getVisitorId() {
  let id = localStorage.getItem('tvr_visitor_id');
  if (!id) {
    id = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('tvr_visitor_id', id);
  }
  return id;
}

export function debounce(fn, wait = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function timeAgo(isoOrSqlString) {
  if (!isoOrSqlString) return '';
  const normalized = isoOrSqlString.includes('T') ? isoOrSqlString : isoOrSqlString.replace(' ', 'T') + 'Z';
  const then = new Date(normalized).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.max(0, (Date.now() - then) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 2592000) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(normalized).toLocaleDateString();
}

export function hoursSince(isoOrSqlString) {
  if (!isoOrSqlString) return Infinity;
  const normalized = isoOrSqlString.includes('T') ? isoOrSqlString : isoOrSqlString.replace(' ', 'T') + 'Z';
  const then = new Date(normalized).getTime();
  if (Number.isNaN(then)) return Infinity;
  return (Date.now() - then) / 3600000;
}

// Builds a DOM node from plain text safely (used anywhere comment/user text
// gets inserted, so nothing is ever interpreted as HTML).
export function textNode(tag, text, className) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = text;
  return el;
}
