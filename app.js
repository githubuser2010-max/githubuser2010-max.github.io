// Fabric Drive — Web, Desktop & Mobile Hybrid Controller
// Integrates Firebase SDK + Local Samba Vault Authentication + 1-Click Photo Backup + Google Drive Importer

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

// User-supplied Firebase configuration for Fabric Drive
const firebaseConfig = {
  apiKey: "AIzaSyB5QPuCWX0dafp7E6xQz3NLjSu_gAE1Zjk",
  authDomain: "fabric-drive.firebaseapp.com",
  projectId: "fabric-drive",
  storageBucket: "fabric-drive.firebasestorage.app",
  messagingSenderId: "1075489739244",
  appId: "1:1075489739244:web:eb8ecbda96c94c681b30c9",
  measurementId: "G-J00P94Q4GK"
};

let fbApp = null;
let fbAuth = null;
try {
  fbApp = initializeApp(firebaseConfig);
  fbAuth = getAuth(fbApp);
} catch (err) {
  console.warn("Firebase init warning:", err);
}

// State
const state = {
  apiBase: localStorage.getItem("fabric.apiBase") || "",
  token: localStorage.getItem("fabric.token") || "",
  user: null,
  view: "my-drive",
  currentPath: "",
  layout: localStorage.getItem("fabric.layout") || "grid",
  items: [],
  searchQuery: "",
  previewItem: null
};

function apiUrl(endpoint) {
  const base = state.apiBase ? state.apiBase.replace(/\/+$/, "") : "";
  return `${base}${endpoint}`;
}

async function apiFetch(endpoint, options = {}) {
  const headers = Object.assign({}, options.headers || {});
  if (state.token) {
    headers["Authorization"] = `Bearer ${state.token}`;
  }
  if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  const resp = await fetch(apiUrl(endpoint), Object.assign({}, options, { headers }));
  return resp.json();
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(epochSec) {
  if (!epochSec) return "";
  const d = new Date(epochSec * 1000);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ==================== AUTHENTICATION ====================
window.switchAuthTab = function (tab) {
  document.querySelectorAll(".auth-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.getElementById("loginForm").classList.toggle("hidden", tab !== "login");
  document.getElementById("registerForm").classList.toggle("hidden", tab !== "register");
  document.getElementById("firebasePane").classList.toggle("hidden", tab !== "firebase");
  hideAuthError();
};

function showAuthError(msg) {
  const el = document.getElementById("authError");
  el.textContent = msg;
  el.classList.remove("hidden");
}

function hideAuthError() {
  document.getElementById("authError").classList.add("hidden");
}

window.handleLocalLogin = async function (e) {
  e.preventDefault();
  hideAuthError();
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  try {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: { username, password }
    });
    if (!res.ok) return showAuthError(res.error || "Login failed");
    completeSignIn(res.token, res.user);
  } catch (err) {
    showAuthError("Cannot reach Fabric Drive server. Check connection.");
  }
};

window.handleRegister = async function (e) {
  e.preventDefault();
  hideAuthError();
  const username = document.getElementById("regUsername").value.trim();
  const display_name = document.getElementById("regDisplayName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  try {
    const res = await apiFetch("/api/auth/register", {
      method: "POST",
      body: { username, display_name, email, password }
    });
    if (!res.ok) return showAuthError(res.error || "Registration failed");
    completeSignIn(res.token, res.user);
  } catch (err) {
    showAuthError("Registration error: " + err.message);
  }
};

window.handleFirebaseEmailAuth = async function (e) {
  e.preventDefault();
  hideAuthError();
  const email = document.getElementById("fbEmail").value.trim();
  const password = document.getElementById("fbPassword").value;
  const preferredUsername = document.getElementById("fbUsername").value.trim();
  const mode = window._fbMode || "signin";
  try {
    let cred;
    if (mode === "signup") {
      cred = await createUserWithEmailAndPassword(fbAuth, email, password);
    } else {
      cred = await signInWithEmailAndPassword(fbAuth, email, password);
    }
    const idToken = await cred.user.getIdToken();
    const res = await apiFetch("/api/auth/firebase", {
      method: "POST",
      body: {
        idToken,
        email: cred.user.email,
        displayName: cred.user.displayName || preferredUsername,
        uid: cred.user.uid,
        username: preferredUsername
      }
    });
    if (!res.ok) return showAuthError(res.error || "Firebase vault link failed");
    completeSignIn(res.token, res.user);
  } catch (err) {
    showAuthError(err.message || "Firebase authentication failed");
  }
};

window.handleFirebaseGooglePopup = async function () {
  hideAuthError();
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope("https://www.googleapis.com/auth/drive.readonly");
    const result = await signInWithPopup(fbAuth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential && credential.accessToken) {
      localStorage.setItem("fabric.gdriveAccessToken", credential.accessToken);
      const tokenInput = document.getElementById("gdriveAccessToken");
      if (tokenInput) tokenInput.value = credential.accessToken;
    }
    const idToken = await result.user.getIdToken();
    const preferredUsername = document.getElementById("fbUsername").value.trim();
    const res = await apiFetch("/api/auth/firebase", {
      method: "POST",
      body: {
        idToken,
        email: result.user.email,
        displayName: result.user.displayName,
        uid: result.user.uid,
        username: preferredUsername
      }
    });
    if (!res.ok) return showAuthError(res.error || "Firebase Google sign-in failed");
    completeSignIn(res.token, res.user);
  } catch (err) {
    showAuthError(err.message || "Google sign-in popup was blocked or failed.");
  }
};

