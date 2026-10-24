import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { initializeFirestore, doc, onSnapshot, setDoc, serverTimestamp, increment } from "firebase/firestore";

const app = initializeApp({
  apiKey: "AIzaSyB1k7Js9TtR-NHriFYAC3EfAnxN-uPPUFc",
  authDomain: "nwflix-4ea44.firebaseapp.com",
  projectId: "nwflix-4ea44",
  appId: "1:277538993543:web:b2521848009f7be4604f22"
});
const auth = getAuth(app);
const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });

export const ready = () => new Promise((res) => {
  const off = onAuthStateChanged(auth, (u) => { off(); res(u); });
});

export const email = () => (auth.currentUser && auth.currentUser.email) || "";

export async function signInGoogle() {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account" });
  try { await signInWithPopup(auth, p); }
  catch (e) {
    if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") throw new Error("Cancelled");
    if (e.code === "auth/popup-blocked") throw new Error("Your browser blocked the sign-in window. Allow pop-ups for this site and try again.");
    if (e.code === "auth/unauthorized-domain") throw new Error("This website isn't allowed for sign-in yet. Please contact the developer.");
    throw new Error("Google sign-in is not available right now. Please try again later.");
  }
}

export const logout = () => signOut(auth);

export function watchConfig(cb) {
  return onSnapshot(doc(db, "config", "ios"), (s) => {
    const d = s.exists() ? s.data() : {};
    cb({
      maintenanceOn: !!d.maintenanceOn, maintenanceTitle: d.maintenanceTitle || "", maintenanceMessage: d.maintenanceMessage || "",
      annId: d.annId || "", annTitle: d.annTitle || "", annMessage: d.annMessage || "",
      annButtonText: d.annButtonText || "", annButtonUrl: d.annButtonUrl || "", annDismissible: d.annDismissible !== false, annCountries: d.annCountries || "",
      annExpiresAt: d.annExpiresAt && d.annExpiresAt.toMillis ? d.annExpiresAt.toMillis() : 0
    });
  }, () => {});
}

export async function heartbeat() {
  const u = auth.currentUser;
  if (!u) return;
  const ua = navigator.userAgent;
  const ios = /OS (\d+)[_.]/.exec(ua);
  const lang = (navigator.language || "en").split("-");
  const data = {
    v: "1.0", vc: 1, os: ios ? "iOS " + ios[1] : "iOS web", sdk: ios ? Number(ios[1]) : 0,
    model: (/CriOS/.test(ua) ? "Chrome" : /FxiOS/.test(ua) ? "Firefox" : "Safari") + " web",
    country: (lang[1] || "XX").toUpperCase().slice(0, 2), lang: lang[0].slice(0, 3),
    lastSeen: serverTimestamp(), opens: increment(1)
  };
  const first = !localStorage.getItem("nwios_fs");
  if (first) data.firstSeen = serverTimestamp();
  try { await setDoc(doc(db, "users", u.uid), data, { merge: true }); localStorage.setItem("nwios_fs", "1"); } catch (e) {}
}
