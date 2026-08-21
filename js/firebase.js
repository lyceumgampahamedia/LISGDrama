import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app-check.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { APP_CHECK_SITE_KEY, FIREBASE_CONFIG } from "./config.js";

export const firebaseApp = initializeApp(FIREBASE_CONFIG);

const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
if (isLocalhost) {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

if (APP_CHECK_SITE_KEY && !APP_CHECK_SITE_KEY.startsWith("REPLACE_")) {
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaV3Provider(APP_CHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
} else {
  console.warn("Firebase App Check is not configured. Firestore may reject protected requests.");
}

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
