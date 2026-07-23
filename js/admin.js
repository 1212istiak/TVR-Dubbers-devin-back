import { api, setAdminPassword, getAdminPassword, clearAdminPassword } from './api.js';
import { showToast, timeAgo } from './utils.js';
import { ADMIN_REVEAL_CLICKS, ADMIN_REVEAL_WINDOW_MS } from './config.js';

// Not a rigid enum in the DB (genre is a free-text column), just the
// dropdown options offered in the admin form — edit this list any time.
const GENRES = ['Action', 'Adventure', 'Fantasy', 'Martial Arts', 'Drama', 'Comedy', 'Romance', 'Supernatural'];

let onDataChanged = () => {};
let editingEpisodeId = null;

export function initAdmin({ onChanged }) {
  onDataChanged = onChanged || (() => {});
  populateGenreSelects();
  setupHiddenReveal();
  setupLoginModal();
  setupPanelChrome();
  setupTabs();
  setupEpisodeForm();
  setupTrailerForm();
  setupSettingsForm();
  setupLinksForm();
  setupArtistForm();
  setupPasswordForm();
}

function populateGenreSelects() {
  for (const selectEl of [document.getElementById('ep-genre'), document.getElementById('tr-genre')]) {
    if (!selectEl) continue;
    selectEl.innerHTML = GENRES.map((g) => `<option value="${g}">${g}</option>`).join('');
  }
}

/* ---------------------------------------------------------------------- */
/* Hidden reveal + login                                                   */
/* ---------------------------------------------------------------------- */
function setupHiddenReveal() {
  const target = document.getElementById('brand-click-target');
  let clicks = 0;
  let timer = null;
  target.addEventListener('click', () => {
    clicks++;
    clearTimeout(timer);
    timer = setTimeout(() => { clicks = 0; }, ADMIN_REVEAL_WINDOW_MS);
    if (clicks >= ADMIN_REVEAL_CLICKS) {
      clicks = 0;
      if (getAdminPassword()) openAdminPanel();
      else document.getElementById('admin-login-modal').classList.remove('hidden');
    }
  });
}

function setupLoginModal() {
  const modal = document.getElementById('admin-login-modal');
  const form = document.getElementById('admin-login-form');
  const errorEl = document.getElementById('admin-login-error');
  document.getElementById('admin-login-close').addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');
    const password = document.getElementById('admin-password-input').value;
    try {
      await api.login(password);
      setAdminPassword(password);
      document.getElementById('admin-password-input').value = '';
      modal.classList.add('hidden');
      openAdminPanel();
    } catch (err) {
      errorEl.textContent = err.message || 'Login failed';
      errorEl.classList.remove('hidden');
    }
  });
}

function setupPanelChrome() {
  document.getElementById('admin-close-btn').addEventListener('click', closeAdminPanel);
  document.getElementById('admin-logout-btn').addEventListener('click', () => {
    clearAdminPassword();
    closeAdminPanel();
    showToast('Logged out');
  });
}

function openAdminPanel() {
  document.getElementById('admin-panel').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  refreshManageList();
  refreshCommentsModeration();
  prefillSettingsAndLinks();
}
function closeAdminPanel() {
  document.getElementById('admin-panel').classList.add('hidden');
  document.body.style.overflow = '';
}

function setupTabs() {
  document.querySelectorAll('.admin-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.admin-panel-section').forEach((s) => s.classList.add('hidden'));
      tab.classList.add('active');
      document.querySelector(`.admin-panel-section[data-panel="${tab.dataset.tab}"]`).classList.remove('hidden');
    });
  });
}

function setMsg(id, message, isError = false) {
  const el = document.getElementById(id);
  el.textContent = message;
  el.classList.remove('success', 'error');
  el.classList.add(isError ? 'error' : 'success');
  setTimeout(() => { el.textContent = ''; }, 4000);
}

/* ---------------------------------------------------------------------- */
/* A. Upload / Edit Episode                                                */
/* ---------------------------------------------------------------------- */
function setupEpisodeForm() {
  const form = document.getElementById('episode-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById('ep-title').value.trim(),
      episodeNumber: Number(document.getElementById('ep-number').value),
      season: Number(document.getElementById('ep-season').value) || 1,
      genre: document.getElementById('ep-genre').value,
      thumbnailUrl: document.getElementById('ep-thumbnail').value.trim(),
      primaryServerUrl: document.getElementById('ep-primary').value.trim(),
      backupServerUrl: document.getElementById('ep-backup').value.trim(),
      isSpecial: document.getElementById('ep-special').checked,
    };
    try {
      if (editingEpisodeId) {
        await api.updateEpisode(editingEpisodeId, payload);
        setMsg('episode-form-msg', 'Episode updated ✓');
      } else {
        await api.createEpisode(payload);
        setMsg('episode-form-msg', 'Saved successfully ✓');
      }
      resetEpisodeForm();
      refreshManageList();
      onDataChanged();
    } catch (err) {
      setMsg('episode-form-msg', err.message || 'Failed to save', true);
    }
  });
}