function completeSignIn(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem("fabric.token", token);
  document.getElementById("authScreen").classList.add("hidden");
  document.getElementById("appShell").classList.remove("hidden");
  updateUserUI();
  loadFiles();
}

window.logout = function () {
  state.token = "";
  state.user = null;
  localStorage.removeItem("fabric.token");
  document.getElementById("appShell").classList.add("hidden");
  document.getElementById("authScreen").classList.remove("hidden");
};

function updateUserUI() {
  if (!state.user) return;
  const u = state.user;
  document.getElementById("sidebarVaultTag").textContent = `@${u.username} vault`;
  document.getElementById("userNameLabel").textContent = u.display_name || u.username;
  document.getElementById("userRoleLabel").textContent = `Isolated: /users/${u.username}`;
  document.getElementById("userAvatar").textContent = (u.display_name || u.username)[0].toUpperCase();
  document.getElementById("currentUserStrong").textContent = u.username;
  document.getElementById("currentUserStrong2").textContent = u.username;
  updateQuotaBar(u.used_bytes || 0, u.quota_bytes || 107374182400);
}

function updateQuotaBar(used, quota) {
  const pct = Math.min(100, Math.round((used / quota) * 100));
  document.getElementById("storagePercent").textContent = `${pct}%`;
  document.getElementById("storageFill").style.width = `${Math.max(2, pct)}%`;
  document.getElementById("storageText").textContent = `${formatBytes(used)} of ${formatBytes(quota)} used`;
}

// ==================== NAVIGATION & FILE LOADING ====================
window.switchView = function (view) {
  state.view = view;
  if (view !== "my-drive") {
    state.currentPath = "";
  }
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
  document.getElementById("emptyTrashBtn").classList.toggle("hidden", view !== "trash");
  document.getElementById("quickBanner").classList.toggle("hidden", view !== "my-drive" || state.currentPath !== "");
  document.getElementById("sidebar").classList.remove("open");
  loadFiles();
};

window.navigateFolder = function (relPath) {
  state.view = "my-drive";
  state.currentPath = relPath;
  document.getElementById("quickBanner").classList.toggle("hidden", relPath !== "");
  loadFiles();
};

window.setLayout = function (layout) {
  state.layout = layout;
  localStorage.setItem("fabric.layout", layout);
  document.getElementById("gridBtn").classList.toggle("active", layout === "grid");
  document.getElementById("listBtn").classList.toggle("active", layout === "list");
  const container = document.getElementById("filesContainer");
  container.className = layout === "grid" ? "files-grid" : "files-list";
};

window.handleSearch = function (q) {
  state.searchQuery = q.trim();
  if (state.searchQuery) {
    state.view = "search";
  } else {
    state.view = "my-drive";
  }
  loadFiles();
};

