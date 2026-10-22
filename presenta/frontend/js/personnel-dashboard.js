// --- 1. IMMEDIATE SECURITY & TOKEN PATCH ---
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

if (!token || !user || user.role !== 'personnel') {
    window.location.href = 'login.html';
}

// 🚨 GLOBAL FETCH INTERCEPTOR 🚨
// This forces EVERY fetch call in the app (even from dashboard.js) to include the token!
const originalFetch = window.fetch;
window.fetch = async (...args) => {
    let [resource, config] = args;
    
    // Only intercept API calls
    if (typeof resource === 'string' && resource.startsWith('/api/')) {
        config = config || {};
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await originalFetch(resource, config);
    
    // If we get a 401 Session Expired, handle it cleanly
    if (response.status === 401 && !window.location.href.includes('login.html')) {
        console.error("Global interceptor caught 401. Logging out.");
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        return response;
    }
    
    return response;
};
// ------------------------------------------

// --- 2. UI SETUP ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Stop forms from reloading
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', (e) => e.preventDefault());
    });

    // 2. Set the user's name
    const nameEl = document.getElementById('userName');
    if (nameEl) nameEl.textContent = user.name;
    
    // 3. Load data
    loadDashboardData();
});

async function loadDashboardData() {
    try {
        // Fetch notifications
        const notifRes = await fetch('/api/notifications');
        if (notifRes.ok) {
            const notifData = await notifRes.json();
            const unreadCount = notifData.unread || 0;
            const badge = document.getElementById('notifBadge');
            if (badge) {
                badge.textContent = unreadCount;
                badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
            }
        }

        // Fetch profile data
        const meRes = await fetch('/api/me');
        if (meRes.ok) {
            const meData = await meRes.json();
            console.log("Logged in as:", meData.user.name);
        }

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