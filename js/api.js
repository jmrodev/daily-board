// js/api.js - Cliente HTTP desacoplado para GitHub API
import { state } from "./state.js";

export async function githubRequest(endpoint, options = {}) {
  const headers = {
    "Accept": "application/vnd.github+json",
    ...(options.headers || {})
  };

  if (state.config.token) {
    headers["Authorization"] = `Bearer ${state.config.token}`;
  }

  const url = `https://api.github.com/repos/${state.config.repoSlug}${endpoint}`;
  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403) {
      throw new Error("Límite de API alcanzado o permisos insuficientes. Conectá tu Token de GitHub.");
    }
    throw new Error(errorBody.message || `Error ${res.status}: ${res.statusText}`);
  }

  return res.json();
}