function renderBreadcrumbs() {
  const bc = document.getElementById("breadcrumbs");
  if (state.view !== "my-drive") {
    const titles = {
      photos: "Photos & Gallery",
      recent: "Recent Files",
      starred: "Starred",
      trash: "Trash",
      search: `Search: "${state.searchQuery}"`
    };
    bc.innerHTML = `<span class="crumb active">${titles[state.view] || "Fabric Drive"}</span>`;
    return;
  }

  const parts = state.currentPath ? state.currentPath.split("/") : [];
  let html = `<span class="crumb ${parts.length === 0 ? "active" : ""}" onclick="navigateFolder('')">My Fabric Drive</span>`;
  let acc = "";
  parts.forEach((p, idx) => {
    acc = acc ? `${acc}/${p}` : p;
    const isLast = idx === parts.length - 1;
    html += ` <span style="color:#64748b">/</span> <span class="crumb ${isLast ? "active" : ""}" onclick="navigateFolder('${acc.replace(/'/g, "\\'")}')">${p}</span>`;
  });
  bc.innerHTML = html;
}

async function loadFiles() {
  renderBreadcrumbs();
  setLayout(state.layout);
  const qs = new URLSearchParams({
    view: state.view,
    path: state.currentPath,
    q: state.searchQuery
  });
  try {
    const res = await apiFetch(`/api/files?${qs.toString()}`);
    if (!res.ok) {
      if (res.error === "Unauthorized") logout();
      return;
    }
    state.items = res.items || [];
    updateQuotaBar(res.used_bytes, res.quota_bytes);
    renderFiles();
  } catch (err) {
    console.error("Failed loading files:", err);
  }
}

function getCategoryIcon(cat) {
  if (cat === "folder") {
    return `<svg width="44" height="44" viewBox="0 0 24 24" fill="#6366f1" stroke="#818cf8" stroke-width="1.2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
  }
  if (cat === "video") {
    return `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="1.8"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`;
  }
  if (cat === "audio") {
    return `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="1.8"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
  }
  if (cat === "document") {
    return `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
  }
  return `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`;
}

function renderFiles() {
  const container = document.getElementById("filesContainer");
  if (!state.items.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p style="font-size:15px;font-weight:600;margin-bottom:6px">No files in this view yet</p>
        <p style="font-size:12.5px">Drag and drop files anywhere, click <strong>1-Click Image Backup</strong>, or import from <strong>Google Drive</strong>.</p>
      </div>`;
    return;
  }

  container.innerHTML = state.items.map((item, idx) => {
    const thumbUrl = item.category === "image"
      ? apiUrl(`/api/files/thumb?path=${encodeURIComponent(item.path)}&token=${encodeURIComponent(state.token)}`)
      : "";
    const thumbHtml = thumbUrl
      ? `<img src="${thumbUrl}" loading="lazy" alt="${item.name}" />`
      : getCategoryIcon(item.category);

    const subText = item.is_dir
      ? "Folder"
      : `${formatBytes(item.size)} • ${formatDate(item.mtime)}`;

    const starClass = item.starred ? "starred" : "";
    const trashActions = state.view === "trash"
      ? `<button class="mini-btn" title="Restore" onclick="event.stopPropagation(); restoreItem('${item.path.replace(/'/g, "\\'")}')">↩</button>
         <button class="mini-btn" title="Delete Forever" onclick="event.stopPropagation(); deleteForever('${item.path.replace(/'/g, "\\'")}')">✕</button>`
      : `<button class="mini-btn ${starClass}" title="Star" onclick="event.stopPropagation(); toggleStar(${idx})">★</button>
         <button class="mini-btn" title="Rename" onclick="event.stopPropagation(); renameItem(${idx})">✎</button>
         <button class="mini-btn" title="Move to Trash" onclick="event.stopPropagation(); trashItem(${idx})">🗑</button>`;

    return `
      <div class="file-card" onclick="openItem(${idx})">
        <div class="file-thumb">${thumbHtml}</div>
        <div class="file-body">
          <div class="file-meta">
            <div class="file-name" title="${item.name}">${item.name}</div>
            <div class="file-sub">${subText}</div>
          </div>
          <div class="file-actions">${trashActions}</div>
        </div>
      </div>
    `;
  }).join("");
}

