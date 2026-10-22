// --- 1. SAFETY NET ---
const originalApi = window.api;
window.api = async function(path, opt) {
    try {
        return await originalApi(path, opt);
    } catch (e) {
        if (e.message === 'Cannot reach the server') throw e;
        throw e;
    }
};

// --- 2. NEW VIEW FOR ACCOUNTS/ORGS APPROVAL ---
const AccountsUI = {
    async view(el) {
        el.innerHTML = '<div class="loading">Loading pending accounts...</div>';
        try {
            // We are assuming your backend has this endpoint. 
            // If it's named differently, change this URL.
            const users = await api('/api/admin/pending'); 
            
            if (!users || users.length === 0) {
                el.innerHTML = `<div class="card"><div class="empty">No pending accounts to verify.</div></div>`;
                return;
            }

            const rows = users.map(u => `
                <tr>
                    <td><b>${esc(u.name)}</b><small>${esc(u.email)}</small></td>
                    <td>${chip('warn', u.role === 'organization' ? 'Organization' : 'Student')}</td>
                    <td>${esc(u.department || '—')}<small>${esc(u.course || u.position || '')}</small></td>
                    <td>${esc(fmtD(u.created_at))}</td>
                    <td>
                        <div class="btns">
                            <button class="btn sm" onclick="AccountsUI.approve('${esc(u.id)}')">Approve</button>
                            <button class="btn sm danger" onclick="AccountsUI.reject('${esc(u.id)}')">Reject</button>
                        </div>
                    </td>
                </tr>
            `);

            el.innerHTML = `<div class="card">
                <div class="toolbar"><h3 style="margin:0">Pending Account Verifications</h3></div>
                ${tableHtml(['Name / Email', 'Type', 'Details', 'Registered', 'Actions'], rows)}
            </div>`;

        } catch (err) {
            el.innerHTML = `<div class="card"><div class="empty">Error: ${esc(err.message)}</div></div>`;
        }
    },

    async approve(id) {
        const note = await decisionBox({ 
            title: 'Approve Account', 
            intro: 'This will activate the account and send them an email.', 
            label: 'Message to user (optional)', 
            okLabel: 'Approve' 
        });
        if (note === null) return;
        
        const r = await run(null, () => api('/api/admin/verify', { 
            method: 'POST', 
            body: { userId: id, action: 'approve', note } 
        }), 'Account approved');
        
        if (r) refresh();
    },

    async reject(id) {
        const note = await decisionBox({ 
            title: 'Reject Account', 
            intro: 'Please provide a reason. They will not be able to log in.', 
            label: 'Reason for rejection', 
            required: true, 
            danger: true, 
            okLabel: 'Reject' 
        });
        if (note === null) return;
        
        const r = await run(null, () => api('/api/admin/verify', { 
            method: 'POST', 
            body: { userId: id, action: 'reject', note } 
        }), 'Account rejected');
        
        if (r) refresh();
    }
};

// --- 3. CONFIGURE DASHBOARD ---
document.addEventListener('DOMContentLoaded', () => {
    if (!Session.token || !Session.user) {
        location.href = 'login.html';
        return;
    }

    const personnelViews = {
        overview: {
            title: 'Overview',
            nav: 'overview',
            async render(el) {
                let data = { pendingEvents: 0, pendingUsers: 0 };
                try {
                    const events = await api('/api/approvals');
                    data.pendingEvents = events.filter(e => e.status === 'pending').length;
                    const users = await api('/api/admin/pending');
                    data.pendingUsers = users.length;
                } catch (e) {}

                el.innerHTML = tilesHtml([
                    ['Pending Events', data.pendingEvents],
                    ['Pending Accounts', data.pendingUsers],
                    ['System Status', 'Online']
                ]) + `<div class="card"><h3>Welcome, ${esc(Session.user.name)}</h3><p>You have access to verify student accounts, approve organizations, and monitor events.</p></div>`;
            }
        },
        accounts: {
            title: 'Account Approvals',
            nav: 'accounts',
            render: AccountsUI.view
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

    mountShell({
        role: 'personnel',
        home: 'overview',
        views: personnelViews,
        nav: [
            { id: 'overview', label: 'Overview', icon: 'grid' },
            { id: 'accounts', label: 'Account Approvals', icon: 'users' }, // NEW TAB
            { id: 'approvals', label: 'Event Approvals', icon: 'check' },
            { id: 'reports', label: 'Reports', icon: 'file' },
            { id: 'fees', label: 'Fees & Payments', icon: 'card' },
            { id: 'notifications', label: 'Notifications', icon: 'bell' },
            { id: 'profile', label: 'My Profile', icon: 'user' }
        ]
    });
});