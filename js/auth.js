// js/auth.js - Flujo de Login Oficial vía GitHub Device Flow (100% Estático)
import { state, saveUserSession, clearUserSession } from "./state.js";

const CLIENT_ID = "Ov23lidF3P2NJbBEHKPI";
let pollInterval = null;

export async function iniciarLoginGitHub(onCodeReady, onSuccess, onError) {
  try {
    // 1. Pedir código de dispositivo a GitHub
    const res = await fetch("https://github.com/login/device/code", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        scope: "repo"
      })
    });

    const data = await res.json();
    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    // Informar a la UI el código para el usuario (ej: WDJB-4711)
    onCodeReady({
      userCode: data.user_code,
      verificationUri: data.verification_uri
    });

    // 2. Sondear hasta que el alumno apruebe en GitHub
    const intervalSec = (data.interval || 5) * 1000;
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
      const pollRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          device_code: data.device_code,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code"
        })
      });

      const pollData = await pollRes.json();

      if (pollData.access_token) {
        clearInterval(pollInterval);
        pollInterval = null;

        // Obtener datos del perfil del alumno
        const userRes = await fetch("https://api.github.com/user", {
          headers: {
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${pollData.access_token}`
          }
        });
        const userProfile = await userRes.json();

        saveUserSession(pollData.access_token, userProfile.login, userProfile.avatar_url);
        onSuccess(userProfile);
      } else if (pollData.error && pollData.error !== "authorization_pending") {
        clearInterval(pollInterval);
        pollInterval = null;
        onError(pollData.error_description || pollData.error);
      }
    }, intervalSec);

  } catch (err) {
    onError(err.message);
  }
}

export function cancelarLogin() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}
