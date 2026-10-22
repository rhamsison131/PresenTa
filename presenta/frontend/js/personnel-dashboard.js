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

// --- 2. ACCOUNT VERIFICATIONS UI (Matches your backend) ---
const AccountsUI = {
    async view(el) {
        el.innerHTML = '<div class="loading">Loading accounts...</div>';
        try {
            // Fetch both students and orgs using your exact backend routes
            const students = await api('/api/verify/students');
            const orgs = await api('/api/verify/orgs');

            // Filter for pending items
            const pendingStudents = students.filter(s => s.status === 'pending' || s.status === 'active'); 
            const pendingOrgs = orgs.filter(o => o.status === 'pending');

            const studentRows = pendingStudents.map(u => `
                <tr>
                    <td><b>${esc(u.name)}</b><small>${esc(u.email)}</small></td>
                    <td>${esc(u.student_id || '—')}<small>${esc(u.course || '')}</small></td>
                    <td>${esc(u.department || '—')}<small>Year ${esc(u.year || '—')}</small></td>
                    <td>${chip(u.status === 'pending' ? 'warn' : 'ok', u.status)}</td>
                    <td>
                        <div class="btns">
                            <button class="btn sm" onclick="AccountsUI.verifyStudent('${esc(u.id)}', 'approve')">Approve</button>
                            <button class="btn sm ghost" onclick="AccountsUI.verifyStudent('${esc(u.id)}', 'hold')">Hold</button>
                            <button class="btn sm danger" onclick="AccountsUI.verifyStudent('${esc(u.id)}', 'reject')">Reject</button>
                        </div>
                    </td>
                </tr>
            `).join('');

            const orgRows = pendingOrgs.map(o => `
                <tr>
                    <td><b>${esc(o.name)}</b><small>${esc(o.department || 'University-wide')}</small></td>
                    <td>${o.officers.length} Officer(s)<small>${o.officers.map(x => x.name).join(', ')}</small></td>
                    <td>${chip(o.status === 'accredited' ? 'ok' : 'warn', o.status)}</td>
                    <td>
                        <div class="btns">
                            <button class="btn sm" onclick="AccountsUI.verifyOrg('${esc(o.id)}', 'accredit')">Accredit</button>
                            <button class="btn sm danger" onclick="AccountsUI.verifyOrg('${esc(o.id)}', 'not_accredited')">Reject</button>
                        </div>
                    </td>
                </tr>
            `).join('');

            el.innerHTML = `
                <div class="card">
                    <div class="toolbar"><h3 style="margin:0">Student Accounts</h3></div>
                    ${pendingStudents.length ? tableHtml(['Student', 'ID / Course', 'Department', 'Status', 'Actions'], [studentRows]) : '<div class="empty">No students to verify.</div>'}
                </div>
                <div class="card">
                    <div class="toolbar"><h3 style="margin:0">Organization Accreditation</h3></div>
                    ${pendingOrgs.length ? tableHtml(['Organization', 'Officers', 'Status', 'Actions'], [orgRows]) : '<div class="empty">No organizations to verify.</div>'}
                </div>
            `;

        } catch (err) {
            el.innerHTML = `<div class="card"><div class="empty">Error: ${esc(err.message)}</div></div>`;
        }
    },

    async verifyStudent(id, decision) {
        const titles = { approve: 'Approve Student', hold: 'Put on Hold', reject: 'Reject Student' };
        const note = await decisionBox({ 
            title: titles[decision], 
            label: 'Message to student', 
            required: decision !== 'approve',
            danger: decision === 'reject',
            okLabel: titles[decision]
        });
        if (note === null) return;
        
        const r = await run(null, () => api('/api/verify/students/' + id, { 
            method: 'POST', 
            body: { decision, note } 
        }), 'Student updated');
        
        if (r) refresh();
    },

    async verifyOrg(id, decision) {
        const titles = { accredit: 'Accredit Organization', not_accredited: 'Reject Organization' };
        const note = await decisionBox({ 
            title: titles[decision], 
            label: 'Message to organization', 
            required: decision !== 'accredit',
            danger: decision === 'not_accredited',
            okLabel: titles[decision]
        });
        if (note === null) return;
        
        const r = await run(null, () => api('/api/verify/orgs/' + id, { 
            method: 'POST', 
            body: { decision, note } 
        }), 'Organization updated');
        
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
                el.innerHTML = tilesHtml([
                    ['Pending Approvals', '—'],
                    ['System Status', 'Online']
                ]) + `<div class="card"><h3>Welcome, ${esc(Session.user.name)}</h3><p>Use the sidebar to verify student accounts, accredit organizations, and approve events.</p></div>`;
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
            { id: 'accounts', label: 'Account Approvals', icon: 'users' },
            { id: 'approvals', label: 'Event Approvals', icon: 'check' },
            { id: 'reports', label: 'Reports', icon: 'file' },
            { id: 'fees', label: 'Fees & Payments', icon: 'card' },
            { id: 'notifications', label: 'Notifications', icon: 'bell' },
            { id: 'profile', label: 'My Profile', icon: 'user' }
        ]
    });
});