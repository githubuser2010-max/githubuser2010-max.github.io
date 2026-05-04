// ===== FIREBASE SETUP =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDb9_WjhNXkH-tgq0bpyEqiZaSPQTKk-34",
  authDomain: "eloquent-ratio-450517-m7.firebaseapp.com",
  projectId: "eloquent-ratio-450517-m7",
  storageBucket: "eloquent-ratio-450517-m7.firebasestorage.app",
  messagingSenderId: "339658125296",
  appId: "1:339658125296:web:05a3fceda9e6321d1c7735",
  measurementId: "G-RF0DPBXZRX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===== EMAILJS SETUP =====
// EmailJS public key — replace with your actual public key from emailjs.com
// Service ID and Template ID should match your EmailJS dashboard
const EMAILJS_PUBLIC_KEY = "YOUR_EMAILJS_PUBLIC_KEY";
const EMAILJS_SERVICE_ID = "YOUR_SERVICE_ID";
const EMAILJS_TEMPLATE_ID = "YOUR_TEMPLATE_ID";
const YUSUF_EMAIL = "mjmyusuyf2010@gmail.com";

// Load EmailJS
const emailjsScript = document.createElement("script");
emailjsScript.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
emailjsScript.onload = () => {
  if (window.emailjs) {
    window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  }
};
document.head.appendChild(emailjsScript);

// ===== STATE =====
let currentUser = null;
let selectedMood = null;
let deferredInstallPrompt = null;

// ===== PWA INSTALL =====
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const banner = document.getElementById("install-banner");
  if (banner) {
    banner.classList.remove("hidden");
  }
});

window.installPWA = async function () {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === "accepted") {
    document.getElementById("install-banner").classList.add("hidden");
    showToast("Yusuf installed! 💙");
  }
  deferredInstallPrompt = null;
};

window.dismissInstall = function () {
  document.getElementById("install-banner").classList.add("hidden");
};

// ===== AUTH HANDLERS =====
window.showRegister = function () {
  document.getElementById("auth-login").classList.add("hidden");
  document.getElementById("auth-register").classList.remove("hidden");
};

window.showLogin = function () {
  document.getElementById("auth-register").classList.add("hidden");
  document.getElementById("auth-login").classList.remove("hidden");
};

window.registerUser = async function () {
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const errEl = document.getElementById("reg-error");
  errEl.textContent = "";

  if (!name || !email || !password) {
    errEl.textContent = "Please fill in all fields.";
    return;
  }
  if (password.length < 6) {
    errEl.textContent = "Password must be at least 6 characters.";
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    // Save user profile to Firestore
    await setDoc(doc(db, "users", cred.user.uid), {
      name,
      email,
      createdAt: serverTimestamp()
    });
    showToast(`Welcome, ${name}! 💙`);
  } catch (err) {
    errEl.textContent = firebaseErrorMsg(err.code);
  }
};

window.loginUser = async function () {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errEl = document.getElementById("login-error");
  errEl.textContent = "";

  if (!email || !password) {
    errEl.textContent = "Please enter your email and password.";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    errEl.textContent = firebaseErrorMsg(err.code);
  }
};

window.signOutUser = async function () {
  await signOut(auth);
  showToast("See you soon 👋");
};

// ===== AUTH STATE =====
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    showAppScreen(user);
  } else {
    currentUser = null;
    showAuthScreen();
  }
});

function showAuthScreen() {
  document.getElementById("auth-screen").classList.add("active");
  document.getElementById("app-screen").classList.remove("active");
}

async function showAppScreen(user) {
  document.getElementById("auth-screen").classList.remove("active");
  document.getElementById("app-screen").classList.add("active");

  const firstName = (user.displayName || user.email).split(" ")[0];
  document.getElementById("header-name").textContent = firstName;
  document.getElementById("user-firstname").textContent = firstName;

  // Set time greeting
  const now = new Date();
  const timeStr = now.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long"
  }).toUpperCase();
  document.getElementById("checkin-time").textContent = timeStr;

  // Check if already checked in today
  await checkTodayEntry(user);
  await loadHistory(user);
  await checkForReply(user);
}

// ===== TODAY CHECK =====
async function checkTodayEntry(user) {
  const today = todayDateStr();
  const entryRef = doc(db, "entries", `${user.uid}_${today}`);
  const snap = await getDoc(entryRef);

  if (snap.exists()) {
    const data = snap.data();
    document.getElementById("checkin-section").classList.add("hidden");
    document.getElementById("done-section").classList.remove("hidden");

    const preview = document.getElementById("today-entry-preview");
    preview.innerHTML = `
      <div class="ep-mood">${moodLabel(data.mood)}</div>
      <div class="ep-msg">"${data.message || "No message left."}"</div>
    `;
  } else {
    document.getElementById("checkin-section").classList.remove("hidden");
    document.getElementById("done-section").classList.add("hidden");
  }
}