function resetEpisodeForm() {
  editingEpisodeId = null;
  document.getElementById('episode-form').reset();
  document.getElementById('ep-season').value = 1;
}

function fillEpisodeFormForEdit(ep) {
  editingEpisodeId = ep.id;
  document.getElementById('ep-title').value = ep.title;
  document.getElementById('ep-number').value = ep.episodeNumber;
  document.getElementById('ep-season').value = ep.season;
  if (ep.genre) document.getElementById('ep-genre').value = ep.genre;
  document.getElementById('ep-thumbnail').value = ep.thumbnailUrl || '';
  document.getElementById('ep-primary').value = ep.primaryServerUrl || '';
  document.getElementById('ep-backup').value = ep.backupServerUrl || '';
  document.getElementById('ep-special').checked = !!ep.isSpecial;
  document.querySelector('.admin-tab[data-tab="upload"]').click();
  setMsg('episode-form-msg', `Editing "${ep.title}" — save to apply changes`);
}

/* ---------------------------------------------------------------------- */
/* B. Upload Trailer                                                       */
/* ---------------------------------------------------------------------- */
function setupTrailerForm() {
  document.getElementById('trailer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById('tr-title').value.trim(),
      genre: document.getElementById('tr-genre').value,
      thumbnailUrl: document.getElementById('tr-thumbnail').value.trim(),
      primaryServerUrl: document.getElementById('tr-primary').value.trim(),
      backupServerUrl: document.getElementById('tr-backup').value.trim(),
    };
    try {
      await api.saveTrailer(payload);
      setMsg('trailer-form-msg', 'Saved successfully ✓');
      onDataChanged();
    } catch (err) {
      setMsg('trailer-form-msg', err.message || 'Failed to save', true);
    }
  });
}

/* ---------------------------------------------------------------------- */
/* C. Manage (Edit/Delete) Episodes                                        */
/* ---------------------------------------------------------------------- */
async function refreshManageList() {
  const container = document.getElementById('admin-episode-list');
  container.textContent = 'Loading…';
  try {
    const episodes = await api.getEpisodes();
    container.innerHTML = '';
    if (episodes.length === 0) {
      container.textContent = 'No episodes uploaded yet.';
      return;
    }
    for (const ep of episodes) {
      const row = document.createElement('div');
      row.className = 'admin-episode-row';

      const img = document.createElement('img');
      img.src = ep.thumbnailUrl || '';
      img.alt = '';
      row.appendChild(img);

      const info = document.createElement('div');
      info.className = 'aer-info';
      const h4 = document.createElement('h4');
      h4.textContent = ep.title;
      const p = document.createElement('p');
      p.textContent = `Ep ${ep.episodeNumber} · S${ep.season}${ep.isSpecial ? ' · Special' : ''} · ${ep.viewCount} views`;
      info.append(h4, p);
      row.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'aer-actions';
      const editBtn = document.createElement('button');
      editBtn.className = 'aer-btn';
      editBtn.type = 'button';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => fillEpisodeFormForEdit(ep));
      const delBtn = document.createElement('button');
      delBtn.className = 'aer-btn danger';
      delBtn.type = 'button';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => deleteEpisode(ep.id, ep.title));
      actions.append(editBtn, delBtn);
      row.appendChild(actions);

      container.appendChild(row);
    }
  } catch (err) {
    container.textContent = err.message || 'Failed to load episodes';
  }
}

async function deleteEpisode(id, title) {
  if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
  try {
    await api.deleteEpisode(id);
    showToast('Episode deleted');
    refreshManageList();
    onDataChanged();
  } catch (err) {
    showToast(err.message || 'Failed to delete');
  }
}

/* ---------------------------------------------------------------------- */
/* D + E. Site Settings + Links                                            */
/* ---------------------------------------------------------------------- */
async function prefillSettingsAndLinks() {
  try {
    const s = await api.getSettings();
    document.getElementById('set-title').value = s.website_title || '';
    document.getElementById('set-motto').value = s.motto || '';
    document.getElementById('set-special-thumb').value = s.special_folder_thumbnail || '';
    document.getElementById('set-special-label').value = s.special_folder_label || '';
    if (s.countdown_target_date) {
      const d = new Date(s.countdown_target_date);
      if (!Number.isNaN(d.getTime())) {
        document.getElementById('set-countdown').value = toLocalDatetimeInputValue(d);
      }
    }
    document.getElementById('link-facebook').value = s.facebook || '';
    document.getElementById('link-youtube').value = s.youtube || '';
    document.getElementById('link-telegram').value = s.telegram || '';
    document.getElementById('link-whatsapp').value = s.whatsapp || '';
    document.getElementById('link-instagram').value = s.instagram || '';
    document.getElementById('link-dailymotion').value = s.dailymotion || '';
    document.getElementById('link-rumble').value = s.rumble || '';
  } catch {
    /* leave blank if this fails — forms still work for a fresh save */
  }
  refreshArtistAdminList();
}

function toLocalDatetimeInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function setupSettingsForm() {
  document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const countdownVal = document.getElementById('set-countdown').value;
    const payload = {
      website_title: document.getElementById('set-title').value.trim(),
      motto: document.getElementById('set-motto').value.trim(),
      special_folder_thumbnail: document.getElementById('set-special-thumb').value.trim(),
      special_folder_label: document.getElementById('set-special-label').value.trim(),
    };
    if (countdownVal) payload.countdown_target_date = new Date(countdownVal).toISOString();
    try {
      await api.updateSettings(payload);
      setMsg('settings-form-msg', 'Saved successfully ✓');
      onDataChanged();
    } catch (err) {
      setMsg('settings-form-msg', err.message || 'Failed to save', true);
    }
  });
}

function setupLinksForm() {
  document.getElementById('links-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      facebook: document.getElementById('link-facebook').value.trim(),
      youtube: document.getElementById('link-youtube').value.trim(),
      telegram: document.getElementById('link-telegram').value.trim(),
      whatsapp: document.getElementById('link-whatsapp').value.trim(),
      instagram: document.getElementById('link-instagram').value.trim(),
      dailymotion: document.getElementById('link-dailymotion').value.trim(),
      rumble: document.getElementById('link-rumble').value.trim(),
    };
    try {
      await api.updateSettings(payload);
      setMsg('links-form-msg', 'Saved successfully ✓');
      onDataChanged();
    } catch (err) {
      setMsg('links-form-msg', err.message || 'Failed to save', true);
    }
  });
}

/* ---------------------------------------------------------------------- */
/* F. Voice Artists                                                        */
/* ---------------------------------------------------------------------- */
function setupArtistForm() {
  document.getElementById('artist-add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('artist-name-input');
    const name = input.value.trim();
    if (!name) return;
    try {
      await api.addVoiceArtist(name);
      input.value = '';
      refreshArtistAdminList();
      onDataChanged();
    } catch (err) {
      showToast(err.message || 'Failed to add artist');
    }
  });
}

async function refreshArtistAdminList() {
  const list = document.getElementById('admin-artist-list');
  try {
    const artists = await api.getVoiceArtists();
    list.innerHTML = '';
    for (const a of artists) {
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.textContent = a.name;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Delete';
      btn.addEventListener('click', async () => {
        try {
          await api.deleteVoiceArtist(a.id);
          refreshArtistAdminList();
          onDataChanged();
        } catch (err) {
          showToast(err.message || 'Failed to delete');
        }
      });
      li.append(span, btn);
      list.appendChild(li);
    }
  } catch {
    /* leave list as-is */
  }
}

/* ---------------------------------------------------------------------- */
/* G. Change Password                                                      */
/* ---------------------------------------------------------------------- */
function setupPasswordForm() {
  document.getElementById('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const current = document.getElementById('pw-current').value;
    const next = document.getElementById('pw-new').value;
    const confirmVal = document.getElementById('pw-confirm').value;
    if (next !== confirmVal) {
      setMsg('password-form-msg', 'New passwords do not match', true);
      return;
    }
    try {
      await api.changePassword(current, next);
      setAdminPassword(next); // update stored password to the new one
      setMsg('password-form-msg', 'Password updated ✓');
      document.getElementById('password-form').reset();
    } catch (err) {
      setMsg('password-form-msg', err.message || 'Failed to update password', true);
    }
  });
}

/* ---------------------------------------------------------------------- */
/* H. Comment Moderation                                                   */
/* ---------------------------------------------------------------------- */
async function refreshCommentsModeration() {
  const container = document.getElementById('admin-comments-list');
  container.textContent = 'Loading…';
  try {
    const grouped = await api.getAllComments();
    container.innerHTML = '';
    const episodeTitles = Object.keys(grouped);
    if (episodeTitles.length === 0) {
      container.textContent = 'No comments yet.';
      return;
    }
    for (const title of episodeTitles) {
      const group = document.createElement('div');
      group.className = 'admin-comments-group';
      const h4 = document.createElement('h4');
      h4.textContent = title;
      group.appendChild(h4);
      for (const c of grouped[title]) {
        const row = document.createElement('div');
        row.className = 'admin-comment-row';
        const text = document.createElement('div');
        text.className = 'acr-text';
        const strong = document.createElement('strong');
        strong.textContent = c.nickname + ': ';
        text.appendChild(strong);
        text.appendChild(document.createTextNode(c.body + '  '));
        const time = document.createElement('span');
        time.style.opacity = '0.6';
        time.textContent = timeAgo(c.created_at);
        text.appendChild(time);
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', async () => {
          try {
            await api.deleteComment(c.id);
            refreshCommentsModeration();
          } catch (err) {
            showToast(err.message || 'Failed to delete comment');
          }
        });
        row.append(text, delBtn);
        group.appendChild(row);
      }
      container.appendChild(group);
    }
  } catch (err) {
    container.textContent = err.message || 'Failed to load comments';
  }
}
