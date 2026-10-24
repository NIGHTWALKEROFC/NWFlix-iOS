import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, Timestamp, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyB1k7Js9TtR-NHriFYAC3EfAnxN-uPPUFc",
  authDomain: "nwflix-4ea44.firebaseapp.com",
  projectId: "nwflix-4ea44",
  appId: "1:277538993543:web:b2521848009f7be4604f22"
});
const auth = getAuth(app);
const ref = doc(getFirestore(app), "config", "ios");
const $ = (id) => document.getElementById(id);

function say(id, text, ok) { const e = $(id); e.textContent = text; e.className = "msg " + (ok ? "ok" : "bad"); }
const save = (patch) => setDoc(ref, patch, { merge: true });

async function load() {
  const s = await getDoc(ref);
  const d = s.exists() ? s.data() : {};
  $("m-on").checked = !!d.maintenanceOn;
  $("m-title").value = d.maintenanceTitle || "";
  $("m-msg").value = d.maintenanceMessage || "";
  $("a-current").textContent = d.annId ? 'Current message: "' + (d.annTitle || "") + '"' : "No message is active.";
}

$("signin").onclick = async () => {
  try { await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value); }
  catch (e) { $("login-msg").textContent = "Could not sign in: " + (e.code || e.message); }
};
$("signout").onclick = () => signOut(auth);

$("m-save").onclick = async () => {
  try {
    await save({ maintenanceOn: $("m-on").checked, maintenanceTitle: $("m-title").value.trim(), maintenanceMessage: $("m-msg").value.trim() });
    say("m-out", $("m-on").checked ? "Maintenance mode is ON." : "Maintenance mode is off.", true);
  } catch (e) { say("m-out", "Could not save: " + (e.code || e.message), false); }
};

$("a-send").onclick = async () => {
  const msg = $("a-msg").value.trim(), url = $("a-url").value.trim();
  if (!msg) { say("a-out", "Write a message first.", false); return; }
  if (url && !url.startsWith("https://")) { say("a-out", "The link must start with https://", false); return; }
  const hours = parseInt($("a-exp").value || "0", 10);
  try {
    await save({
      annId: String(Date.now()), annTitle: $("a-title").value.trim(), annMessage: msg,
      annButtonText: $("a-btn").value.trim(), annButtonUrl: url, annDismissible: $("a-dismiss").checked, annCountries: $("a-countries").value.trim(),
      annExpiresAt: hours > 0 ? Timestamp.fromMillis(Date.now() + hours * 3600e3) : Timestamp.fromMillis(0)
    });
    say("a-out", "Sent. People with the web app open get it within seconds.", true);
    load();
  } catch (e) { say("a-out", "Could not send: " + (e.code || e.message), false); }
};

$("a-clear").onclick = async () => {
  try { await save({ annId: "" }); say("a-out", "Message removed.", true); load(); }
  catch (e) { say("a-out", "Could not remove: " + (e.code || e.message), false); }
};

onAuthStateChanged(auth, (u) => {
  const ok = u && !u.isAnonymous;
  $("login").classList.toggle("hidden", !!ok);
  $("app").classList.toggle("hidden", !ok);
  if (ok) { $("who").textContent = u.email; load().catch((e) => say("m-out", "Could not load (is this the admin account?): " + (e.code || e.message), false)); }
});

const top = (rows, key) => {
  const n = {};
  rows.forEach((r) => { const k = r[key] || "?"; n[k] = (n[k] || 0) + 1; });
  return Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, c]) => k + ": " + c).join("\n  ") || "-";
};
$("u-load").onclick = async () => {
  $("u-out").textContent = "Loading...";
  try {
    const q = query(collection(getFirestore(app), "users"), where("os", ">=", "iOS"), where("os", "<", "iOT"));
    const rows = (await getDocs(q)).docs.map((d) => d.data());
    const ago = (h) => rows.filter((r) => r.lastSeen && r.lastSeen.toMillis() > Date.now() - h * 3600e3).length;
    $("u-out").textContent = "Total: " + rows.length + "\nActive 24h: " + ago(24) + "\nActive 7 days: " + ago(168) + "\nActive 30 days: " + ago(720) +
      "\nCountries:\n  " + top(rows, "country") + "\niOS versions:\n  " + top(rows, "os") + "\nApp versions:\n  " + top(rows, "v");
  } catch (e) { $("u-out").textContent = "Could not load: " + (e.code || e.message); }
};
