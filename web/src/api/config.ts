// In local dev, Vite proxies /api to the backend (see vite.config.ts), so the
// relative path works with no env var needed. In a real deployment (e.g. Render,
// where the frontend and backend are separate services with different URLs),
// set VITE_API_BASE_URL to the backend's full URL at build time.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
