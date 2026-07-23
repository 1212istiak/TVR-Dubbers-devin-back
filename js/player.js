import { api } from './api.js';
import { getVisitorId, showToast, timeAgo, textNode } from './utils.js';
import { COMMENT_POLL_MS } from './config.js';

let modalEl, iframeEl, titleEl, metaEl, serverTabs, reactionsRow, commentsList, commentForm;
let currentEpisode = null;
let allEpisodesRef = [];
let onNavigate = null;
let pollTimer = null;

export function initPlayer({ getAllEpisodes, onOpenEpisode }) {
  modalEl = document.getElementById('video-modal');
  iframeEl = document.getElementById('player-iframe');
  titleEl = document.getElementById('modal-title');
  metaEl = document.getElementById('modal-episode-meta');
  serverTabs = document.querySelectorAll('.server-tab');
  reactionsRow = document.getElementById('reactions-row');
  commentsList = document.getElementById('comments-list');
  commentForm = document.getElementById('comment-form');
  onNavigate = onOpenEpisode;

  document.getElementById('modal-close').addEventListener('click', closeModal);
  modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalEl.classList.contains('hidden')) closeModal();
  });

  serverTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      serverTabs.forEach((t) => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const url = tab.dataset.server === 'primary' ? currentEpisode?.primaryServerUrl : currentEpisode?.backupServerUrl;
      if (url) iframeEl.src = url;
      else showToast('Backup server not available for this episode');
    });
  });

  reactionsRow.querySelectorAll('.reaction-btn').forEach((btn) => {
    btn.addEventListener('click', () => handleReaction(btn.dataset.reaction, btn));
  });

  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nickname = document.getElementById('comment-nickname').value.trim();
    const body = document.getElementById('comment-body').value.trim();
    if (!body) return;
    try {
      await api.postComment(currentEpisode.id, { nickname, body });
      document.getElementById('comment-body').value = '';
      await refreshComments();
    } catch (err) {
      showToast(err.message || 'Could not post comment');
    }
  });

  document.getElementById('next-episode-btn').addEventListener('click', () => {
    const next = findNextEpisode();
    if (next) openEpisodeModal(next, allEpisodesRef);
    else showToast('No next episode yet — check back soon!');
  });

  getAllEpisodesUpdater = getAllEpisodes;
}

let getAllEpisodesUpdater = () => [];

function findNextEpisode() {
  if (!currentEpisode) return null;
  const list = allEpisodesRef.length ? allEpisodesRef : getAllEpisodesUpdater();
  return (
    list.find((e) => e.season === currentEpisode.season && e.episodeNumber === currentEpisode.episodeNumber + 1) ||
    null
  );
}

export async function openEpisodeModal(episode, allEpisodes = [], { isTrailer = false } = {}) {
  currentEpisode = episode;
  allEpisodesRef = allEpisodes.length ? allEpisodes : allEpisodesRef;

  titleEl.textContent = episode.title;
  metaEl.textContent = isTrailer
    ? `Trailer${episode.genre ? ' · ' + episode.genre : ''}`
    : `Episode ${episode.episodeNumber} · Season ${episode.season}${episode.genre ? ' · ' + episode.genre : ''}`;

  serverTabs.forEach((t, i) => {
    t.classList.toggle('active', i === 0);
    t.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
  });
  iframeEl.src = episode.primaryServerUrl || '';

  // Comments/reactions/"next episode" are keyed to a real episode id — the
  // trailer isn't one, so hide those sections rather than call the API with
  // a meaningless id.
  document.querySelector('.comments-section').classList.toggle('hidden', isTrailer);
  reactionsRow.classList.toggle('hidden', isTrailer);
  document.getElementById('next-episode-btn').classList.toggle('hidden', isTrailer);

  modalEl.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  if (isTrailer) return;

  localStorage.setItem('tvr_last_watched', String(episode.id));

  // Bump the real view count server-side (list data passed in is cached).
  api.getEpisode(episode.id).catch(() => {});

  await Promise.all([loadReactions(), refreshComments()]);
  pollTimer = setInterval(refreshComments, COMMENT_POLL_MS);
}

export function closeModal() {
  modalEl.classList.add('hidden');
  document.body.style.overflow = '';
  iframeEl.src = '';
  currentEpisode = null;
  if (pollTimer) clearInterval(pollTimer);
}

async function loadReactions() {
  try {
    const { counts, yourReaction } = await api.getReactions(currentEpisode.id, getVisitorId());
    reactionsRow.querySelectorAll('.reaction-btn').forEach((btn) => {
      const type = btn.dataset.reaction;
      btn.querySelector('.reaction-count').textContent = counts[type] ?? 0;
      btn.classList.toggle('picked', yourReaction === type);
    });
  } catch {
    /* non-fatal — reactions just won't show counts */
  }
}

async function handleReaction(type, btn) {
  // Floating emoji animation.
  const floatEl = document.createElement('span');
  floatEl.className = 'reaction-float';
  floatEl.textContent = btn.querySelector('.reaction-emoji').textContent;
  btn.appendChild(floatEl);
  floatEl.addEventListener('animationend', () => floatEl.remove());

  try {
    const { counts } = await api.postReaction(currentEpisode.id, { visitorId: getVisitorId(), reactionType: type });
    reactionsRow.querySelectorAll('.reaction-btn').forEach((b) => {
      const t = b.dataset.reaction;
      const countEl = b.querySelector('.reaction-count');
      const newVal = counts[t] ?? 0;
      if (countEl.textContent !== String(newVal)) {
        countEl.textContent = newVal;
        countEl.classList.remove('bump');
        void countEl.offsetWidth;
        countEl.classList.add('bump');
      }
      b.classList.toggle('picked', t === type);
    });
  } catch (err) {
    showToast(err.message || 'Could not react');
  }
}

async function refreshComments() {
  if (!currentEpisode) return;
  try {
    const comments = await api.getComments(currentEpisode.id);
    commentsList.innerHTML = '';
    if (comments.length === 0) {
      commentsList.appendChild(textNode('p', 'Be the first to comment.', 'comments-empty'));
      return;
    }
    for (const c of comments) {
      const item = document.createElement('div');
      item.className = 'comment-item';
      const head = document.createElement('div');
      head.className = 'comment-item-head';
      head.appendChild(textNode('span', c.nickname, 'comment-nickname'));
      head.appendChild(textNode('span', timeAgo(c.created_at), 'comment-time'));
      item.appendChild(head);
      item.appendChild(textNode('p', c.body, 'comment-body'));
      commentsList.appendChild(item);
    }
  } catch {
    /* keep whatever was last shown */
  }
}
