import { api } from './api.js';
import { initPlayer, openEpisodeModal } from './player.js';
import { initAdmin } from './admin.js';
import { initParticles } from './particles.js';
import { initCursor } from './cursor.js';
import { showToast, debounce, hoursSince, textNode } from './utils.js';
import { SPECIAL_COLLAPSED_COUNT, NEW_BADGE_HOURS } from './config.js';

const state = { episodes: [], settings: {}, voiceArtists: [], trailer: null, activeGenre: null };
let countdownInterval = null;

/* ---------------------------------------------------------------------- */
/* Theme                                                                   */
/* ---------------------------------------------------------------------- */
function initTheme() {
  const saved = localStorage.getItem('tvr_theme');
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const theme = saved || (prefersLight ? 'light' : 'dark');
  applyTheme(theme);

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
    localStorage.setItem('tvr_theme', next);
  });
}
function applyTheme(theme) {
  if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
}

/* ---------------------------------------------------------------------- */
/* Data load                                                               */
/* ---------------------------------------------------------------------- */
async function loadAll() {
  const [episodes, settings, voiceArtists, trailer] = await Promise.all([
    api.getEpisodes().catch(() => []),
    api.getSettings().catch(() => ({})),
    api.getVoiceArtists().catch(() => []),
    api.getTrailer().catch(() => null),
  ]);
  state.episodes = episodes;
  state.settings = settings;
  state.voiceArtists = voiceArtists;
  state.trailer = trailer;
  renderAll();
  maybeOpenFromQueryParam();
}

function renderAll() {
  renderBrand();
  renderCountdown();
  renderSpecialFolder();
  renderGenreChips();
  renderEpisodesGrid();
  renderFooter();
}

/* ---------------------------------------------------------------------- */
/* Brand / header                                                          */
/* ---------------------------------------------------------------------- */
function renderBrand() {
  const title = state.settings.website_title || 'TVR Dubbers';
  const motto = state.settings.motto || 'We Believe in Quality';
  document.getElementById('site-title').textContent = title;
  document.getElementById('site-motto').textContent = motto;
  document.getElementById('footer-site-title').textContent = title;
  document.title = `${title} — ${motto}`;
}

/* ---------------------------------------------------------------------- */
/* Countdown                                                               */
/* ---------------------------------------------------------------------- */
function renderCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
  const target = state.settings.countdown_target_date ? new Date(state.settings.countdown_target_date) : null;

  function tick() {
    const els = {
      d: document.getElementById('cd-days'),
      h: document.getElementById('cd-hours'),
      m: document.getElementById('cd-mins'),
      s: document.getElementById('cd-secs'),
    };
    if (!target || Number.isNaN(target.getTime())) { els.d.textContent = els.h.textContent = els.m.textContent = els.s.textContent = '--'; return; }
    const diff = target.getTime() - Date.now();
    if (diff <= 0) {
      els.d.textContent = els.h.textContent = els.m.textContent = els.s.textContent = '00';
      clearInterval(countdownInterval);
      return;
    }
    const pad = (n) => String(n).padStart(2, '0');
    els.d.textContent = pad(Math.floor(diff / 86400000));
    els.h.textContent = pad(Math.floor((diff / 3600000) % 24));
    els.m.textContent = pad(Math.floor((diff / 60000) % 60));
    els.s.textContent = pad(Math.floor((diff / 1000) % 60));
  }
  tick();
  countdownInterval = setInterval(tick, 1000);
}

/* ---------------------------------------------------------------------- */
/* Special folder                                                          */
/* ---------------------------------------------------------------------- */
function renderSpecialFolder() {
  const thumbEl = document.getElementById('special-thumb');
  thumbEl.src = state.settings.special_folder_thumbnail || '';
  thumbEl.alt = 'Special Episode collection';
  document.getElementById('special-label').textContent = state.settings.special_folder_label || 'Special Episodes';

  const specials = state.episodes.filter((e) => e.isSpecial);
  const section = document.getElementById('special-section');
  section.classList.toggle('hidden', specials.length === 0);
  if (specials.length === 0) return;

  const scrollRow = document.getElementById('special-scroll-row');
  scrollRow.innerHTML = '';
  specials.slice(0, SPECIAL_COLLAPSED_COUNT).forEach((ep) => scrollRow.appendChild(buildEpisodeTile(ep)));

  const expandedGrid = document.getElementById('special-expanded-grid');
  expandedGrid.innerHTML = '';
  specials.forEach((ep) => expandedGrid.appendChild(buildEpisodeTile(ep)));

  const tile = document.getElementById('special-tile');
  const expanded = document.getElementById('special-expanded');
  tile.onclick = () => { expanded.classList.remove('hidden'); tile.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; };
  document.getElementById('special-close').onclick = () => { expanded.classList.add('hidden'); tile.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; };
}

