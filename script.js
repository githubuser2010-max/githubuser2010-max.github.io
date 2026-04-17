import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-analytics.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDOQxD2mskQWJ2wntxVwd4i8rlueZvjZ7k",
    authDomain: "modern-tangent-452414-t7.firebaseapp.com",
    projectId: "modern-tangent-452414-t7",
    storageBucket: "modern-tangent-452414-t7.firebasestorage.app",
    messagingSenderId: "748243935000",
    appId: "1:748243935000:web:5c5c3e98c3496c6cc6086d",
    measurementId: "G-5CTKRS3F8H"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let tasks = [];
let notes = [];
let shortcuts = [];
let subjects = [];
let recycleBin = [];
let streakData = { count: 0, bestStreak: 0, lastCompleted: null };
let userXP = 0;
let userLevel = 1;
let focusSessions = [];
let currentFilterSelection = 'all';
let selectedFocusTask = null;
let todayFocusTime = 0;
let audioContext = null;
let noiseSource = null;
let showPinnedNotes = false;
let panInterval = null;
let timerInterval = null;
let timerMinutes = 25;
let timerSeconds = 0;
let timerRunning = false;
let completedTasksXP = {};
let unlockedAchievements = [];

const affirmations = [
    "You're closer than you were yesterday. Keep going.",
    "Every minute of study counts. Stay focused.",
    "Your future self will thank you for studying today.",
    "Consistency beats perfection. Just show up.",
    "The pain of discipline is better than the pain of regret.",
    "You're building something great, one task at a time.",
    "Focus on progress, not perfection.",
    "Small steps lead to big achievements.",
    "Your dedication is inspiring. Keep it up.",
    "Champions are made in the hours nobody sees."
];

const achievements = [
    { id: 'first_task', name: 'First Steps', desc: 'Complete your first task', icon: '🎯', xp: 50 },
    { id: 'streak_3', name: 'Getting Warmed Up', desc: '3 day streak', icon: '🔥', xp: 100 },
    { id: 'streak_7', name: 'On Fire', desc: '7 day streak', icon: '🔥', xp: 250 },
    { id: 'tasks_10', name: 'Task Destroyer', desc: 'Complete 10 tasks', icon: '⚡', xp: 200 },
    { id: 'tasks_50', name: 'Productivity Machine', desc: 'Complete 50 tasks', icon: '🚀', xp: 500 },
    { id: 'study_1h', name: 'Focused', desc: 'Study for 1 hour', icon: '⏱️', xp: 100 },
    { id: 'notes_10', name: 'Note Taker', desc: 'Create 10 notes', icon: '📝', xp: 150 },
    { id: 'level_5', name: 'Rising Star', desc: 'Reach Level 5', icon: '⭐', xp: 300 }
];

// Initialize theme from localStorage
if (localStorage.getItem('theme') === 'dark') {
    document.body.dataset.theme = 'dark';
}

console.log('Script loaded');

// Firebase Auth
document.getElementById('google-signin').addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error('Google sign in error:', error);
        alert('Error signing in with Google: ' + error.message);
    }
});

// Auth tabs
document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        if (tab.dataset.tab === 'signin') {
            document.getElementById('email-signin-form').classList.add('active');
        } else {
            document.getElementById('email-register-form').classList.add('active');
        }
    });
});

document.getElementById('email-signin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert('Error signing in: ' + error.message);
    }
});

document.getElementById('email-register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('register-email-input').value;
    const password = document.getElementById('register-password-input').value;
    const confirm = document.getElementById('register-confirm-input').value;
    
    if (password !== confirm) {
        alert('Passwords do not match');
        return;
    }
    if (password.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }
    
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        alert('Account created successfully!');
    } catch (error) {
        alert('Error creating account: ' + error.message);
    }
});

document.getElementById('signout').addEventListener('click', async () => {
    await signOut(auth);
});

// Theme Toggle
document.getElementById('theme-toggle').addEventListener('click', () => {
    const isDark = document.body.dataset.theme === 'dark';
    document.body.dataset.theme = isDark ? '' : 'dark';
    document.getElementById('theme-toggle').textContent = isDark ? '🌙' : '☀️';
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
});

// Auth State
onAuthStateChanged(auth, async (user) => {
    console.log('Auth state changed:', user ? user.uid : 'no user');
    currentUser = user;
    if (user) {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        
        await initializeUserData();
        startClock();
        loadData();
        
        const userNameEl = document.getElementById('user-name');
        if (userNameEl) {
            userNameEl.textContent = userProfile.name || user.displayName || user.email;
        }
    } else {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('dashboard').classList.add('hidden');
        tasks = [];
        notes = [];
        shortcuts = [];
        subjects = [];
        recycleBin = [];
        userXP = 0;
        userLevel = 1;
        streakData = { count: 0, bestStreak: 0, lastCompleted: null };
        focusSessions = [];
        completedTasksXP = {};
        updateXPDisplay();
        updateStreakDisplay();
    }
});