// ===== MOOD SELECTION =====
window.selectMood = function (btn) {
  document.querySelectorAll(".mood-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  selectedMood = btn.dataset.mood;
};

// ===== SUBMIT ENTRY =====
window.submitEntry = async function () {
  if (!currentUser) return;

  const message = document.getElementById("day-message").value.trim();
  const sendBtn = document.querySelector(".btn-send");
  const statusEl = document.getElementById("send-status");

  if (!selectedMood) {
    showToast("Pick a mood first 💭");
    return;
  }

  sendBtn.disabled = true;
  statusEl.textContent = "Sending to Yusuf…";

  const today = todayDateStr();
  const firstName = (currentUser.displayName || currentUser.email).split(" ")[0];

  try {
    // Save to Firestore
    const entryData = {
      uid: currentUser.uid,
      name: firstName,
      email: currentUser.email,
      mood: selectedMood,
      message: message || "",
      date: today,
      timestamp: serverTimestamp()
    };

    await setDoc(doc(db, "entries", `${currentUser.uid}_${today}`), entryData);

    // Send email notification to Yusuf
    await sendEmailToYusuf(firstName, selectedMood, message, currentUser.email);

    statusEl.textContent = "✓ Yusuf has been notified 💙";
    showToast("Sent! Yusuf knows 💙");

    setTimeout(() => {
      checkTodayEntry(currentUser);
      loadHistory(currentUser);
    }, 1200);

  } catch (err) {
    console.error("Submit error:", err);
    statusEl.textContent = "Something went wrong. Try again.";
    statusEl.style.color = "var(--red)";
    sendBtn.disabled = false;
  }
};

// ===== EMAIL TO YUSUF =====
async function sendEmailToYusuf(name, mood, message, userEmail) {
  // Uses EmailJS to send notification email to Yusuf
  // Template variables: {{user_name}}, {{mood}}, {{message}}, {{user_email}}, {{date}}
  try {
    if (!window.emailjs) {
      console.warn("EmailJS not loaded, skipping email.");
      return;
    }

    const templateParams = {
      to_email: YUSUF_EMAIL,
      to_name: "Yusuf",
      user_name: name,
      user_email: userEmail,
      mood: moodLabel(mood),
      message: message || "(no message)",
      date: new Date().toLocaleDateString("en-GB", {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
      }),
      reply_to: userEmail
    };

    await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
    console.log("Email sent to Yusuf ✓");
  } catch (err) {
    // Email failure shouldn't block the entry save
    console.warn("Email send failed:", err);
  }
}

// ===== LOAD HISTORY =====
async function loadHistory(user) {
  const listEl = document.getElementById("history-list");
  listEl.innerHTML = '<div class="history-loading">Loading your days…</div>';

  try {
    const q = query(
      collection(db, "entries"),
      where("uid", "==", user.uid),
      orderBy("timestamp", "desc")
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      listEl.innerHTML = '<div class="history-loading">Your history will appear here after your first check-in.</div>';
      return;
    }

    listEl.innerHTML = "";
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const el = document.createElement("div");
      el.className = "history-entry";
      el.innerHTML = `
        <div class="he-date">${formatDate(d.date)}</div>
        <div class="he-content">
          <div class="he-mood-tag">${moodLabel(d.mood)}</div>
          <div class="he-msg">${d.message ? `"${d.message}"` : '<em>No message.</em>'}</div>
        </div>
      `;
      listEl.appendChild(el);
    });
  } catch (err) {
    console.error("History load error:", err);
    listEl.innerHTML = '<div class="history-loading">Could not load history.</div>';
  }
}

// ===== CHECK FOR REPLY FROM YUSUF =====
async function checkForReply(user) {
  const today = todayDateStr();
  try {
    const replyRef = doc(db, "replies", `${user.uid}_${today}`);
    const snap = await getDoc(replyRef);
    if (snap.exists()) {
      const data = snap.data();
      const section = document.getElementById("reply-section");
      const content = document.getElementById("reply-content");
      content.textContent = data.reply || "";
      section.classList.remove("hidden");
    }
  } catch (err) {
    // No reply yet — that's fine
    console.log("No reply found.");
  }
}

// ===== HELPERS =====
function todayDateStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function moodLabel(mood) {
  const map = {
    amazing: "✨ Amazing",
    good: "😊 Good",
    alright: "😐 Alright",
    tough: "😔 Tough",
    rough: "💔 Rough"
  };
  return map[mood] || mood || "—";
}

function firebaseErrorMsg(code) {
  const map = {
    "auth/email-already-in-use": "That email is already registered.",
    "auth/invalid-email": "Invalid email address.",
    "auth/weak-password": "Password is too weak (min 6 chars).",
    "auth/user-not-found": "No account with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/too-many-requests": "Too many attempts. Try again later."
  };
  return map[code] || "Something went wrong. Try again.";
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3200);
}

// Make functions globally available
window.loginUser = window.loginUser;
window.registerUser = window.registerUser;
window.signOutUser = window.signOutUser;
window.submitEntry = window.submitEntry;
window.selectMood = window.selectMood;
window.showLogin = window.showLogin;
window.showRegister = window.showRegister;
window.installPWA = window.installPWA;
window.dismissInstall = window.dismissInstall;
