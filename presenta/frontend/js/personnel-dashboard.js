// --- 1. SECURITY CHECK & SETUP ---
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

if (!token || !user || user.role !== 'personnel') {
    window.location.href = 'login.html';
}

// Helper function for API calls
async function apiFetch(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {})
    };

    const res = await fetch(endpoint, { ...options, headers });

    if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        throw new Error('Session expired');
    }

    return res;
}

// --- 2. THE FIX: Stop rogue key listeners from dashboard.js ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Stop forms from reloading
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', (e) => e.preventDefault());
    });

    // 2. Prevent the page from logging out on keypress (Overrides dashboard.js)
    window.addEventListener('keydown', (e) => {
        // If the user is typing in an input field, let them type
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return; 
        }
        // Otherwise, stop the event from bubbling up to dashboard.js
        e.stopPropagation();
    }, true); // The 'true' here is crucial; it catches the event before dashboard.js does

    // 3. Set the user's name
    const nameEl = document.getElementById('userName');
    if (nameEl) nameEl.textContent = user.name;
    
    // 4. Load data
    loadDashboardData();
});

async function loadDashboardData() {
    try {
        const notifRes = await apiFetch('/api/notifications');
        const notifData = await notifRes.json();
        
        const unreadCount = notifData.unread || 0;
        const badge = document.getElementById('notifBadge');
        if (badge) {
            badge.textContent = unreadCount;
            badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
        }

        const meRes = await apiFetch('/api/me');
        const meData = await meRes.json();
        console.log("Logged in as:", meData.user.name);

    } catch (err) {
        console.error("Dashboard error:", err);
    }
}

// --- 3. LOGOUT BUTTON ---
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    });
}