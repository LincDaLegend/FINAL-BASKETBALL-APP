export function load(key, defaultVal) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultVal;
    const parsed = JSON.parse(raw);
    return (parsed !== null && parsed !== undefined) ? parsed : defaultVal;
  } catch {
    return defaultVal;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Storage write failed:', e);
  }
}

export function remove(key) {
  try { localStorage.removeItem(key); } catch {}
}