async function initializeUserData() {
    try {
        const userDataRef = doc(db, 'users', currentUser.uid, 'data', 'profile');
        const snapshot = await getDoc(userDataRef);
        
        if (!snapshot.exists()) {
            await setDoc(userDataRef, {
                xp: 0,
                level: 1,
                streak: { count: 0, bestStreak: 0, lastCompleted: null },
                completedTasksXP: {},
                createdAt: Date.now()
            });
        }
    } catch (error) {
        console.error('Error initializing user data:', error);
    }
}

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const page = item.dataset.page;
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`).classList.add('active');
        document.querySelector('.page-title').textContent = item.textContent.trim().split(' ')[0];
    });
});

window.navigateTo = function(page) {
    const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navItem) navItem.click();
};

// Clock
function startClock() {
    updateClock();
    setInterval(updateClock, 1000);
}

function updateClock() {
    const now = new Date();
    const clockEl = document.getElementById('clock');
    const dateEl = document.getElementById('date');
    if (clockEl) clockEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });
    if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Data Loading
function loadData() {
    if (!currentUser) return;
    console.log('Loading data for:', currentUser.uid);
    
    // Tasks listener
    const tasksRef = collection(db, 'users', currentUser.uid, 'tasks');
    onSnapshot(tasksRef, (snapshot) => {
        console.log('Tasks updated:', snapshot.size);
        tasks = [];
        snapshot.forEach(doc => {
            tasks.push({ id: doc.id, ...doc.data() });
        });
        renderTasks();
        updateUrgencyIndicator();
        renderFocusTaskList();
        console.log('Tasks loaded:', tasks.length);
    }, (error) => {
        console.error('Tasks error:', error);
    });

    // Notes listener
    const notesRef = collection(db, 'users', currentUser.uid, 'notes');
    onSnapshot(notesRef, (snapshot) => {
        console.log('Notes updated:', snapshot.size);
        notes = [];
        snapshot.forEach(doc => {
            notes.push({ id: doc.id, ...doc.data() });
        });
        renderNotes();
        console.log('Notes loaded:', notes.length);
    }, (error) => {
        console.error('Notes error:', error);
    });

    // Shortcuts listener
    const shortcutsRef = collection(db, 'users', currentUser.uid, 'shortcuts');
    onSnapshot(shortcutsRef, (snapshot) => {
        shortcuts = [];
        snapshot.forEach(doc => {
            shortcuts.push({ id: doc.id, ...doc.data() });
        });
        renderShortcuts();
    }, (error) => {
        console.error('Shortcuts error:', error);
    });

    // Subjects listener
    const subjectsRef = collection(db, 'users', currentUser.uid, 'subjects');
    onSnapshot(subjectsRef, (snapshot) => {
        console.log('Subjects updated:', snapshot.size);
        subjects = [];
        snapshot.forEach(doc => {
            subjects.push({ id: doc.id, ...doc.data() });
        });
        renderSubjects();
        updateSubjectDropdowns();
        console.log('Subjects loaded:', subjects.length);
    }, (error) => {
        console.error('Subjects error:', error);
    });

    // Recycle Bin listener
    const recycleRef = collection(db, 'users', currentUser.uid, 'recycleBin');
    onSnapshot(recycleRef, (snapshot) => {
        recycleBin = [];
        snapshot.forEach(doc => {
            recycleBin.push({ id: doc.id, ...doc.data() });
        });
        renderRecycleBin();
        cleanOldRecycleItems();
    }, (error) => {
        console.error('Recycle bin error:', error);
    });

    // Focus sessions listener
    const focusSessionsRef = collection(db, 'users', currentUser.uid, 'focusSessions');
    onSnapshot(focusSessionsRef, (snapshot) => {
        focusSessions = [];
        snapshot.forEach(doc => {
            focusSessions.push({ id: doc.id, ...doc.data() });
        });
        focusSessions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        updateFocusStats();
        renderAnalytics();
        renderWeeklyGraph();
        updateDashboardPreviews();
        updateGoalsDisplay();
    }, (error) => {
        console.error('Focus sessions error:', error);
    });

    // User profile listener
    const userDataRef = doc(db, 'users', currentUser.uid, 'data', 'profile');
    onSnapshot(userDataRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();
            userXP = data.xp || 0;
            userLevel = data.level || 1;
            streakData = data.streak || { count: 0, bestStreak: 0, lastCompleted: null };
            completedTasksXP = data.completedTasksXP || {};
            unlockedAchievements = data.unlockedAchievements || [];
            
            // Load goals from Firestore
            if (data.goals) {
                goals = { ...goals, ...data.goals };
                localStorage.setItem('userGoals', JSON.stringify(goals));
                document.getElementById('goal-daily-tasks').value = goals.dailyTasks;
                document.getElementById('goal-daily-focus').value = goals.dailyFocus;
                document.getElementById('goal-daily-notes').value = goals.dailyNotes;
                document.getElementById('goal-weekly-tasks').value = goals.weeklyTasks;
                document.getElementById('goal-weekly-focus').value = goals.weeklyFocus;
                document.getElementById('goal-weekly-streak').value = goals.weeklyStreak;
                updateGoalsDisplay();
            }
        }
        updateXPDisplay();
        updateStreakDisplay();
        renderAchievements();
    }, (error) => {
        console.error('User data error:', error);
    });

    loadAffirmation();
    loadGoals();
    loadTimerPresets();
    loadStickyNotes();
    loadProfile();
    loadProfileFromFirestore();
}

// XP System
function calculateLevel(xp) {
    return Math.floor(xp / 500) + 1;
}

function addXP(amount) {
    userXP += amount;
    userLevel = calculateLevel(userXP);
    updateXPDisplay();
    updateUserProfile();
    checkAchievements();
}

function updateXPDisplay() {
    const levelEl = document.getElementById('user-level');
    const xpEl = document.getElementById('user-xp');
    const progressEl = document.getElementById('xp-progress');
    
    if (levelEl) levelEl.textContent = `Level ${userLevel}`;
    if (xpEl) xpEl.textContent = `${userXP} XP`;
    
    if (progressEl) {
        const currentLevelXP = (userLevel - 1) * 500;
        const nextLevelXP = userLevel * 500;
        const progress = ((userXP - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
        progressEl.style.width = `${Math.min(progress, 100)}%`;
    }
}

async function updateUserProfile() {
    try {
        await setDoc(doc(db, 'users', currentUser.uid, 'data', 'profile'), {
            xp: userXP,
            level: userLevel,
            streak: streakData,
            completedTasksXP: completedTasksXP,
            unlockedAchievements: unlockedAchievements
        }, { merge: true });
    } catch (error) {
        console.error('Error updating profile:', error);
    }
}

// Task Manager
document.getElementById('task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const title = document.getElementById('task-title').value.trim();
    const subject = document.getElementById('task-subject').value;
    const date = document.getElementById('task-date').value;
    const time = document.getElementById('task-time').value;
    const priority = document.getElementById('task-priority').value;
    const estTime = parseInt(document.getElementById('task-est-time').value) || 0;
    
    if (!title || !date || !time) {
        alert('Please fill in title, date, and time');
        return;
    }

    try {
        await addDoc(collection(db, 'users', currentUser.uid, 'tasks'), {
            title,
            subject,
            date,
            time,
            priority,
            estTime,
            completed: false,
            createdAt: Date.now()
        });
        console.log('Task added');
        document.getElementById('task-form').reset();
    } catch (error) {
        console.error('Error adding task:', error);
        alert('Error adding task: ' + error.message);
    }
});

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilterSelection = btn.dataset.filter;
        renderTasks();
    });
});

function renderTasks() {
    const container = document.getElementById('task-list');
    if (!container) return;
    container.innerHTML = '';
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);
    
    let filteredTasks = [...tasks];
    
    if (currentFilterSelection === 'today') {
        filteredTasks = filteredTasks.filter(t => t.date === today && !t.completed);
    } else if (currentFilterSelection === 'overdue') {
        filteredTasks = filteredTasks.filter(t => 
            !t.completed && (t.date < today || (t.date === today && t.time < currentTime))
        );
    } else if (currentFilterSelection === 'completed') {
        filteredTasks = filteredTasks.filter(t => t.completed);
    } else if (currentFilterSelection === 'all') {
        filteredTasks = filteredTasks.filter(t => {
            if (!t.completed) return true;
            if (t.date >= today) return true;
            return false;
        });
    }
    
    filteredTasks.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
    });
    
    if (filteredTasks.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); padding: 20px; text-align: center;">No tasks found</p>';
        return;
    }
    
    filteredTasks.forEach(task => {
        const isOverdue = !task.completed && (task.date < today || (task.date === today && task.time < currentTime));
        const div = document.createElement('div');
        div.className = `task-item ${task.completed ? 'completed' : ''} ${task.priority || 'medium'}-priority ${isOverdue ? 'overdue' : ''}`;
        div.innerHTML = `
            <div class="task-header">
                <span class="task-title">${task.title}</span>
                <span class="task-priority ${task.priority || 'medium'}">${task.priority || 'medium'}</span>
            </div>
            <div class="task-meta">
                ${task.date} at ${task.time}
                ${task.estTime ? ` • Est: ${task.estTime} min` : ''}
            </div>
            <div class="task-tags">
                ${task.subject ? `<span class="task-subject">${task.subject}</span>` : ''}
            </div>
            <div class="task-actions">
                ${!task.completed ? `<button class="btn btn-small" onclick="window.focusTask('${task.id}')">Focus</button>` : ''}
                <button class="btn btn-small" onclick="window.editTask('${task.id}')">Edit</button>
                <button class="btn btn-small" onclick="window.toggleTask('${task.id}', ${!task.completed})">${task.completed ? 'Undo' : 'Done'}</button>
                <button class="btn btn-small btn-danger" onclick="window.deleteTask('${task.id}')">Delete</button>
            </div>
        `;
        container.appendChild(div);
    });
}

window.toggleTask = async function(taskId, completed) {
    try {
        await updateDoc(doc(db, 'users', currentUser.uid, 'tasks', taskId), {
            completed,
            completedAt: completed ? Date.now() : null
        });
        
        if (completed) {
            const xpAmount = 25;
            addXP(xpAmount);
            completedTasksXP[taskId] = xpAmount;
            updateUserProfile();
            updateStreak();
            showNotification('Task completed! +' + xpAmount + ' XP');
        } else {
            if (completedTasksXP[taskId]) {
                userXP -= completedTasksXP[taskId];
                userLevel = calculateLevel(userXP);
                delete completedTasksXP[taskId];
                updateXPDisplay();
                updateUserProfile();
                showNotification('Task undone. XP removed.');
            }
        }
    } catch (error) {
        console.error('Error toggling task:', error);
    }
};

window.editTask = function(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    document.getElementById('edit-task-id').value = task.id;
    document.getElementById('edit-task-title').value = task.title || '';
    document.getElementById('edit-task-subject').value = task.subject || '';
    document.getElementById('edit-task-date').value = task.date || '';
    document.getElementById('edit-task-time').value = task.time || '';
    document.getElementById('edit-task-priority').value = task.priority || 'medium';
    document.getElementById('edit-task-est-time').value = task.estTime || '';
    
    updateSubjectDropdownsForEdit('edit-task-subject', task.subject);
    
    document.getElementById('edit-task-modal').classList.remove('hidden');
};

function closeTaskModal() {
    document.getElementById('edit-task-modal').classList.add('hidden');
}

document.getElementById('edit-task-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const taskId = document.getElementById('edit-task-id').value;
    const title = document.getElementById('edit-task-title').value.trim();
    const subject = document.getElementById('edit-task-subject').value;
    const date = document.getElementById('edit-task-date').value;
    const time = document.getElementById('edit-task-time').value;
    const priority = document.getElementById('edit-task-priority').value;
    const estTime = parseInt(document.getElementById('edit-task-est-time').value) || 0;
    
    if (!title || !date || !time) {
        alert('Please fill in title, date, and time');
        return;
    }
    
    try {
        await updateDoc(doc(db, 'users', currentUser.uid, 'tasks', taskId), {
            title, subject, date, time, priority, estTime
        });
        closeTaskModal();
        showNotification('Task updated', 'subtle');
    } catch (error) {
        console.error('Error updating task:', error);
    }
});

window.deleteTask = async function(taskId) {
    if (confirm('Move this task to Recycle Bin?')) {
        try {
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                await addDoc(collection(db, 'users', currentUser.uid, 'recycleBin'), {
                    ...task,
                    type: 'task',
                    deletedAt: Date.now()
                });
                if (task.completed && completedTasksXP[taskId]) {
                    userXP -= completedTasksXP[taskId];
                    userLevel = calculateLevel(userXP);
                    delete completedTasksXP[taskId];
                    updateXPDisplay();
                    updateUserProfile();
                }
            }
            await deleteDoc(doc(db, 'users', currentUser.uid, 'tasks', taskId));
            showNotification('Task moved to Recycle Bin', 'subtle');
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    }
};

window.focusTask = function(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    selectedFocusTask = task;
    timerMinutes = (task.estTime && task.estTime > 0) ? task.estTime : 25;
    timerSeconds = 0;
    
    const displayEl = document.getElementById('current-task-display');
    if (displayEl) displayEl.textContent = `Working on: ${task.title}`;
    
    updateTimerDisplay();
    document.querySelectorAll('.timer-mode').forEach(m => m.classList.remove('active'));
    renderFocusTaskList();
    document.querySelector('[data-page="focus"]').click();
};

// Streak System
async function updateStreak() {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    if (streakData.lastCompleted !== today) {
        streakData.count = (streakData.lastCompleted === yesterdayStr) ? streakData.count + 1 : 1;
        streakData.lastCompleted = today;
        if (streakData.count > streakData.bestStreak) {
            streakData.bestStreak = streakData.count;
        }
        updateStreakDisplay();
        updateUserProfile();
    }
}

function updateStreakDisplay() {
    const count = streakData.count || 0;
    const countEl = document.getElementById('streak-count');
    const fireEl = document.getElementById('streak-fire');
    
    if (countEl) countEl.textContent = count;
    if (fireEl) {
        if (count > 0) {
            fireEl.classList.add('active');
            if (countEl) countEl.classList.add('active');
        } else {
            fireEl.classList.remove('active');
            if (countEl) countEl.classList.remove('active');
        }
    }
}

// Weekly Graph
function renderWeeklyGraph() {
    const container = document.getElementById('weekly-graph');
    if (!container) return;
    
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
    
    let html = '';
    days.forEach((day, i) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        const hasSession = focusSessions.some(s => s.date === dateStr);
        const isToday = dateStr === today.toISOString().split('T')[0];
        
        html += `<div class="week-day ${hasSession ? 'active' : ''} ${isToday ? 'today' : ''}" title="${dateStr}">${day}</div>`;
    });
    
    container.innerHTML = html;
}

// Urgency Indicator
function updateUrgencyIndicator() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);
    
    const upcomingTasks = tasks
        .filter(t => !t.completed && (t.date > today || (t.date === today && t.time >= currentTime)))
        .sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.time.localeCompare(b.time);
        });
    
    const urgentTaskEl = document.getElementById('urgent-task');
    if (!urgentTaskEl) return;
    
    if (upcomingTasks.length > 0) {
        const task = upcomingTasks[0];
        const taskDateTime = new Date(`${task.date}T${task.time}`);
        const diffMs = taskDateTime - now;
        const diffHours = diffMs / (1000 * 60 * 60);
        
        let timeText = '';
        if (diffHours <= 1) timeText = '<1h';
        else if (diffHours <= 24) timeText = `${Math.floor(diffHours)}h`;
        else timeText = `${Math.floor(diffHours / 24)}d`;
        
        urgentTaskEl.textContent = `${task.title} (${timeText})`;
    } else {
        urgentTaskEl.textContent = 'None';
    }
}

// Notes
document.getElementById('note-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const title = document.getElementById('note-title').value.trim() || 'Untitled Note';
    const subject = document.getElementById('note-subject').value;
    const color = document.getElementById('note-color').value;
    const content = document.getElementById('note-content')?.value || '';
    
    try {
        await addDoc(collection(db, 'users', currentUser.uid, 'notes'), {
            title,
            subject,
            color,
            content,
            pinned: false,
            createdAt: Date.now()
        });
        document.getElementById('note-form').reset();
        addXP(10);
    } catch (error) {
        console.error('Error adding note:', error);
    }
});

document.getElementById('note-search')?.addEventListener('input', (e) => {
    renderNotes(e.target.value);
});

function renderNotes(search = '') {
    const container = document.getElementById('note-list');
    if (!container) return;
    container.innerHTML = '';
    
    let filteredNotes = [...notes];
    
    if (showPinnedNotes) {
        filteredNotes = filteredNotes.filter(n => n.pinned);
    }
    
    if (search) {
        filteredNotes = filteredNotes.filter(n => 
            (n.title && n.title.toLowerCase().includes(search.toLowerCase())) ||
            (n.content && n.content.toLowerCase().includes(search.toLowerCase()))
        );
    }
    
    filteredNotes.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    
    if (filteredNotes.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); grid-column: span 2; padding: 20px; text-align: center;">No notes found</p>';
        return;
    }
    
    filteredNotes.forEach(note => {
        const div = document.createElement('div');
        div.className = `note-item ${note.pinned ? 'pinned' : ''}`;
        div.style.setProperty('--note-color', note.color || '#3B82F6');
        div.innerHTML = `
            <div class="note-title">${note.title || 'Untitled'}</div>
            <p>${note.content || ''}</p>
            <div class="note-actions">
                <button class="btn btn-small" onclick="window.togglePinNote('${note.id}', ${!note.pinned})">${note.pinned ? 'Unpin' : 'Pin'}</button>
                <button class="btn btn-small" onclick="window.editNote('${note.id}')">Edit</button>
                <button class="btn btn-small btn-danger" onclick="window.deleteNote('${note.id}')">Delete</button>
            </div>
        `;
        container.appendChild(div);
    });
}

window.togglePinNote = async function(id, pinned) {
    try {
        await updateDoc(doc(db, 'users', currentUser.uid, 'notes', id), { pinned });
    } catch (error) {
        console.error('Error pinning note:', error);
    }
};

window.editNote = function(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    
    document.getElementById('edit-note-id').value = note.id;
    document.getElementById('edit-note-title').value = note.title || '';
    document.getElementById('edit-note-content').value = note.content || '';
    document.getElementById('edit-note-subject').value = note.subject || '';
    document.getElementById('edit-note-color').value = note.color || '#3B82F6';
    
    updateSubjectDropdownsForEdit('edit-note-subject', note.subject);
    
    document.getElementById('edit-note-modal').classList.remove('hidden');
};

function closeNoteModal() {
    document.getElementById('edit-note-modal').classList.add('hidden');
}

document.getElementById('edit-note-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const noteId = document.getElementById('edit-note-id').value;
    const title = document.getElementById('edit-note-title').value.trim() || 'Untitled';
    const content = document.getElementById('edit-note-content').value;
    const subject = document.getElementById('edit-note-subject').value;
    const color = document.getElementById('edit-note-color').value;
    
    try {
        await updateDoc(doc(db, 'users', currentUser.uid, 'notes', noteId), {
            title, content, subject, color
        });
        closeNoteModal();
        showNotification('Note updated', 'subtle');
    } catch (error) {
        console.error('Error updating note:', error);
    }
});

window.deleteNote = async function(id) {
    if (confirm('Move this note to Recycle Bin?')) {
        try {
            const note = notes.find(n => n.id === id);
            if (note) {
                await addDoc(collection(db, 'users', currentUser.uid, 'recycleBin'), {
                    ...note,
                    type: 'note',
                    deletedAt: Date.now()
                });
            }
            await deleteDoc(doc(db, 'users', currentUser.uid, 'notes', id));
            showNotification('Note moved to Recycle Bin', 'subtle');
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    }
};

// Subjects
document.getElementById('add-subject-btn')?.addEventListener('click', async () => {
    const name = prompt('Subject name:');
    if (!name) return;
    
    const colors = ['#3B82F6', '#22C55E', '#EAB308', '#EF4444', '#A855F7', '#EC4899', '#14B8A6', '#F97316'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    try {
        await addDoc(collection(db, 'users', currentUser.uid, 'subjects'), {
            name,
            color,
            topics: [],
            createdAt: Date.now()
        });
    } catch (error) {
        console.error('Error adding subject:', error);
    }
});

function renderSubjects() {
    const container = document.getElementById('subjects-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (subjects.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); padding: 40px; text-align: center;">No subjects yet. Click "+ Add Subject" to get started!</p>';
        return;
    }
    
    subjects.forEach(subject => {
        const div = document.createElement('div');
        div.className = 'subject-card';
        div.innerHTML = `
            <div class="subject-header">
                <span class="subject-name">${subject.name}</span>
                <div class="subject-actions">
                    <button class="btn btn-small btn-danger" onclick="window.deleteSubject('${subject.id}')">Delete</button>
                    <div class="subject-color" style="background: ${subject.color || '#3B82F6'}"></div>
                </div>
            </div>
            <div class="topics-list">
                ${(subject.topics || []).map(topic => `
                    <div class="topic-item">
                        <span>${topic}</span>
                        <button class="btn btn-small" onclick="window.removeTopic('${subject.id}', '${topic}')">×</button>
                    </div>
                `).join('')}
                <button class="add-topic-btn" onclick="window.addTopic('${subject.id}')">+ Add Topic</button>
            </div>
        `;
        container.appendChild(div);
    });
}

window.deleteSubject = async function(subjectId) {
    if (confirm('Delete this subject?')) {
        try {
            await deleteDoc(doc(db, 'users', currentUser.uid, 'subjects', subjectId));
            showNotification('Subject deleted', 'subtle');
        } catch (error) {
            console.error('Error deleting subject:', error);
        }
    }
};

window.addTopic = async function(subjectId) {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) return;
    
    const topic = prompt('Topic name:');
    if (!topic) return;
    
    const topics = subject.topics || [];
    topics.push(topic);
    
    try {
        await updateDoc(doc(db, 'users', currentUser.uid, 'subjects', subjectId), { topics });
    } catch (error) {
        console.error('Error adding topic:', error);
    }
};

window.removeTopic = async function(subjectId, topicName) {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) return;
    
    const topics = (subject.topics || []).filter(t => t !== topicName);
    
    try {
        await updateDoc(doc(db, 'users', currentUser.uid, 'subjects', subjectId), { topics });
    } catch (error) {
        console.error('Error removing topic:', error);
    }
};

function updateSubjectDropdowns() {
    const options = subjects.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    
    const taskSubject = document.getElementById('task-subject');
    const noteSubject = document.getElementById('note-subject');
    const focusFilter = document.getElementById('focus-subject-filter');
    
    if (taskSubject) taskSubject.innerHTML = '<option value="">Subject</option>' + options;
    if (noteSubject) noteSubject.innerHTML = '<option value="">Subject</option>' + options;
    if (focusFilter) focusFilter.innerHTML = '<option value="">All Subjects</option>' + options;
}

function updateSubjectDropdownsForEdit(elementId, currentValue) {
    const select = document.getElementById(elementId);
    if (!select) return;
    
    const options = subjects.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    select.innerHTML = '<option value="">Subject</option>' + options;
    
    if (currentValue) {
        select.value = currentValue;
    }
}

// Shortcuts
document.getElementById('shortcut-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('shortcut-name').value.trim();
    const url = document.getElementById('shortcut-url').value.trim();
    const category = document.getElementById('shortcut-cat')?.value || 'study';
    
    if (!name || !url) {
        alert('Please enter name and URL');
        return;
    }
    
    try {
        await addDoc(collection(db, 'users', currentUser.uid, 'shortcuts'), {
            name,
            url,
            category,
            createdAt: Date.now()
        });
        document.getElementById('shortcut-form').reset();
    } catch (error) {
        console.error('Error adding shortcut:', error);
    }
});

function renderShortcuts() {
    const container = document.getElementById('shortcut-grid');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (shortcuts.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); padding: 40px; text-align: center;">No shortcuts yet. Add one above!</p>';
        return;
    }
    
    const categoryFilter = document.getElementById('shortcut-category')?.value || 'all';
    let filteredShortcuts = shortcuts;
    if (categoryFilter !== 'all') {
        filteredShortcuts = shortcuts.filter(s => s.category === categoryFilter);
    }
    
    filteredShortcuts.forEach(shortcut => {
        const div = document.createElement('div');
        div.className = 'shortcut-item';
        div.innerHTML = `
            <div class="shortcut-actions">
                <button class="btn btn-small btn-danger" onclick="window.deleteShortcut('${shortcut.id}')">×</button>
            </div>
            <div class="shortcut-icon" onclick="window.openShortcut('${shortcut.url}')" style="cursor: pointer;">🔗</div>
            <div class="shortcut-name" onclick="window.openShortcut('${shortcut.url}')" style="cursor: pointer;">${shortcut.name}</div>
            <div class="shortcut-category">${shortcut.category || 'study'}</div>
        `;
        container.appendChild(div);
    });
}

window.openShortcut = function(url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    window.open(url, '_blank');
};

document.getElementById('shortcut-category')?.addEventListener('change', renderShortcuts);

window.deleteShortcut = async function(id) {
    if (confirm('Move this shortcut to Recycle Bin?')) {
        try {
            const shortcut = shortcuts.find(s => s.id === id);
            if (shortcut) {
                await addDoc(collection(db, 'users', currentUser.uid, 'recycleBin'), {
                    ...shortcut,
                    type: 'shortcut',
                    deletedAt: Date.now()
                });
            }
            await deleteDoc(doc(db, 'users', currentUser.uid, 'shortcuts', id));
            showNotification('Shortcut moved to Recycle Bin', 'subtle');
        } catch (error) {
            console.error('Error deleting shortcut:', error);
        }
    }
};

// Recycle Bin
function renderRecycleBin() {
    const container = document.getElementById('recycle-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (recycleBin.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); padding: 40px; text-align: center;">Recycle Bin is empty</p>';
        return;
    }
    
    recycleBin.sort((a, b) => b.deletedAt - a.deletedAt);
    
    recycleBin.forEach(item => {
        const daysLeft = Math.ceil((30 * 24 * 60 * 60 * 1000 - (Date.now() - item.deletedAt)) / (24 * 60 * 60 * 1000));
        const div = document.createElement('div');
        div.className = 'recycle-item';
        div.innerHTML = `
            <div class="recycle-item-info">
                <span class="recycle-type">${item.type}</span>
                <span class="recycle-title">${item.title || item.name || 'Untitled'}</span>
                <span class="recycle-days">${daysLeft} days left</span>
            </div>
            <div class="recycle-actions">
                <button class="btn btn-small" onclick="window.restoreItem('${item.id}', '${item.type}')">Restore</button>
                <button class="btn btn-small btn-danger" onclick="window.permanentDelete('${item.id}')">Delete</button>
            </div>
        `;
        container.appendChild(div);
    });
}

window.restoreItem = async function(id, type) {
    try {
        const item = recycleBin.find(i => i.id === id);
        if (!item) return;
        
        delete item.type;
        delete item.deletedAt;
        delete item.id;
        
        if (type === 'task') {
            await addDoc(collection(db, 'users', currentUser.uid, 'tasks'), item);
        } else if (type === 'note') {
            await addDoc(collection(db, 'users', currentUser.uid, 'notes'), item);
        } else if (type === 'shortcut') {
            await addDoc(collection(db, 'users', currentUser.uid, 'shortcuts'), item);
        }
        
        const recycleRef = doc(db, 'users', currentUser.uid, 'recycleBin', id);
        await deleteDoc(recycleRef);
        showNotification('Item restored');
    } catch (error) {
        console.error('Error restoring item:', error);
    }
};

window.permanentDelete = async function(id) {
    if (confirm('Permanently delete this item? This cannot be undone.')) {
        try {
            await deleteDoc(doc(db, 'users', currentUser.uid, 'recycleBin', id));
            showNotification('Permanently deleted');
        } catch (error) {
            console.error('Error deleting item:', error);
            alert('Error deleting item: ' + error.message);
        }
    }
};

document.getElementById('empty-recycle')?.addEventListener('click', async () => {
    if (confirm('Empty Recycle Bin? All items will be permanently deleted.')) {
        try {
            const batch = [];
            recycleBin.forEach(item => {
                batch.push(deleteDoc(doc(db, 'users', currentUser.uid, 'recycleBin', item.id)));
            });
            await Promise.all(batch);
            showNotification('Recycle Bin emptied');
        } catch (error) {
            console.error('Error emptying recycle bin:', error);
            alert('Error emptying recycle bin: ' + error.message);
        }
    }
});

function cleanOldRecycleItems() {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    recycleBin.forEach(async (item) => {
        if (item.deletedAt < thirtyDaysAgo) {
            try {
                const recycleRef = doc(db, 'users', currentUser.uid, 'recycleBin', item.id);
                await deleteDoc(recycleRef);
            } catch (error) {
                console.error('Error cleaning old recycle item:', error);
            }
        }
    });
}

// Dashboard Previews
function updateDashboardPreviews() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);
    
    const incompleteTasks = tasks.filter(t => !t.completed);
    incompleteTasks.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
    });
    
    const tasksPreview = document.getElementById('dashboard-tasks-preview');
    if (tasksPreview) {
        if (incompleteTasks.length === 0) {
            tasksPreview.innerHTML = '<p style="color: var(--text-secondary); padding: 20px; text-align: center;">All tasks completed!</p>';
        } else {
            tasksPreview.innerHTML = incompleteTasks.map(t => {
                const isOverdue = t.date < today || (t.date === today && t.time < currentTime);
                return `
                    <div class="dashboard-task-item ${isOverdue ? 'overdue' : ''}">
                        <div class="dashboard-task-info">
                            <span class="dashboard-task-title">${t.title}</span>
                            <span class="dashboard-task-meta">${t.date} at ${t.time}${t.subject ? ' • ' + t.subject : ''}</span>
                        </div>
                        <span class="dashboard-task-priority ${t.priority || 'medium'}">${t.priority || 'medium'}</span>
                    </div>
                `;
            }).join('');
        }
    }
    
    const recentNotes = notes.slice(0, 3);
    const notesPreview = document.getElementById('dashboard-notes-preview');
    if (notesPreview) {
        if (recentNotes.length === 0) {
            notesPreview.innerHTML = '<p style="color: var(--text-secondary);">No notes yet</p>';
        } else {
            notesPreview.innerHTML = recentNotes.map(n => `
                <div class="preview-item">
                    <span class="preview-title">${n.title || 'Untitled'}</span>
                    <span class="preview-meta">${n.subject || 'No subject'}</span>
                </div>
            `).join('') + (notes.length > 3 ? `<p class="preview-more">+${notes.length - 3} more</p>` : '');
        }
    }
    
    const todayMins = focusSessions
        .filter(s => s.date === today)
        .reduce((sum, s) => sum + s.duration, 0);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekMins = focusSessions
        .filter(s => new Date(s.date) >= weekAgo)
        .reduce((sum, s) => sum + s.duration, 0);
    
    const dashToday = document.getElementById('dash-today-focus');
    const dashWeek = document.getElementById('dash-week-focus');
    const dashTasks = document.getElementById('dash-tasks-done');
    const dashXP = document.getElementById('dash-xp');
    
    let liveMins = 0;
    let liveSecs = 0;
    if (timerRunning && sessionStartTime) {
        liveMins = Math.floor(liveFocusSeconds / 60);
        liveSecs = liveFocusSeconds % 60;
    }
    
    const displayTodayMins = todayMins + liveMins;
    
    if (dashToday) {
        if (timerRunning) {
            dashToday.textContent = `${displayTodayMins}m ${liveSecs}s`;
        } else {
            dashToday.textContent = formatTime(todayMins);
        }
    }
    if (dashWeek) dashWeek.textContent = formatTime(weekMins);
    if (dashTasks) dashTasks.textContent = tasks.filter(t => t.completed).length;
    if (dashXP) dashXP.textContent = userXP;
}

document.getElementById('pin-notes')?.addEventListener('click', () => {
    showPinnedNotes = !showPinnedNotes;
    const btn = document.getElementById('pin-notes');
    if (btn) btn.textContent = showPinnedNotes ? '📌 Showing Pinned' : '📌 Show Pinned';
    renderNotes();
});

// Focus Mode Timer
document.getElementById('timer-start')?.addEventListener('click', startTimer);
document.getElementById('timer-pause')?.addEventListener('click', pauseTimer);
document.getElementById('timer-reset')?.addEventListener('click', resetTimer);
document.getElementById('timer-inc')?.addEventListener('click', () => { timerMinutes++; updateTimerDisplay(); });
document.getElementById('timer-dec')?.addEventListener('click', () => { if (timerMinutes > 1) { timerMinutes--; updateTimerDisplay(); } });

document.querySelectorAll('.timer-mode').forEach(mode => {
    mode.addEventListener('click', () => {
        timerMinutes = parseInt(mode.dataset.minutes);
        timerSeconds = 0;
        document.querySelectorAll('.timer-mode').forEach(m => m.classList.remove('active'));
        mode.classList.add('active');
        updateTimerDisplay();
    });
});

document.getElementById('set-custom')?.addEventListener('click', () => {
    const custom = parseInt(document.getElementById('custom-minutes')?.value);
    if (custom > 0 && custom <= 180) {
        timerMinutes = custom;
        timerSeconds = 0;
        document.querySelectorAll('.timer-mode').forEach(m => m.classList.remove('active'));
        updateTimerDisplay();
    }
});

// Dashboard Timer
document.getElementById('dash-timer-start')?.addEventListener('click', startTimer);
document.getElementById('dash-timer-pause')?.addEventListener('click', pauseTimer);
document.getElementById('dash-timer-reset')?.addEventListener('click', resetTimer);

document.querySelectorAll('.timer-mode-sm').forEach(mode => {
    mode.addEventListener('click', () => {
        timerMinutes = parseInt(mode.dataset.min);
        timerSeconds = 0;
        document.querySelectorAll('.timer-mode-sm').forEach(m => m.classList.remove('active'));
        mode.classList.add('active');
        updateTimerDisplay();
        updateDashTimerDisplay();
    });
});

let sessionStartTime = null;

function startTimer() {
    if (timerRunning) return;
    timerRunning = true;
    sessionStartTime = Date.now();
    
    timerInterval = setInterval(() => {
        if (timerSeconds === 0) {
            if (timerMinutes === 0) {
                pauseTimer();
                completeSession();
                return;
            }
            timerMinutes--;
            timerSeconds = 59;
        } else {
            timerSeconds--;
        }
        updateTimerDisplay();
        updateLiveFocusTime();
        renderAnalytics();
        updateDashboardPreviews();
    }, 1000);
}

let liveFocusSeconds = 0;

function updateLiveFocusTime() {
    if (!sessionStartTime) return;
    liveFocusSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);
}

function pauseTimer() {
    timerRunning = false;
    clearInterval(timerInterval);
    
    if (sessionStartTime) {
        const elapsed = Math.floor((Date.now() - sessionStartTime) / 60000);
        todayFocusTime += elapsed;
        updateFocusStats();
        renderAnalytics();
        updateDashboardPreviews();
        sessionStartTime = null;
    }
}

function resetTimer() {
    pauseTimer();
    timerMinutes = 25;
    timerSeconds = 0;
    updateTimerDisplay();
}

function completeSession() {
    const duration = timerMinutes || 25;
    todayFocusTime += duration;
    
    const session = {
        date: new Date().toISOString().split('T')[0],
        duration,
        task: selectedFocusTask?.title || 'General',
        timestamp: Date.now()
    };
    
    focusSessions.push(session);
    saveFocusSessionToFirestore(session);
    addXP(duration * 2);
    updateFocusStats();
    updateUserProfile();
    renderWeeklyGraph();
    renderAnalytics();
    
    showNotification(`Focus complete! +${duration * 2} XP`);
}

async function saveFocusSessionToFirestore(session) {
    if (!currentUser) return;
    try {
        await addDoc(collection(db, 'users', currentUser.uid, 'focusSessions'), session);
    } catch (error) {
        console.error('Error saving focus session:', error);
    }
}

function updateTimerDisplay() {
    const minsEl = document.getElementById('timer-minutes');
    const secsEl = document.getElementById('timer-seconds');
    if (minsEl) minsEl.textContent = timerMinutes.toString().padStart(2, '0');
    if (secsEl) secsEl.textContent = timerSeconds.toString().padStart(2, '0');
    updateDashTimerDisplay();
}

function updateDashTimerDisplay() {
    const minsEl = document.getElementById('dash-timer-min');
    const secsEl = document.getElementById('dash-timer-sec');
    if (minsEl) minsEl.textContent = timerMinutes.toString().padStart(2, '0');
    if (secsEl) secsEl.textContent = timerSeconds.toString().padStart(2, '0');
}

function updateFocusStats() {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const todayMins = focusSessions
        .filter(s => s.date === today)
        .reduce((sum, s) => sum + s.duration, 0);
    
    const weekMins = focusSessions
        .filter(s => new Date(s.date) >= weekAgo)
        .reduce((sum, s) => sum + s.duration, 0);
    
    let liveMins = 0;
    let liveSecs = 0;
    if (timerRunning && sessionStartTime) {
        liveMins = Math.floor(liveFocusSeconds / 60);
        liveSecs = liveFocusSeconds % 60;
    }
    
    const displayTodayMins = todayMins + liveMins;
    const displayTodaySecs = liveSecs;
    
    const todayEl = document.getElementById('today-focus-time');
    const weekEl = document.getElementById('week-focus-time');
    if (todayEl) {
        if (timerRunning) {
            todayEl.textContent = `${displayTodayMins}m ${displayTodaySecs}s`;
        } else {
            todayEl.textContent = formatTime(todayMins);
        }
    }
    if (weekEl) weekEl.textContent = formatTime(weekMins);
}

function renderFocusTaskList() {
    const container = document.getElementById('focus-task-list');
    const subjectFilter = document.getElementById('focus-subject-filter')?.value || '';
    
    if (!container) return;
    container.innerHTML = '';
    
    let filtered = tasks.filter(t => !t.completed);
    if (subjectFilter) {
        filtered = filtered.filter(t => t.subject === subjectFilter);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); padding: 20px; text-align: center;">No tasks to focus on</p>';
        return;
    }
    
    filtered.forEach(task => {
        const div = document.createElement('div');
        div.className = `focus-task-item ${selectedFocusTask?.id === task.id ? 'selected' : ''}`;
        div.innerHTML = `
            <div class="task-name">${task.title}</div>
            <div class="task-details">
                ${task.estTime ? `Est: ${task.estTime} min` : 'No estimate'}
                ${task.subject ? ` • ${task.subject}` : ''}
            </div>
        `;
        div.addEventListener('click', () => focusTask(task.id));
        container.appendChild(div);
    });
}

document.getElementById('focus-subject-filter')?.addEventListener('change', renderFocusTaskList);

// Ambient Sounds
let currentAudio = null;
let activeAmbient = null;
let masterAmbientGain = null;

document.getElementById('ambient-rain')?.addEventListener('click', () => playAmbient('rain'));
document.getElementById('ambient-ocean')?.addEventListener('click', () => playAmbient('ocean'));
document.getElementById('ambient-forest')?.addEventListener('click', () => playAmbient('forest'));
document.getElementById('ambient-fire')?.addEventListener('click', () => playAmbient('fire'));
document.getElementById('ambient-cafe')?.addEventListener('click', () => playAmbient('cafe'));
document.getElementById('ambient-white')?.addEventListener('click', () => playAmbient('white'));
document.getElementById('ambient-8d')?.addEventListener('click', () => playAmbient('8d'));
document.getElementById('ambient-phonk')?.addEventListener('click', () => playAmbient('phonk'));
document.getElementById('ambient-stop')?.addEventListener('click', stopAmbient);

document.getElementById('ambient-volume')?.addEventListener('input', (e) => {
    const volume = e.target.value / 100;
    document.getElementById('ambient-volume-display').textContent = e.target.value + '%';
    if (masterAmbientGain) {
        masterAmbientGain.gain.value = volume;
    }
    localStorage.setItem('ambientVolume', e.target.value);
});

const savedVolume = localStorage.getItem('ambientVolume') || 50;
const volumeInput = document.getElementById('ambient-volume');
if (volumeInput) volumeInput.value = savedVolume;
const volumeDisplay = document.getElementById('ambient-volume-display');
if (volumeDisplay) volumeDisplay.textContent = savedVolume + '%';

function createAudioContext() {
    if (!audioContext || audioContext.state === 'closed') {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

function stopAmbient() {
    try {
        if (panInterval) {
            clearInterval(panInterval);
            panInterval = null;
        }
        if (currentAudio) {
            currentAudio.stop();
            currentAudio = null;
        }
        activeAmbient = null;
    } catch (e) {
        console.error('Error stopping audio:', e);
    }
}

async function playAmbient(type) {
    try {
        createAudioContext();
        stopAmbient();
        activeAmbient = type;
        
        masterAmbientGain = audioContext.createGain();
        masterAmbientGain.gain.value = (localStorage.getItem('ambientVolume') || 50) / 100;
        masterAmbientGain.connect(audioContext.destination);
        
        if (type === 'rain') {
            await playRain();
        } else if (type === 'white') {
            await playWhiteNoise();
        } else if (type === '8d') {
            await play8DMusic();
        } else if (type === 'phonk') {
            await playPhonk();
        } else if (type === 'ocean') {
            await playOcean();
        } else if (type === 'forest') {
            await playForest();
        } else if (type === 'fire') {
            await playFire();
        } else if (type === 'cafe') {
            await playCafe();
        }
    } catch (e) {
        console.error('Error playing ambient:', e);
    }
}

async function playRain() {
    const bufferSize = audioContext.sampleRate * 4;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        const noise = (Math.random() * 2 - 1);
        const filtered = noise * 0.6 + (Math.random() > 0.998 ? (Math.random() - 0.5) : 0);
        data[i] = filtered;
    }
    
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    
    const highpass = audioContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 400;
    
    const lowpass = audioContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 8000;
    
    const gain = audioContext.createGain();
    gain.gain.value = 0.5;
    
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(masterAmbientGain || audioContext.destination);
    source.start();
    currentAudio = source;
    showNotification('Rain sounds playing', 'subtle');
}

async function playWhiteNoise() {
    const bufferSize = audioContext.sampleRate * 4;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    
    const gain = audioContext.createGain();
    gain.gain.value = 0.25;
    
    source.connect(gain);
    gain.connect(masterAmbientGain || audioContext.destination);
    source.start();
    currentAudio = source;
    showNotification('White noise playing', 'subtle');
}

async function play8DMusic() {
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25];
    const oscillators = [];
    const gains = [];
    
    const masterGain = audioContext.createGain();
    masterGain.gain.value = 0.15;
    
    const reverb = audioContext.createConvolver();
    
    const panner = audioContext.createStereoPanner();
    
    notes.forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.value = freq;
        
        const gain = audioContext.createGain();
        gain.gain.value = 0.3 - (i * 0.05);
        
        osc.connect(gain);
        gain.connect(panner);
        osc.start();
        oscillators.push(osc);
        gains.push(gain);
    });
    
    let angle = 0;
    panInterval = setInterval(() => {
        angle += 0.02;
        panner.pan.value = Math.sin(angle) * 0.9;
        masterGain.gain.value = 0.12 + Math.sin(angle * 2) * 0.03;
    }, 30);
    
    panner.connect(masterGain);
    masterGain.connect(masterAmbientGain || audioContext.destination);
    
    currentAudio = { 
        stop: () => {
            oscillators.forEach(osc => {
                try { osc.stop(); } catch(e) {}
            });
        }
    };
    showNotification('8D Music playing', 'subtle');
}

async function playPhonk() {
    const bass = audioContext.createOscillator();
    bass.type = 'sawtooth';
    bass.frequency.value = 55;
    
    const bass2 = audioContext.createOscillator();
    bass2.type = 'square';
    bass2.frequency.value = 55;
    
    const sub = audioContext.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 27.5;
    
    const bassGain = audioContext.createGain();
    bassGain.gain.value = 0.2;
    
    const bass2Gain = audioContext.createGain();
    bass2Gain.gain.value = 0.15;
    
    const subGain = audioContext.createGain();
    subGain.gain.value = 0.3;
    
    const distortion = audioContext.createWaveShaper();
    const curve = new Float32Array(512);
    for (let i = 0; i < 512; i++) {
        const x = (i / 256) - 1;
        curve[i] = Math.tanh(x * 3);
    }
    distortion.curve = curve;
    
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 150;
    filter.Q.value = 8;
    
    const panner = audioContext.createStereoPanner();
    
    const masterGain = audioContext.createGain();
    masterGain.gain.value = 0.4;
    
    let angle = 0;
    panInterval = setInterval(() => {
        angle += 0.03;
        panner.pan.value = Math.sin(angle) * 0.5;
        filter.frequency.value = 120 + Math.sin(angle * 4) * 30;
    }, 25);
    
    bass.connect(bassGain);
    bass2.connect(bass2Gain);
    sub.connect(subGain);
    
    bassGain.connect(distortion);
    bass2Gain.connect(distortion);
    distortion.connect(filter);
    filter.connect(panner);
    subGain.connect(panner);
    panner.connect(masterGain);
    masterGain.connect(masterAmbientGain || audioContext.destination);
    
    bass.start();
    bass2.start();
    sub.start();
    
    currentAudio = {
        stop: () => {
            try { bass.stop(); bass2.stop(); sub.stop(); } catch(e) {}
        }
    };
    showNotification('Phonk playing', 'subtle');
}

async function playOcean() {
    const bufferSize = audioContext.sampleRate * 4;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    let phase = 0;
    for (let i = 0; i < bufferSize; i++) {
        phase += 0.00001;
        const wave = Math.sin(phase * 2) * 0.5 + 0.5;
        data[i] = (Math.random() * 2 - 1) * wave * 0.4;
    }
    
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    
    const lowpass = audioContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 2000;
    
    const lfo = audioContext.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1;
    
    const lfoGain = audioContext.createGain();
    lfoGain.gain.value = 500;
    
    lfo.connect(lfoGain);
    lfoGain.connect(lowpass.frequency);
    
    const gain = audioContext.createGain();
    gain.gain.value = 0.4;
    
    source.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(masterAmbientGain || audioContext.destination);
    
    source.start();
    lfo.start();
    currentAudio = source;
    showNotification('Ocean sounds playing', 'subtle');
}

async function playForest() {
    const oscillators = [];
    
    const bufferSize = audioContext.sampleRate * 2;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.1;
    }
    
    const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;
    
    const bandpass = audioContext.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 3000;
    bandpass.Q.value = 0.5;
    
    const gain = audioContext.createGain();
    gain.gain.value = 0.15;
    
    noiseSource.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(masterAmbientGain || audioContext.destination);
    noiseSource.start();
    
    const birdFreqs = [2000, 2500, 3000, 3500];
    birdFreqs.forEach((freq, i) => {
        const bird = audioContext.createOscillator();
        bird.type = 'sine';
        bird.frequency.value = freq + Math.random() * 200;
        
        const birdGain = audioContext.createGain();
        birdGain.gain.value = 0;
        
        bird.connect(birdGain);
        birdGain.connect(audioContext.destination);
        bird.start();
        
        const chirpInterval = setInterval(() => {
            birdGain.gain.value = 0.05;
            setTimeout(() => { birdGain.gain.value = 0; }, 100);
            setTimeout(() => { birdGain.gain.value = 0.03; }, 200);
            setTimeout(() => { birdGain.gain.value = 0; }, 300);
        }, 2000 + i * 500);
        
        oscillators.push({ osc: bird, interval: chirpInterval });
    });
    
    currentAudio = {
        stop: () => {
            noiseSource.stop();
            oscillators.forEach(o => {
                try { o.osc.stop(); clearInterval(o.interval); } catch(e) {}
            });
        }
    };
    showNotification('Forest sounds playing', 'subtle');
}

async function playFire() {
    const bufferSize = audioContext.sampleRate * 3;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        const crackle = Math.random() > 0.997 ? (Math.random() - 0.5) : 0;
        data[i] = (Math.random() * 2 - 1) * 0.3 + crackle * 0.5;
    }
    
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    
    const highpass = audioContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 200;
    
    const lowpass = audioContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 5000;
    
    const gain = audioContext.createGain();
    gain.gain.value = 0.35;
    
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(masterAmbientGain || audioContext.destination);
    source.start();
    currentAudio = source;
    showNotification('Fire crackling', 'subtle');
}

async function playCafe() {
    const bufferSize = audioContext.sampleRate * 4;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.25;
    }
    
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    
    const bandpass = audioContext.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1000;
    bandpass.Q.value = 0.3;
    
    const gain = audioContext.createGain();
    gain.gain.value = 0.3;
    
    source.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(masterAmbientGain || audioContext.destination);
    source.start();
    currentAudio = source;
    showNotification('Cafe ambiance playing', 'subtle');
}

// Sound Mixing
let activeSounds = [];

async function toggleSoundMix(type) {
    if (activeSounds.includes(type)) {
        stopMixSound(type);
    } else {
        await playMixSound(type);
    }
    updateMixButtons();
}

async function playMixSound(type) {
    createAudioContext();
    activeSounds.push(type);
    
    if (type === 'rain') {
        await playRain();
    } else if (type === 'ocean') {
        await playOcean();
    } else if (type === 'forest') {
        await playForest();
    } else if (type === 'fire') {
        await playFire();
    } else if (type === 'cafe') {
        await playCafe();
    } else if (type === 'white') {
        await playWhiteNoise();
    }
}

function stopMixSound(type) {
    activeSounds = activeSounds.filter(s => s !== type);
}

// Sticky Notes
let stickyNotes = [];

function loadStickyNotes() {
    const saved = localStorage.getItem('stickyNotes');
    if (saved) {
        stickyNotes = JSON.parse(saved);
    }
    renderStickyNotes();
}

function saveStickyNote() {
    const input = document.getElementById('sticky-note-input');
    const content = input.value.trim();
    if (!content) return;
    
    const note = {
        id: Date.now(),
        content: content,
        createdAt: Date.now()
    };
    
    stickyNotes.unshift(note);
    localStorage.setItem('stickyNotes', JSON.stringify(stickyNotes));
    input.value = '';
    renderStickyNotes();
    showNotification('Note saved!', 'subtle');
}

function deleteStickyNote(id) {
    stickyNotes = stickyNotes.filter(n => n.id !== id);
    localStorage.setItem('stickyNotes', JSON.stringify(stickyNotes));
    renderStickyNotes();
}

function renderStickyNotes() {
    const container = document.getElementById('sticky-notes-list');
    if (!container) return;
    
    if (stickyNotes.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); font-size: 12px; text-align: center;">No notes yet</p>';
        return;
    }
    
    container.innerHTML = stickyNotes.slice(0, 5).map(note => {
        const date = new Date(note.createdAt);
        const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `
            <div class="sticky-note-item">
                <div class="sticky-note-content">${note.content}</div>
                <div class="sticky-note-time">${timeStr}</div>
                <button class="sticky-note-delete" onclick="deleteStickyNote(${note.id})">×</button>
            </div>
        `;
    }).join('');
}

document.getElementById('save-sticky-note')?.addEventListener('click', saveStickyNote);
document.getElementById('sticky-note-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        saveStickyNote();
    }
});

// Goals System
let goals = {
    dailyTasks: 5,
    dailyFocus: 60,
    dailyNotes: 3,
    weeklyTasks: 25,
    weeklyFocus: 600,
    weeklyStreak: 5
};

function loadGoals() {
    const saved = localStorage.getItem('userGoals');
    if (saved) {
        goals = JSON.parse(saved);
    }
    document.getElementById('goal-daily-tasks').value = goals.dailyTasks;
    document.getElementById('goal-daily-focus').value = goals.dailyFocus;
    document.getElementById('goal-daily-notes').value = goals.dailyNotes;
    document.getElementById('goal-weekly-tasks').value = goals.weeklyTasks;
    document.getElementById('goal-weekly-focus').value = goals.weeklyFocus;
    document.getElementById('goal-weekly-streak').value = goals.weeklyStreak;
    updateGoalsDisplay();
}

function saveGoals() {
    goals.dailyTasks = parseInt(document.getElementById('goal-daily-tasks').value) || 5;
    goals.dailyFocus = parseInt(document.getElementById('goal-daily-focus').value) || 60;
    goals.dailyNotes = parseInt(document.getElementById('goal-daily-notes').value) || 3;
    goals.weeklyTasks = parseInt(document.getElementById('goal-weekly-tasks').value) || 25;
    goals.weeklyFocus = parseInt(document.getElementById('goal-weekly-focus').value) || 600;
    goals.weeklyStreak = parseInt(document.getElementById('goal-weekly-streak').value) || 5;
    localStorage.setItem('userGoals', JSON.stringify(goals));
    updateGoalsDisplay();
    saveGoalsToFirestore();
    showNotification('Goals saved!', 'success');
}

async function saveGoalsToFirestore() {
    if (!currentUser) return;
    try {
        await setDoc(doc(db, 'users', currentUser.uid, 'data', 'profile'), {
            goals: goals,
            goalsSavedAt: Date.now()
        }, { merge: true });
    } catch (error) {
        console.error('Error saving goals to Firestore:', error);
    }
}

async function loadGoalsFromFirestore() {
    if (!currentUser) return;
    try {
        const userDataRef = doc(db, 'users', currentUser.uid, 'data', 'profile');
        const snapshot = await getDoc(userDataRef);
        if (snapshot.exists()) {
            const data = snapshot.data();
            if (data.goals) {
                goals = { ...goals, ...data.goals };
                localStorage.setItem('userGoals', JSON.stringify(goals));
                document.getElementById('goal-daily-tasks').value = goals.dailyTasks;
                document.getElementById('goal-daily-focus').value = goals.dailyFocus;
                document.getElementById('goal-daily-notes').value = goals.dailyNotes;
                document.getElementById('goal-weekly-tasks').value = goals.weeklyTasks;
                document.getElementById('goal-weekly-focus').value = goals.weeklyFocus;
                document.getElementById('goal-weekly-streak').value = goals.weeklyStreak;
                updateGoalsDisplay();
            }
        }
    } catch (error) {
        console.error('Error loading goals from Firestore:', error);
    }
}

function updateGoalsDisplay() {
    const today = new Date().toISOString().split('T')[0];
    const todayCompletedTasks = tasks.filter(t => t.completed && t.date === today).length;
    const todayFocusMins = focusSessions.filter(s => s.date === today).reduce((sum, s) => sum + s.duration, 0);
    const todayNotes = notes.filter(n => {
        const noteDate = new Date(n.createdAt).toISOString().split('T')[0];
        return noteDate === today;
    }).length;
    
    document.getElementById('goal-daily-tasks-progress').textContent = `${todayCompletedTasks}/${goals.dailyTasks}`;
    document.getElementById('goal-daily-tasks-fill').style.width = `${Math.min(todayCompletedTasks / goals.dailyTasks * 100, 100)}%`;
    
    document.getElementById('goal-daily-focus-progress').textContent = `${todayFocusMins}m/${goals.dailyFocus}m`;
    document.getElementById('goal-daily-focus-fill').style.width = `${Math.min(todayFocusMins / goals.dailyFocus * 100, 100)}%`;
    
    document.getElementById('goal-daily-notes-progress').textContent = `${todayNotes}/${goals.dailyNotes}`;
    document.getElementById('goal-daily-notes-fill').style.width = `${Math.min(todayNotes / goals.dailyNotes * 100, 100)}%`;
    
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekTasks = tasks.filter(t => t.completed && new Date(t.date) >= weekStart).length;
    const weekFocusMins = focusSessions.filter(s => new Date(s.date) >= weekStart).reduce((sum, s) => sum + s.duration, 0);
    
    document.getElementById('goal-weekly-tasks-progress').textContent = `${weekTasks}/${goals.weeklyTasks}`;
    document.getElementById('goal-weekly-tasks-fill').style.width = `${Math.min(weekTasks / goals.weeklyTasks * 100, 100)}%`;
    
    document.getElementById('goal-weekly-focus-progress').textContent = `${Math.floor(weekFocusMins/60)}h/${Math.floor(goals.weeklyFocus/60)}h`;
    document.getElementById('goal-weekly-focus-fill').style.width = `${Math.min(weekFocusMins / goals.weeklyFocus * 100, 100)}%`;
    
    document.getElementById('goal-weekly-streak-progress').textContent = `${streakData.count}/${goals.weeklyStreak}`;
    document.getElementById('goal-weekly-streak-fill').style.width = `${Math.min(streakData.count / goals.weeklyStreak * 100, 100)}%`;
    
    document.getElementById('summary-tasks').textContent = todayCompletedTasks;
    document.getElementById('summary-focus').textContent = todayFocusMins + 'm';
    document.getElementById('summary-notes').textContent = todayNotes;
    document.getElementById('summary-streak').textContent = streakData.count;
}

document.getElementById('save-goals-btn')?.addEventListener('click', saveGoals);

// Timer Presets
let timerPresets = [15, 25, 45, 60];

function loadTimerPresets() {
    const saved = localStorage.getItem('timerPresets');
    if (saved) {
        timerPresets = JSON.parse(saved);
    }
    document.getElementById('preset-1').value = timerPresets[0];
    document.getElementById('preset-2').value = timerPresets[1];
    document.getElementById('preset-3').value = timerPresets[2];
    document.getElementById('preset-4').value = timerPresets[3];
    updateTimerPresets();
}

function saveTimerPresets() {
    timerPresets[0] = parseInt(document.getElementById('preset-1').value) || 15;
    timerPresets[1] = parseInt(document.getElementById('preset-2').value) || 25;
    timerPresets[2] = parseInt(document.getElementById('preset-3').value) || 45;
    timerPresets[3] = parseInt(document.getElementById('preset-4').value) || 60;
    localStorage.setItem('timerPresets', JSON.stringify(timerPresets));
    updateTimerPresets();
    showNotification('Timer presets saved!', 'success');
}

function updateTimerPresets() {
    document.querySelectorAll('.timer-mode').forEach((btn, i) => {
        if (timerPresets[i]) {
            btn.dataset.minutes = timerPresets[i];
            btn.textContent = timerPresets[i] + ' min';
        }
    });
    document.querySelectorAll('.timer-mode-sm').forEach((btn, i) => {
        if (timerPresets[i]) {
            btn.dataset.min = timerPresets[i];
            btn.textContent = timerPresets[i] + 'm';
        }
    });
}

document.getElementById('save-presets-btn')?.addEventListener('click', saveTimerPresets);

// Themes
const themes = {
    light: { bg: '#ffffff', 'bg-secondary': '#f5f5f5', text: '#000000', 'text-secondary': '#666666', border: '#e0e0e0', accent: '#000000' },
    dark: { bg: '#0a0a0a', 'bg-secondary': '#1a1a1a', text: '#ffffff', 'text-secondary': '#888888', border: '#333333', accent: '#ffffff' },
    midnight: { bg: '#0a0a1a', 'bg-secondary': '#151530', text: '#e0e0ff', 'text-secondary': '#8080b0', border: '#2a2a4a', accent: '#4a90d9' },
    ocean: { bg: '#0a1520', 'bg-secondary': '#1a2530', text: '#e0f0ff', 'text-secondary': '#80a0c0', border: '#2a4050', accent: '#64b5f6' },
    forest: { bg: '#0a150a', 'bg-secondary': '#152515', text: '#e0ffe0', 'text-secondary': '#80c080', border: '#2a402a', accent: '#81c784' },
    sunset: { bg: '#150a0a', 'bg-secondary': '#251515', text: '#ffe0e0', 'text-secondary': '#c08080', border: '#402a2a', accent: '#ff8a65' }
};

function applyTheme(themeName) {
    const theme = themes[themeName];
    if (!theme) return;
    
    Object.keys(theme).forEach(key => {
        document.documentElement.style.setProperty(`--${key}`, theme[key]);
    });
    localStorage.setItem('appTheme', themeName);
    
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === themeName);
    });
}

document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
});

const savedTheme = localStorage.getItem('appTheme') || 'light';
applyTheme(savedTheme);

// Export/Import Data
document.getElementById('export-data-btn')?.addEventListener('click', async () => {
    const data = {
        tasks: tasks,
        notes: notes,
        shortcuts: shortcuts,
        subjects: subjects,
        focusSessions: focusSessions,
        goals: goals,
        timerPresets: timerPresets,
        streakData: streakData,
        userXP: userXP,
        userLevel: userLevel,
        unlockedAchievements: unlockedAchievements,
        exportedAt: Date.now()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study-dashboard-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Data exported successfully!', 'success');
});

document.getElementById('import-data-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (confirm('This will replace all your current data. Continue?')) {
            if (data.goals) {
                goals = data.goals;
                localStorage.setItem('userGoals', JSON.stringify(goals));
            }
            if (data.timerPresets) {
                timerPresets = data.timerPresets;
                localStorage.setItem('timerPresets', JSON.stringify(timerPresets));
            }
            
            showNotification('Data imported! Refresh to see changes.', 'success');
        }
    } catch (error) {
        console.error('Import error:', error);
        showNotification('Error importing data', 'warning');
    }
});

// Profile System
let userProfile = {
    name: '',
    age: '',
    grade: '',
    school: '',
    bio: '',
    goals: ''
};

function loadProfile() {
    const saved = localStorage.getItem('userProfile');
    if (saved) {
        userProfile = JSON.parse(saved);
    }
    
    document.getElementById('profile-name').value = userProfile.name || '';
    document.getElementById('profile-age').value = userProfile.age || '';
    document.getElementById('profile-grade').value = userProfile.grade || '';
    document.getElementById('profile-school').value = userProfile.school || '';
    document.getElementById('profile-bio').value = userProfile.bio || '';
    document.getElementById('profile-goals').value = userProfile.goals || '';
    
    updateProfileAvatar();
    updateProfileStats();
}

function updateProfileStats() {
    const levelEl = document.getElementById('profile-level');
    const xpEl = document.getElementById('profile-xp');
    const streakEl = document.getElementById('profile-streak');
    const avatarEl = document.getElementById('profile-avatar-lg');
    
    if (levelEl) levelEl.textContent = 'Level ' + userLevel;
    if (xpEl) xpEl.textContent = userXP;
    if (streakEl) streakEl.textContent = streakData.count;
    if (avatarEl) avatarEl.textContent = userProfile.name ? userProfile.name.charAt(0).toUpperCase() : '👤';
}

function saveProfile() {
    userProfile.name = document.getElementById('profile-name').value.trim();
    userProfile.age = document.getElementById('profile-age').value;
    userProfile.grade = document.getElementById('profile-grade').value.trim();
    userProfile.school = document.getElementById('profile-school').value.trim();
    userProfile.bio = document.getElementById('profile-bio').value.trim();
    userProfile.goals = document.getElementById('profile-goals').value.trim();
    
    localStorage.setItem('userProfile', JSON.stringify(userProfile));
    updateProfileAvatar();
    updateProfileStats();
    
    if (currentUser) {
        saveProfileToFirestore();
    }
    
    showNotification('Profile saved!', 'success');
}

async function saveProfileToFirestore() {
    if (!currentUser) return;
    try {
        await setDoc(doc(db, 'users', currentUser.uid, 'data', 'profile'), {
            ...userProfile,
            profileSavedAt: Date.now()
        }, { merge: true });
    } catch (error) {
        console.error('Error saving profile to Firestore:', error);
    }
}

async function loadProfileFromFirestore() {
    if (!currentUser) return;
    try {
        const userDataRef = doc(db, 'users', currentUser.uid, 'data', 'profile');
        const snapshot = await getDoc(userDataRef);
        if (snapshot.exists()) {
            const data = snapshot.data();
            if (data.name) userProfile.name = data.name;
            if (data.age) userProfile.age = data.age;
            if (data.grade) userProfile.grade = data.grade;
            if (data.school) userProfile.school = data.school;
            if (data.bio) userProfile.bio = data.bio;
            if (data.goals) userProfile.goals = data.goals;
            
            localStorage.setItem('userProfile', JSON.stringify(userProfile));
            loadProfile();
        }
    } catch (error) {
        console.error('Error loading profile from Firestore:', error);
    }
}

function updateProfileAvatar() {
    const avatar = document.getElementById('profile-avatar');
    if (avatar) {
        avatar.textContent = userProfile.name ? userProfile.name.charAt(0).toUpperCase() : '👤';
    }
    
    const userNameEl = document.getElementById('user-name');
    if (userNameEl && userProfile.name) {
        userNameEl.textContent = userProfile.name;
    }
}

document.getElementById('save-profile-btn')?.addEventListener('click', saveProfile);

// PWA Install
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    deferredPrompt = e;
    const installBtn = document.getElementById('install-pwa-btn');
    if (installBtn) {
        installBtn.style.display = 'block';
    }
});

document.getElementById('install-pwa-btn')?.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            showNotification('App installed!', 'success');
        }
        deferredPrompt = null;
    }
});

// Analytics
function formatTime(totalMins) {
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hours > 0) {
        return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
}

function renderAnalytics() {
    const totalMins = focusSessions.reduce((sum, s) => sum + s.duration, 0);
    
    const totalEl = document.getElementById('total-study-time');
    if (totalEl) totalEl.textContent = formatTime(totalMins);
    
    const bestStreakEl = document.getElementById('best-streak');
    if (bestStreakEl) bestStreakEl.textContent = streakData.bestStreak || 0;
    
    const xpEl = document.getElementById('total-xp');
    if (xpEl) xpEl.textContent = userXP;
    
    const tasksEl = document.getElementById('tasks-completed');
    if (tasksEl) tasksEl.textContent = tasks.filter(t => t.completed).length;
    
    // Study graph
    const studyGraph = document.getElementById('study-graph');
    if (studyGraph) {
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            last7Days.push(date.toISOString().split('T')[0]);
        }
        
        const maxMins = Math.max(...last7Days.map(d => 
            focusSessions.filter(s => s.date === d).reduce((sum, s) => sum + s.duration, 0)
        ), 1);
        
        studyGraph.innerHTML = last7Days.map(date => {
            const dayMins = focusSessions.filter(s => s.date === date).reduce((sum, s) => sum + s.duration, 0);
            const height = (dayMins / maxMins) * 120;
            const dayLabel = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
            return `<div class="graph-bar" style="height: ${Math.max(height, 4)}px" title="${dayLabel}: ${formatTime(dayMins)}"></div>`;
        }).join('');
    }
    
    // Subject chart
    const subjectChart = document.getElementById('subject-chart');
    if (subjectChart) {
        const stats = {};
        tasks.filter(t => t.completed && t.subject).forEach(t => {
            stats[t.subject] = (stats[t.subject] || 0) + 1;
        });
        
        const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);
        const maxCount = Math.max(...sorted.map(s => s[1]), 1);
        
        subjectChart.innerHTML = sorted.length ? sorted.map(([name, count]) => `
            <div class="subject-bar">
                <span class="subject-bar-label">${name}</span>
                <div class="subject-bar-fill" style="width: ${(count / maxCount) * 100}%; background: var(--accent)"></div>
                <span class="subject-bar-value">${count}</span>
            </div>
        `).join('') : '<p style="color: var(--text-secondary)">No data yet</p>';
    }
    
    // Session history
    const sessionHistory = document.getElementById('session-history');
    if (sessionHistory) {
        const recent = focusSessions.slice(-10).reverse();
        sessionHistory.innerHTML = recent.length ? recent.map(s => `
            <div class="session-item">
                <span>${s.task}</span>
                <span>${formatTime(s.duration)} • ${s.date}</span>
            </div>
        `).join('') : '<p style="color: var(--text-secondary)">No sessions yet</p>';
    }
}

// Achievements
function renderAchievements() {
    const container = document.getElementById('achievements-grid');
    if (!container) return;
    
    const completedTasks = tasks.filter(t => t.completed).length;
    const totalStudyMins = focusSessions.reduce((sum, s) => sum + s.duration, 0);
    
    container.innerHTML = achievements.map(a => {
        const unlocked = unlockedAchievements.includes(a.id) || isAchievementUnlocked(a.id, completedTasks, totalStudyMins);
        return `
            <div class="achievement-card ${unlocked ? 'unlocked' : 'locked'}">
                <div class="achievement-icon">${a.icon}</div>
                <div class="achievement-name">${a.name}</div>
                <div class="achievement-desc">${a.desc}</div>
                ${unlocked ? '<div class="achievement-unlocked">Unlocked!</div>' : ''}
            </div>
        `;
    }).join('');
}

function isAchievementUnlocked(id, completedTasks, totalStudyMins) {
    switch (id) {
        case 'first_task': return completedTasks >= 1;
        case 'streak_3': return streakData.count >= 3;
        case 'streak_7': return streakData.count >= 7;
        case 'tasks_10': return completedTasks >= 10;
        case 'tasks_50': return completedTasks >= 50;
        case 'study_1h': return totalStudyMins >= 60;
        case 'notes_10': return notes.length >= 10;
        case 'level_5': return userLevel >= 5;
        default: return false;
    }
}

function checkAchievements() {
    const completedTasks = tasks.filter(t => t.completed).length;
    const totalStudyMins = focusSessions.reduce((sum, s) => sum + s.duration, 0);
    
    achievements.forEach(a => {
        if (!unlockedAchievements.includes(a.id) && isAchievementUnlocked(a.id, completedTasks, totalStudyMins)) {
            unlockedAchievements.push(a.id);
            showNotification(`Achievement Unlocked: ${a.name}! +${a.xp} XP`, 'success');
            userXP += a.xp;
            userLevel = calculateLevel(userXP);
            updateXPDisplay();
            updateUserProfile();
        }
    });
    
    renderAchievements();
}

// Affirmation
function loadAffirmation() {
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    const affirmationEl = document.getElementById('affirmation-text');
    if (affirmationEl) {
        affirmationEl.textContent = affirmations[dayOfYear % affirmations.length];
    }
}

// Task Deadline Notifications
let notifiedTasks = new Set();

function checkTaskDeadlines() {
    if (!currentUser || !('Notification' in window) || Notification.permission !== 'granted') return;
    
    const now = new Date();
    const oneHourFromNow = now.getTime() + (60 * 60 * 1000);
    
    tasks.forEach(task => {
        if (task.completed || task.notified) return;
        
        const taskDateTime = new Date(`${task.date}T${task.time}`);
        const taskTime = taskDateTime.getTime();
        
        if (taskTime > now.getTime() && taskTime <= oneHourFromNow) {
            const timeUntil = Math.round((taskTime - now.getTime()) / 60000);
            showNotification(`"${task.title}" is due in ${timeUntil} minute${timeUntil !== 1 ? 's' : ''}!`, 'warning');
            
            notifiedTasks.add(task.id);
            updateDoc(doc(db, 'users', currentUser.uid, 'tasks', task.id), {
                notified: true
            }).catch(console.error);
        }
    });
}

setInterval(checkTaskDeadlines, 60000);

// Notifications
document.getElementById('enable-notifications')?.addEventListener('click', async () => {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            showNotification('Notifications enabled!');
            checkTaskDeadlines();
        } else {
            showNotification('Notifications were denied');
        }
    } else {
        showNotification('Notifications not supported in this browser');
    }
});

function showNotification(message, type = 'info') {
    const toast = document.getElementById('notification-toast');
    if (toast) {
        toast.textContent = message;
        toast.classList.remove('hidden', 'warning', 'success', 'subtle');
        if (type === 'warning') toast.classList.add('warning');
        if (type === 'success') toast.classList.add('success');
        if (type === 'subtle') toast.classList.add('subtle');
        toast.style.opacity = '1';
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, 2000);
    }
    
    if (type !== 'subtle' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Study Dashboard', { body: message });
    }
}

// Make functions global
window.toggleTask = toggleTask;
window.deleteTask = deleteTask;
window.focusTask = focusTask;
window.editTask = editTask;
window.closeTaskModal = closeTaskModal;
window.togglePinNote = togglePinNote;
window.deleteNote = deleteNote;
window.editNote = editNote;
window.closeNoteModal = closeNoteModal;
window.addTopic = addTopic;
window.removeTopic = removeTopic;
window.deleteShortcut = deleteShortcut;
window.openShortcut = openShortcut;
window.deleteSubject = deleteSubject;

console.log('Script initialized');