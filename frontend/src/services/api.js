import axios from "axios";
import { getBackendUrl } from "../config";

const api = axios.create({ baseURL: getBackendUrl(), withCredentials: true });
let refreshPromise;
let sessionGeneration = 0;

export const getAccessToken = () => {
  try {
    return JSON.parse(localStorage.getItem("token"));
  } catch {
    return null;
  }
};

export const saveSession = data => {
  localStorage.setItem("token", JSON.stringify(data.token));
  window.dispatchEvent(new CustomEvent("auth:session", { detail: data.user }));
};

export const clearSession = () => {
  sessionGeneration += 1;
  localStorage.removeItem("token");
  window.dispatchEvent(new CustomEvent("auth:session", { detail: null }));
};

export const refreshSession = () => {
  if (!refreshPromise) {
    const generation = sessionGeneration;
    refreshPromise = api
      .post("/auth/refresh_token", {}, { skipAuthRefresh: true })
      .then(({ data }) => {
        if (generation !== sessionGeneration) throw new Error("Session ended");
        saveSession(data);
        return data;
      })
      .catch(error => {
        if (generation === sessionGeneration) clearSession();
        throw error;
      })
      .finally(() => {
        refreshPromise = undefined;
      });
  }
  return refreshPromise;
};

// Installed once for this API instance, never once per React render.
api.interceptors.request.use(config => {
  const target = new URL(
    config.url,
    new URL(config.baseURL || "/", window.location.origin)
  );
  const backend = new URL(getBackendUrl() || "/", window.location.origin);
  if (target.origin !== backend.origin)
    throw new Error("Unexpected API origin");
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  else delete config.headers.Authorization;
  return config;
});

api.interceptors.response.use(
  response => response,
  async error => {
    const request = error.config;
    if (
      error.response?.status === 401 &&
      request &&
      !request._retry &&
      !request.skipAuthRefresh &&
      !/\/auth\/(login|signup|refresh_token|logout)/.test(request.url) &&
      getAccessToken()
    ) {
      request._retry = true;
      await refreshSession();
      return api(request);
    }
    return Promise.reject(error);
  }
);

export default api;
