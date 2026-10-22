// --- 2. ACCOUNT VERIFICATIONS UI ---
const AccountsUI = {
    orgDeptFilter: '', 

    async view(el) {
        el.innerHTML = '<div class="loading">Loading accounts...</div>';
        try {
            const students = await api('/api/verify/students');
            const orgs = await api('/api/verify/orgs');

            // Keep ALL students who are not rejected
            const displayStudents = students.filter(s => s.status !== 'rejected'); 
            
            // Show orgs that are pending or not accredited
            const displayOrgs = orgs.filter(o => o.status !== 'accredited');

            const studentRows = displayStudents.map(u => {
                const dateApproved = u.approved_at ? fmtD(u.approved_at) : (u.status === 'active' ? fmtD(u.created_at) : '—');
                
                // Dynamic Buttons
                const actions = u.status === 'active' 
                    ? `<button class="btn sm ghost" onclick="AccountsUI.verifyStudent('${esc(u.id)}', 'hold')">Hold</button>
                       <button class="btn sm danger" onclick="AccountsUI.verifyStudent('${esc(u.id)}', 'reject')">Reject</button>`
                    : `<button class="btn sm" onclick="AccountsUI.verifyStudent('${esc(u.id)}', 'approve')">Approve</button>
                       <button class="btn sm ghost" onclick="AccountsUI.verifyStudent('${esc(u.id)}', 'hold')">Hold</button>
                       <button class="btn sm danger" onclick="AccountsUI.verifyStudent('${esc(u.id)}', 'reject')">Reject</button>`;

                return `
                <tr>
                    <td><b>${esc(u.name)}</b><small>${esc(u.email)}</small></td>
                    <td>${esc(u.student_id || '—')}<small>${esc(u.course || '')}</small></td>
                    <td>${esc(u.department || '—')}<small>Year ${esc(u.year || '—')}</small></td>
                    <td>${chip(u.status === 'pending' ? 'warn' : u.status === 'active' ? 'ok' : 'absent', u.status)}</td>
                    <td>${dateApproved}</td>
                    <td>
                        <div class="btns">
                            ${actions}
                        </div>
                    </td>
                </tr>
            `}).join('');

            // --- ORGANIZATION LOGIC ---
            const approvedOrgs = orgs.filter(o => o.status === 'accredited');
            const filteredApprovedOrgs = AccountsUI.orgDeptFilter 
                ? approvedOrgs.filter(o => (o.department || 'University-wide') === AccountsUI.orgDeptFilter)
                : approvedOrgs;
            const approvedDepts = Array.from(new Set(approvedOrgs.map(o => o.department || 'University-wide'))).sort();

            const pendingOrgRows = displayOrgs.map(o => `
                <tr>
                    <td><b>${esc(o.name)}</b><small>${esc(o.department || 'University-wide')}</small></td>
                    <td>${o.officers.length} Officer(s)<small>${o.officers.map(x => x.name).join(', ')}</small></td>
                    <td>${chip(o.status === 'pending' ? 'warn' : 'absent', o.status)}</td>
                    <td>
                        <div class="btns">
                            <button class="btn sm" onclick="AccountsUI.verifyOrg('${esc(o.id)}', 'accredit')">Accredit</button>
                            <button class="btn sm danger" onclick="AccountsUI.verifyOrg('${esc(o.id)}', 'not_accredited')">Reject</button>
                        </div>
                    </td>
                </tr>
            `).join('');

            const approvedOrgRows = filteredApprovedOrgs.map(o => {
                const dateApproved = o.accredited_at ? fmtD(o.accredited_at) : (o.accredited_until ? fmtD(new Date(new Date(o.accredited_until).setFullYear(new Date(o.accredited_until).getFullYear() - 1))) : fmtD(o.created_at));
                return `
                <tr>
                    <td><b>${esc(o.name)}</b></td>
                    <td>${esc(o.department || 'University-wide')}</td>
                    <td>${esc(dateApproved)}</td>
                    <td>${o.officers.length} Officer(s)</td>
                    <td><span class="chip ok">Accredited</span></td>
                </tr>
            `}).join('');

            el.innerHTML = `
                <div class="card">
                    <div class="toolbar"><h3 style="margin:0">Student Accounts</h3></div>
                    ${displayStudents.length ? tableHtml(['Student', 'ID / Course', 'Department', 'Status', 'Date Approved', 'Actions'], [studentRows]) : '<div class="empty">No students to verify.</div>'}
                </div>

                <div class="card">
                    <div class="toolbar"><h3 style="margin:0">Pending Organizations</h3></div>
                    ${displayOrgs.length ? tableHtml(['Organization', 'Officers', 'Status', 'Actions'], [pendingOrgRows]) : '<div class="empty">No pending organizations.</div>'}
                </div>

                <div class="card">
                    <div class="toolbar">
                        <h3 style="margin:0">Approved Organizations</h3>
                        <select class="pill" id="deptFilter">
                            <option value="">All Departments</option>
                            ${approvedDepts.map(d => `<option value="${esc(d)}" ${d === AccountsUI.orgDeptFilter ? 'selected' : ''}>${esc(d)}</option>`).join('')}
                        </select>
                    </div>
                    ${filteredApprovedOrgs.length ? tableHtml(['Organization', 'Department', 'Date Approved', 'Officers', 'Status'], [approvedOrgRows]) : '<div class="empty">No approved organizations match this filter.</div>'}
                </div>
            `;

            const filterDropdown = $('#deptFilter', el);
            if (filterDropdown) {
                filterDropdown.onchange = (e) => {
                    AccountsUI.orgDeptFilter = e.target.value;
                    AccountsUI.view(el);
                };
            }

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
                const [students, orgs, approvals] = await Promise.all([
                    api('/api/verify/students').catch(() => []),
                    api('/api/verify/orgs').catch(() => []),
                    api('/api/approvals').catch(() => [])
                ]);
                el.innerHTML = tilesHtml([
                    ['Pending Students', students.filter(s => s.status === 'pending').length],
                    ['Pending Organizations', orgs.filter(o => o.status === 'pending').length],
                    ['Pending Events', approvals.filter(e => e.status === 'pending').length]
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