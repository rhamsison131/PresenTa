// --- 1. SECURITY CHECK & SETUP ---
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

// If there is no token, or they aren't personnel, kick them out immediately
if (!token || !user || user.role !== 'personnel') {
    window.location.href = 'login.html';
}

// Helper function: Every time we call the API, we must include the token!
async function apiFetch(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`, // <--- THIS IS CRUCIAL
        ...(options.headers || {})
    };

    const res = await fetch(endpoint, { ...options, headers });

    // If the backend says the token is invalid (401) or account is blocked (403)
    if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        throw new Error('Session expired');
    }

    return res;
}

// --- 2. UI SETUP ---
document.addEventListener('DOMContentLoaded', () => {
    // Set the user's name on the screen
    const nameEl = document.getElementById('userName');
    if (nameEl) nameEl.textContent = user.name;
    
    // Load the data
    loadDashboardData();
});

async function loadDashboardData() {
    try {
        // Fetch notifications using our secure helper
        const notifRes = await apiFetch('/api/notifications');
        const notifData = await notifRes.json();
        
        // Example: Show unread notifications
        const unreadCount = notifData.unread || 0;
        const badge = document.getElementById('notifBadge');
        if (badge) {
            badge.textContent = unreadCount;
            badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
        }

        // Fetch profile data to make sure it's valid
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