window.openItem = async function (idx) {
  const item = state.items[idx];
  if (!item) return;
  if (item.is_dir) {
    if (state.view === "trash") return;
    navigateFolder(item.path);
    return;
  }

  state.previewItem = item;
  const modal = document.getElementById("previewModal");
  const title = document.getElementById("previewTitle");
  const body = document.getElementById("previewBody");
  const dlBtn = document.getElementById("previewDownloadBtn");

  title.textContent = item.name;
  const contentUrl = apiUrl(`/api/files/content?path=${encodeURIComponent(item.path)}&token=${encodeURIComponent(state.token)}`);
  dlBtn.href = `${contentUrl}&download=1`;

  if (item.category === "image") {
    body.innerHTML = `<img src="${contentUrl}" alt="${item.name}" />`;
  } else if (item.category === "video") {
    body.innerHTML = `<video src="${contentUrl}" controls autoplay></video>`;
  } else if (item.category === "audio") {
    body.innerHTML = `<audio src="${contentUrl}" controls autoplay></audio>`;
  } else if (item.size < 250000 && (item.category === "document" || item.name.endsWith(".md") || item.name.endsWith(".txt"))) {
    const resp = await fetch(contentUrl);
    const text = await resp.text();
    const pre = document.createElement("pre");
    pre.textContent = text;
    body.innerHTML = "";
    body.appendChild(pre);
  } else {
    body.innerHTML = `
      <div style="text-align:center">
        ${getCategoryIcon(item.category)}
        <p style="margin:12px 0;color:#94a3b8">${item.name} (${formatBytes(item.size)})</p>
        <a href="${contentUrl}&download=1" class="btn-primary">Download File</a>
      </div>`;
  }
  modal.classList.remove("hidden");
};

window.closePreview = function () {
  document.getElementById("previewModal").classList.add("hidden");
  document.getElementById("previewBody").innerHTML = "";
};

window.shareCurrentFile = async function () {
  if (!state.previewItem) return;
  const res = await apiFetch("/api/files/share", {
    method: "POST",
    body: { path: state.previewItem.path }
  });
  if (res.ok) {
    const fullUrl = `${window.location.origin}${res.share_url}`;
    navigator.clipboard?.writeText(fullUrl);
    alert(`Share link copied to clipboard:\n${fullUrl}`);
  }
};

// ==================== FILE OPERATIONS ====================
window.openUploadPicker = function () {
  document.getElementById("fileInput").click();
};

window.triggerOneClickBackup = function () {
  document.getElementById("backupInput").click();
};

window.handleFilesSelected = async function (fileList, source = "upload") {
  if (!fileList || !fileList.length) return;
  const files = Array.from(fileList);
  const progressCard = document.getElementById("uploadProgressCard");
  const titleEl = document.getElementById("uploadProgressTitle");
  const pctEl = document.getElementById("uploadProgressPct");
  const barEl = document.getElementById("uploadProgressBar");

  progressCard.classList.remove("hidden");
  let uploadedCount = 0;
  let skippedDupes = 0;

  const targetFolder = source === "backup"
    ? "Camera Backup"
    : (source === "gdrive" ? "Google Drive Imports" : state.currentPath);

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const pct = Math.round(((i) / files.length) * 100);
    titleEl.textContent = source === "backup"
      ? `1-Click Photo Backup (${i + 1}/${files.length}): ${f.name}`
      : `Uploading (${i + 1}/${files.length}): ${f.name}`;
    pctEl.textContent = `${pct}%`;
    barEl.style.width = `${pct}%`;

    const fd = new FormData();
    fd.append("path", targetFolder);
    fd.append("source", source);
    fd.append("file", f, f.name);

    const res = await apiFetch("/api/files/upload", {
      method: "POST",
      body: fd
    });
    if (res.ok) {
      uploadedCount += res.count || 0;
      skippedDupes += res.skipped_duplicates || 0;
    }
  }

  barEl.style.width = "100%";
  pctEl.textContent = "100%";
  titleEl.textContent = source === "backup"
    ? `Backup Complete! ${uploadedCount} new photos saved (${skippedDupes} duplicates skipped)`
    : `Uploaded ${uploadedCount} file(s) to Fabric Drive`;

  setTimeout(() => progressCard.classList.add("hidden"), 4000);
  loadFiles();
};

