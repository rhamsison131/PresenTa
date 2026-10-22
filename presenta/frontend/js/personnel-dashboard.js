// --- 1. SAFETY NET (Overwrite the aggressive logout in dashboard.js) ---
// Prevent dashboard.js from instantly logging out on a 401 during load
const originalApi = window.api;
window.api = async function(path, opt) {
    try {
        return await originalApi(path, opt);
    } catch (e) {
        // If it's a temporary network error, don't log out immediately
        if (e.message === 'Cannot reach the server') {
            console.warn("Network hiccup, ignoring logout for now.");
            throw e;
        }
        throw e;
    }
};

// --- 2. CONFIGURE PERSONNEL DASHBOARD ---
document.addEventListener('DOMContentLoaded', () => {
    // Ensure token exists
    if (!Session.token || !Session.user) {
        location.href = 'login.html';
        return;
    }

    // Define the Personnel specific views
    const personnelViews = {
        overview: {
            title: 'Overview',
            nav: 'overview',
            async render(el) {
                // Fetch dashboard stats
                let data = { pending: 0, events: 0 };
                try {
                    const events = await api('/api/approvals');
                    data.pending = events.filter(e => e.status === 'pending').length;
                    data.events = events.length;
                } catch (e) {}

                el.innerHTML = tilesHtml([
                    ['Pending Approvals', data.pending],
                    ['Total Events', data.events],
                    ['Accreditation Sweeps', 'Active']
                ]) + `<div class="card"><h3>Welcome, ${esc(Session.user.name)}</h3><p>Use the sidebar to manage event approvals, verify student accounts, and monitor reports.</p></div>`;
            }
        },
        approvals: {
            title: 'Event Approvals',
            nav: 'approvals',
            render: ApprovalsUI.view
        },
        reports: {
            title: 'Attendance Reports',
            nav: 'reports',
            render: ReportsUI.view
        },
        fees: {
            title: 'Fees & Payments',
            nav: 'fees',
            render: FeesUI.view
        },
        notifications: {
            title: 'Notifications',
            nav: 'notifications',
            render: notificationsView
        },
        profile: {
            title: 'My Profile',
            nav: 'profile',
            render: profileView
        }
    };

    // Mount the shell using dashboard.js's function
    mountShell({
        role: 'personnel',
        home: 'overview',
        views: personnelViews,
        nav: [
            { id: 'overview', label: 'Overview', icon: 'grid' },
            { id: 'approvals', label: 'Event Approvals', icon: 'check' },
            { id: 'reports', label: 'Reports', icon: 'file' },
            { id: 'fees', label: 'Fees & Payments', icon: 'card' },
            { id: 'notifications', label: 'Notifications', icon: 'bell' },
            { id: 'profile', label: 'My Profile', icon: 'user' }
        ]
    });
});