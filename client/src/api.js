const BASE = import.meta.env.VITE_API_URL || '/api';

let token = null;
try { token = window.sessionStorage.getItem('bxp_token'); } catch { /* private mode */ }

export const setToken = (t) => {
  token = t;
  try { t ? sessionStorage.setItem('bxp_token', t) : sessionStorage.removeItem('bxp_token'); } catch { /* noop */ }
};
export const getToken = () => token;

export async function api(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    signal,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data });
  return data;
}

/** Fire-and-forget save that still lands if the tab is closing. */
export function beacon(path, body) {
  try {
    const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
    navigator.sendBeacon(`${BASE}${path}?token=${token}`, blob);
  } catch { /* noop */ }
}

export const fmtTime = (totalSec) => {
  const s = Math.max(0, Math.floor(totalSec));
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
};

export const fmtClock = (sec) => {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}m ${String(s).padStart(2, '0')}s`;
};