window.promptNewFolder = async function () {
  const name = prompt("New folder name:");
  if (!name) return;
  await apiFetch("/api/files/mkdir", {
    method: "POST",
    body: { path: state.currentPath, name }
  });
  loadFiles();
};

window.toggleStar = async function (idx) {
  const item = state.items[idx];
  if (!item) return;
  await apiFetch("/api/files/star", {
    method: "POST",
    body: { path: item.path, starred: !item.starred }
  });
  loadFiles();
};

window.renameItem = async function (idx) {
  const item = state.items[idx];
  if (!item) return;
  const newName = prompt("Rename to:", item.name);
  if (!newName || newName === item.name) return;
  await apiFetch("/api/files/rename", {
    method: "POST",
    body: { path: item.path, new_name: newName }
  });
  loadFiles();
};

window.trashItem = async function (idx) {
  const item = state.items[idx];
  if (!item) return;
  await apiFetch("/api/files/trash", {
    method: "POST",
    body: { path: item.path, action: "trash" }
  });
  loadFiles();
};

window.restoreItem = async function (relPath) {
  await apiFetch("/api/files/trash", {
    method: "POST",
    body: { path: relPath, action: "restore" }
  });
  loadFiles();
};

window.deleteForever = async function (relPath) {
  if (!confirm("Permanently delete this item from Samba storage?")) return;
  await apiFetch("/api/files/trash", {
    method: "POST",
    body: { path: relPath, action: "delete" }
  });
  loadFiles();
};

window.emptyTrash = async function () {
  if (!confirm("Empty all items in your trash?")) return;
  await apiFetch("/api/files/trash", {
    method: "POST",
    body: { action: "empty_trash" }
  });
  loadFiles();
};

// ==================== GOOGLE DRIVE IMPORTER ====================
window.openGDriveModal = function () {
  const savedTok = localStorage.getItem("fabric.gdriveAccessToken") || "";
  if (savedTok) {
    document.getElementById("gdriveAccessToken").value = savedTok;
  }
  document.getElementById("gdriveModal").classList.remove("hidden");
};

window.closeModal = function (id) {
  document.getElementById(id).classList.add("hidden");
};

window.connectGoogleDrivePopup = async function () {
  const statusEl = document.getElementById("gdriveImportStatus");
  statusEl.classList.remove("hidden");
  statusEl.textContent = "Opening Google OAuth popup for Drive image access...";
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope("https://www.googleapis.com/auth/drive.readonly");
    const result = await signInWithPopup(fbAuth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential && credential.accessToken) {
      localStorage.setItem("fabric.gdriveAccessToken", credential.accessToken);
      document.getElementById("gdriveAccessToken").value = credential.accessToken;
      await startGDriveOAuthImport();
    } else {
      statusEl.textContent = "Connected! Paste your OAuth token above to pull images.";
    }
  } catch (err) {
    statusEl.textContent = "Popup error: " + err.message;
  }
};

window.startGDriveOAuthImport = async function () {
  const token = document.getElementById("gdriveAccessToken").value.trim();
  const statusEl = document.getElementById("gdriveImportStatus");
  statusEl.classList.remove("hidden");
  if (!token) {
    statusEl.textContent = "Please provide a Google OAuth Access Token or click Connect Google.";
    return;
  }
  statusEl.textContent = "Scanning Google Drive for images and importing into Samba vault...";
  const res = await apiFetch("/api/gdrive/import", {
    method: "POST",
    body: { access_token: token, target_folder: "Google Drive Imports" }
  });
  if (res.ok) {
    statusEl.textContent = `Imported ${res.count} image(s) into 'Google Drive Imports'!` + (res.errors?.length ? ` (${res.errors[0]})` : "");
    loadFiles();
  } else {
    statusEl.textContent = "Import failed: " + (res.error || "Unknown error");
  }
};