/* ---------------------------------------------------------------------- */
/* Episodes grid + genre chips                                             */
/* ---------------------------------------------------------------------- */
function renderGenreChips() {
  const container = document.getElementById('genre-chips');
  const genres = [...new Set(state.episodes.map((e) => e.genre).filter(Boolean))].sort();
  container.innerHTML = '';

  const allChip = textNode('button', 'All', 'genre-chip' + (state.activeGenre ? '' : ' active'));
  allChip.type = 'button';
  allChip.addEventListener('click', () => { state.activeGenre = null; renderGenreChips(); renderEpisodesGrid(); });
  container.appendChild(allChip);

  for (const genre of genres) {
    const chip = textNode('button', genre, 'genre-chip' + (state.activeGenre === genre ? ' active' : ''));
    chip.type = 'button';
    chip.addEventListener('click', () => { state.activeGenre = genre; renderGenreChips(); renderEpisodesGrid(); });
    container.appendChild(chip);
  }
}

let revealObserver = null;
function getRevealObserver() {
  if (revealObserver) return revealObserver;
  revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          revealObserver.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );
  return revealObserver;
}

function renderEpisodesGrid() {
  const grid = document.getElementById('episodes-grid');
  grid.innerHTML = '';
  const list = state.activeGenre ? state.episodes.filter((e) => e.genre === state.activeGenre) : state.episodes;

  if (list.length === 0) {
    grid.appendChild(textNode('p', state.episodes.length === 0 ? 'No episodes yet — check back soon!' : 'No episodes in this genre yet.', 'empty-state'));
    return;
  }
  const observer = getRevealObserver();
  list.forEach((ep) => {
    const tile = buildEpisodeTile(ep);
    tile.classList.add('reveal');
    grid.appendChild(tile);
    observer.observe(tile);
  });
}

const lastWatchedId = () => localStorage.getItem('tvr_last_watched');

function buildEpisodeTile(ep) {
  const tile = document.createElement('div');
  tile.className = 'episode-tile color-cycle-border';
  tile.setAttribute('role', 'button');
  tile.setAttribute('tabindex', '0');
  tile.setAttribute('aria-label', `Watch ${ep.title}`);

  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'episode-thumb-wrap';

  const img = document.createElement('img');
  img.src = ep.thumbnailUrl || '';
  img.alt = ep.title;
  img.loading = 'lazy';
  img.width = 400;
  img.height = 225;
  thumbWrap.appendChild(img);

  if (ep.genre) thumbWrap.appendChild(textNode('span', ep.genre, 'episode-genre-tag'));
  if (hoursSince(ep.createdAt) < NEW_BADGE_HOURS) thumbWrap.appendChild(textNode('span', 'New', 'episode-new-badge'));
  if (String(ep.id) === lastWatchedId()) thumbWrap.appendChild(textNode('span', 'Resume Watching', 'episode-resume-badge'));

  const playOverlay = document.createElement('div');
  playOverlay.className = 'episode-play-overlay';
  playOverlay.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
  thumbWrap.appendChild(playOverlay);

  tile.appendChild(thumbWrap);

  const info = document.createElement('div');
  info.className = 'episode-info';
  info.appendChild(textNode('h3', ep.title));
  info.appendChild(textNode('p', `Episode ${ep.episodeNumber} · Season ${ep.season}`, 'episode-sub'));
  tile.appendChild(info);

  const open = () => openEpisodeModal(ep, state.episodes);
  tile.addEventListener('click', open);
  tile.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });

  return tile;
}

/* ---------------------------------------------------------------------- */
/* Footer                                                                   */
/* ---------------------------------------------------------------------- */
const SOCIAL_ICONS = {
  facebook: '<path d="M22 12a10 10 0 10-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0022 12z" fill="currentColor"/>',
  youtube: '<path d="M23 12s0-3.6-.5-5.3a3 3 0 00-2.1-2.1C18.7 4 12 4 12 4s-6.7 0-8.4.6a3 3 0 00-2.1 2A31 31 0 001 12s0 3.6.5 5.3a3 3 0 002.1 2.1C5.3 20 12 20 12 20s6.7 0 8.4-.6a3 3 0 002.1-2.1C23 15.6 23 12 23 12z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>',
  telegram: '<path d="M21 4L2.5 11.3c-1 .4-1 1.7.1 2l4.4 1.4 1.7 5.3c.3.9 1.4 1.1 2 .4l2.6-2.6 4.6 3.4c.9.6 2.1.1 2.3-1L22 5c.2-1-.9-1.7-1.8-1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  whatsapp: '<path d="M12 2a10 10 0 00-8.6 15L2 22l5.2-1.4A10 10 0 1012 2z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8.5 8.3c.2-.5.5-.5.8-.5h.6c.2 0 .4 0 .6.5s.7 1.7.8 1.8c.1.2.1.4 0 .6-.1.2-.2.4-.4.6-.2.2-.4.4-.2.7.2.4 1 1.5 2 2.4 1.4 1.2 2.5 1.6 2.8 1.8.3.2.5.1.7-.1.2-.2.8-.9 1-1.2.2-.3.4-.2.7-.1.3.1 1.8.9 2.1 1s.5.2.6.4c.1.2.1 1-.3 1.9-.4.9-2 1.7-2.8 1.7-.7 0-1.7 0-4.6-1.9-3.4-2.1-5.5-6-5.6-6.3-.1-.3-1-1.5-1-2.9 0-1.4.7-2.1 1-2.4z" fill="currentColor"/>',
  instagram: '<rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="17.4" cy="6.6" r="1.2" fill="currentColor"/>',
  dailymotion: '<rect x="2" y="2" width="20" height="20" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 8l7 4-7 4z" fill="currentColor"/>',
  rumble: '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 8l7 4-7 4z" fill="currentColor"/>',
};

