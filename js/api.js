import { API_BASE } from './config.js';

// Simple password-per-request system.
// The admin password is stored in memory after login and sent with every admin request.
let adminPassword = null;

export function setAdminPassword(pw) { adminPassword = pw; }
export function getAdminPassword() { return adminPassword; }
export function clearAdminPassword() { adminPassword = null; }

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  // Public
  getEpisodes: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/episodes${qs ? `?${qs}` : ''}`);
  },
  getEpisode: (id) => request(`/api/episodes/${id}`),
  getTrailer: () => request('/api/trailer'),
  getSettings: () => request('/api/settings'),
  getVoiceArtists: () => request('/api/voice-artists'),
  getComments: (episodeId) => request(`/api/comments/${episodeId}`),
  postComment: (episodeId, body) => request(`/api/comments/${episodeId}`, { method: 'POST', body }),
  getReactions: (episodeId, visitorId) =>
    request(`/api/reactions/${episodeId}?visitorId=${encodeURIComponent(visitorId)}`),
  postReaction: (episodeId, body) => request(`/api/reactions/${episodeId}`, { method: 'POST', body }),

  // Admin auth — just checks password, no token
  login: (password) => request('/api/admin/auth', { method: 'POST', body: { password } }),
  changePassword: (oldpw, newpw) => request('/api/admin/password', { method: 'POST', body: { password: oldpw, new_password: newpw } }),

  // Admin — episodes (password included in body)
  createEpisode: (data) => request('/api/episodes', { method: 'POST', body: { ...data, password: adminPassword } }),
  updateEpisode: (id, data) => request(`/api/episodes/${id}`, { method: 'PUT', body: { ...data, password: adminPassword } }),
  deleteEpisode: (id) => request(`/api/episodes/${id}`, { method: 'DELETE', body: { password: adminPassword } }),

  // Admin — trailer
  saveTrailer: (data) => request('/api/trailer', { method: 'POST', body: { ...data, password: adminPassword } }),

  // Admin — settings
  updateSettings: (data) => request('/api/settings', { method: 'PUT', body: { ...data, password: adminPassword } }),

  // Admin — voice artists
  addVoiceArtist: (name) => request('/api/voice-artists', { method: 'POST', body: { name, password: adminPassword } }),
  deleteVoiceArtist: (id) => request(`/api/voice-artists/${id}`, { method: 'DELETE', body: { password: adminPassword } }),

  // Admin — comment moderation
  getAllComments: () => request(`/api/admin/comments?password=${encodeURIComponent(adminPassword)}`),
  deleteComment: (id) => request(`/api/admin/comments/${id}`, { method: 'DELETE', body: { password: adminPassword } }),
};