window.importGDriveLinks = async function () {
  const raw = document.getElementById("gdriveLinksInput").value.trim();
  const links = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const statusEl = document.getElementById("gdriveImportStatus");
  statusEl.classList.remove("hidden");
  if (!links.length) {
    statusEl.textContent = "Paste at least one Google Drive link or image URL.";
    return;
  }
  statusEl.textContent = `Importing ${links.length} image(s) into 'Google Drive Imports'...`;
  const res = await apiFetch("/api/gdrive/import", {
    method: "POST",
    body: { links, target_folder: "Google Drive Imports" }
  });
  if (res.ok) {
    statusEl.textContent = `Successfully imported ${res.count} image(s) into 'Google Drive Imports'!`;
    loadFiles();
  }
};

// ==================== USERS & SAMBA MODALS ====================
window.openUsersModal = async function () {
  document.getElementById("usersModal").classList.remove("hidden");
  const res = await apiFetch("/api/users");
  if (!res.ok) return;
  const list = document.getElementById("usersListContainer");
  list.innerHTML = res.users.map(u => `
    <div class="user-row">
      <div>
        <strong>@${u.username}</strong> — ${u.display_name}
        <div style="font-size:11px;color:#94a3b8">Vault: <code>/srv/media/fabric-drive/users/${u.username}</code></div>
      </div>
      <span class="dl-chip">${u.username === state.user?.username ? "Active Session" : "Isolated"}</span>
    </div>
  `).join("");
};

window.handleAdminCreateUser = async function (e) {
  e.preventDefault();
  const username = document.getElementById("newVaultUser").value.trim();
  const display_name = document.getElementById("newVaultName").value.trim();
  const password = document.getElementById("newVaultPass").value;
  const res = await apiFetch("/api/auth/register", {
    method: "POST",
    body: { username, display_name, password }
  });
  if (res.ok) {
    document.getElementById("newVaultUser").value = "";
    document.getElementById("newVaultName").value = "";
    document.getElementById("newVaultPass").value = "";
    openUsersModal();
  } else {
    alert(res.error || "Could not create user");
  }
};

window.openSambaModal = function () {
  document.getElementById("customServerUrlInput").value = state.apiBase || window.location.origin;
  document.getElementById("sambaModal").classList.remove("hidden");
};

window.saveServerEndpoint = function () {
  const val = document.getElementById("customServerUrlInput").value.trim();
  state.apiBase = val;
  localStorage.setItem("fabric.apiBase", val);
  closeModal("sambaModal");
  initApp();
};

window.openAppsModal = function () {
  document.getElementById("appsModal").classList.remove("hidden");
};

// Drag and Drop upload support
const dropZone = document.getElementById("dropZone");
if (dropZone) {
  dropZone.addEventListener("dragover", e => {
    e.preventDefault();
  });
  dropZone.addEventListener("drop", e => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) {
      handleFilesSelected(e.dataTransfer.files, "upload");
    }
  });
}

// Keyboard shortcut '/' for search
window.addEventListener("keydown", e => {
  if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
    e.preventDefault();
    document.getElementById("searchInput")?.focus();
  }
});

// ==================== INITIALIZATION ====================
async function initApp() {
  try {
    const status = await apiFetch("/api/status");
    if (status.ok && status.samba) {
      const s = status.samba;
      document.getElementById("sambaStatusText").textContent =
        `smbd: ${s.smbd ? "ON" : "OFF"} • nmbd: ${s.nmbd ? "ON" : "OFF"}`;
      document.getElementById("diskFreeText").textContent =
        `Server Disk: ${formatBytes(s.disk_free)} Free`;
      document.getElementById("modalSambaDaemons").textContent =
        `smbd: ${s.smbd ? "active" : "inactive"} | nmbd: ${s.nmbd ? "active" : "inactive"}`;
    }
  } catch (e) {
    console.warn("Server status ping failed:", e);
  }

  if (state.token) {
    try {
      const me = await apiFetch("/api/auth/me");
      if (me.ok && me.user) {
        completeSignIn(state.token, me.user);
        return;
      }
    } catch (e) {}
  }
}

initApp();