function renderFooter() {
  const list = document.getElementById('voice-artists-list');
  list.innerHTML = '';
  for (const artist of state.voiceArtists) list.appendChild(textNode('li', artist.name));

  const links = document.getElementById('social-links');
  links.innerHTML = '';
  const s = state.settings;
  const entries = [
    ['facebook', s.facebook],
    ['youtube', s.youtube],
    ['telegram', s.telegram],
    ['whatsapp', s.whatsapp ? `https://wa.me/${String(s.whatsapp).replace(/\D/g, '')}` : ''],
    ['instagram', s.instagram],
    ['dailymotion', s.dailymotion],
    ['rumble', s.rumble],
  ];
  for (const [key, url] of entries) {
    const a = document.createElement('a');
    a.className = 'social-link';
    a.setAttribute('aria-label', key.charAt(0).toUpperCase() + key.slice(1));
    a.innerHTML = `<svg viewBox="0 0 24 24">${SOCIAL_ICONS[key]}</svg>`;
    if (url) {
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    } else {
      a.href = '#';
      a.addEventListener('click', (e) => { e.preventDefault(); showToast('Coming Soon'); });
    }
    links.appendChild(a);
  }

  const telegramFooterLink = document.getElementById('footer-telegram-link');
  if (s.telegram) {
    telegramFooterLink.href = s.telegram;
    telegramFooterLink.target = '_blank';
    telegramFooterLink.rel = 'noopener noreferrer';
  } else {
    telegramFooterLink.href = '#';
    telegramFooterLink.onclick = (e) => { e.preventDefault(); showToast('Coming Soon'); };
  }
}

/* ---------------------------------------------------------------------- */
/* Search                                                                   */
/* ---------------------------------------------------------------------- */
function initSearch() {
  const input = document.getElementById('search-input');
  const resultsEl = document.getElementById('search-results');

  const runSearch = debounce(async (q) => {
    if (!q) { resultsEl.classList.add('hidden'); return; }
    let results;
    try {
      results = await api.getEpisodes({ q });
    } catch {
      results = [];
    }
    resultsEl.innerHTML = '';
    if (results.length === 0) {
      resultsEl.appendChild(textNode('p', 'Coming Soon', 'search-empty'));
    } else {
      for (const ep of results.slice(0, 8)) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'search-result-item';
        const img = document.createElement('img');
        img.src = ep.thumbnailUrl || '';
        img.alt = '';
        item.appendChild(img);
        item.appendChild(textNode('span', ep.title));
        item.addEventListener('click', () => {
          openEpisodeModal(ep, state.episodes);
          resultsEl.classList.add('hidden');
          input.value = '';
        });
        resultsEl.appendChild(item);
      }
    }
    resultsEl.classList.remove('hidden');
  }, 300);

  input.addEventListener('input', () => runSearch(input.value.trim()));
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap')) resultsEl.classList.add('hidden');
  });
}

/* ---------------------------------------------------------------------- */
/* Hero buttons                                                            */
/* ---------------------------------------------------------------------- */
function initHero() {
  document.getElementById('watch-now-btn').addEventListener('click', () => {
    if (state.episodes.length === 0) { showToast('No episodes uploaded yet'); return; }
    openEpisodeModal(state.episodes[0], state.episodes);
  });
  document.getElementById('upcoming-btn').addEventListener('click', () => {
    if (!state.trailer) { showToast('No trailer uploaded yet'); return; }
    openEpisodeModal(state.trailer, [], { isTrailer: true });
  });
}

/* ---------------------------------------------------------------------- */
/* Share-link deep open (?episode=ID from /share/episode/:id redirects)    */
/* ---------------------------------------------------------------------- */
function maybeOpenFromQueryParam() {
  const params = new URLSearchParams(window.location.search);
  const epId = params.get('episode');
  if (!epId) return;
  const ep = state.episodes.find((e) => String(e.id) === epId);
  if (ep) openEpisodeModal(ep, state.episodes);
}

/* ---------------------------------------------------------------------- */
/* Boot                                                                     */
/* ---------------------------------------------------------------------- */
function detectLowPower() {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4; // Chrome-only; undefined elsewhere, hence the default
  return cores <= 4 || mem <= 2;
}

document.addEventListener('DOMContentLoaded', () => {
  const lowPower = detectLowPower();
  if (lowPower) document.body.classList.add('low-power');

  initTheme();
  initPlayer({ getAllEpisodes: () => state.episodes });
  initSearch();
  initHero();
  initParticles(document.getElementById('particles-canvas'), { lowPower });
  initCursor();
  initAdmin({ onChanged: loadAll });

  loadAll().catch(() => showToast('Could not load site data — check your connection'));
});
