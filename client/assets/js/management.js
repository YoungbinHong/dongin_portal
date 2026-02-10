const API_BASE = 'http://192.168.0.254:8000';
let accounts = [];
let pendingUsers = [];
let deletingId = null;

document.addEventListener('DOMContentLoaded', () => {
    loadSavedTheme();
    checkAuth();
});

function getToken() {
    return localStorage.getItem('access_token');
}

async function checkAuth() {
    const token = getToken();
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/api/users/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error();
        const user = await res.json();
        if (user.role !== 'admin') {
            alert('관리자 권한이 필요합니다.');
            window.location.href = 'index.html';
            return;
        }
        loadAccounts();
        loadPendingUsers();
    } catch {
        localStorage.removeItem('access_token');
        window.location.href = 'login.html';
    }
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('donginTheme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }
}

async function loadAccounts() {
    const token = getToken();
    try {
        const res = await fetch(`${API_BASE}/api/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error();
        accounts = await res.json();
        renderAccounts();
    } catch {
    }
}

async function loadPendingUsers() {
    const token = getToken();
    try {
        const res = await fetch(`${API_BASE}/api/admin/users/pending`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error();
        pendingUsers = await res.json();
        renderPendingUsers();
    } catch {
    }
}

function renderPendingUsers() {
    const pendingList = document.getElementById('pendingList');
    const pendingCount = document.getElementById('pendingCount');

    pendingCount.textContent = pendingUsers.length;

    if (pendingUsers.length === 0) {
        pendingList.innerHTML = createEmptyState();
        return;
    }

    pendingList.innerHTML = pendingUsers.map(user => `
        <div class="account-item pending">
            <div class="account-avatar">
                <svg viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
            </div>
            <div class="account-info">
                <div class="account-name">${user.name} <span class="status-badge pending-badge">대기중</span></div>
                <div class="account-email">${user.username}</div>
            </div>
            <div class="account-actions">
                <button class="action-btn approve-btn" onclick="approveUser(${user.id})" title="승인">
                    <svg viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                </button>
                <button class="action-btn reject-btn" onclick="rejectUser(${user.id})" title="거절">
                    <svg viewBox="0 0 24 24">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

async function approveUser(userId) {
    const token = getToken();
    try {
        const res = await fetch(`${API_BASE}/api/admin/users/${userId}/approve`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || '승인 실패');
        }
        await loadPendingUsers();
        await loadAccounts();
    } catch (e) {
        alert(e.message);
    }
}

async function rejectUser(userId) {
    const token = getToken();
    try {
        const res = await fetch(`${API_BASE}/api/admin/users/${userId}/reject`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || '거절 실패');
        }
        await loadPendingUsers();
        await loadAccounts();
    } catch (e) {
        alert(e.message);
    }
}

function renderAccounts() {
    const adminList = document.getElementById('adminList');
    const userList = document.getElementById('userList');
    const adminCount = document.getElementById('adminCount');
    const userCount = document.getElementById('userCount');

    const admins = accounts.filter(a => a.role === 'admin');
    const users = accounts.filter(a => a.role === 'user');

    adminCount.textContent = admins.length;
    userCount.textContent = users.length;

    adminList.innerHTML = admins.length ? admins.map(a => createAccountItem(a)).join('') : createEmptyState();
    userList.innerHTML = users.length ? users.map(a => createAccountItem(a)).join('') : createEmptyState();
}

function createAccountItem(account) {
    const statusClass = account.is_active ? '' : 'inactive';
    const statusBadge = account.is_active ? '' : '<span class="status-badge">비활성</span>';
    return `
        <div class="account-item ${statusClass}">
            <div class="account-avatar">
                <svg viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
            </div>
            <div class="account-info">
                <div class="account-name">${account.name} ${statusBadge}</div>
                <div class="account-email">${account.username} · ${account.position}</div>
            </div>
            <div class="account-actions">
                <button class="action-btn edit-btn" onclick="openEditModal(${account.id})" title="수정">
                    <svg viewBox="0 0 24 24">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                </button>
                <button class="action-btn delete-btn" onclick="openDeleteModal(${account.id})" title="삭제">
                    <svg viewBox="0 0 24 24">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

function createEmptyState() {
    return `
        <div class="empty-state">
            <svg viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            <p>등록된 계정이 없습니다</p>
        </div>
    `;
}

function openAddModal() {
    document.getElementById('formTitle').textContent = '계정 추가';
    document.getElementById('editingId').value = '';
    document.getElementById('accountUsername').value = '';
    document.getElementById('accountPassword').value = '';
    document.getElementById('accountPassword').placeholder = '비밀번호 입력 (8자 이상)';
    document.getElementById('accountName').value = '';
    document.getElementById('accountPosition').value = '';
    document.getElementById('accountType').value = 'user';
    showModal('addAccountContent');
}

function openEditModal(id) {
    const account = accounts.find(a => a.id === id);
    if (!account) return;

    document.getElementById('formTitle').textContent = '계정 수정';
    document.getElementById('editingId').value = id;
    document.getElementById('accountUsername').value = account.username;
    document.getElementById('accountPassword').value = '';
    document.getElementById('accountPassword').placeholder = '변경시에만 입력';
    document.getElementById('accountName').value = account.name;
    document.getElementById('accountPosition').value = account.position;
    document.getElementById('accountType').value = account.role;
    showModal('addAccountContent');
}

async function saveAccount() {
    const id = document.getElementById('editingId').value;
    const username = document.getElementById('accountUsername').value.trim();
    const password = document.getElementById('accountPassword').value.trim();
    const name = document.getElementById('accountName').value.trim();
    const position = document.getElementById('accountPosition').value.trim();
    const role = document.getElementById('accountType').value;

    if (!username || !name || !position) {
        alert('모든 필드를 입력해주세요.');
        return;
    }

    if (!id && (!password || password.length < 8)) {
        alert('비밀번호는 8자 이상이어야 합니다.');
        return;
    }

    if (username.length < 3) {
        alert('사용자명은 3자 이상이어야 합니다.');
        return;
    }

    const token = getToken();
    try {
        if (id) {
            const updateData = { name, position, role };
            const res = await fetch(`${API_BASE}/api/users/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updateData)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || '수정 실패');
            }
            if (password && password.length >= 8) {
                await fetch(`${API_BASE}/api/users/${id}/password?new_password=${encodeURIComponent(password)}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            }
        } else {
            const res = await fetch(`${API_BASE}/api/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username, password, name, position, role })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || '생성 실패');
            }
        }
        await loadAccounts();
        closeModal();
    } catch (e) {
        alert(e.message);
    }
}

function openDeleteModal(id) {
    deletingId = id;
    const account = accounts.find(a => a.id === id);
    if (account) {
        document.getElementById('deleteMsg').textContent = `"${account.name}" 계정을 삭제하시겠습니까?`;
    }
    showModal('deleteContent');
}

async function confirmDelete() {
    if (!deletingId) return;
    const token = getToken();
    try {
        const res = await fetch(`${API_BASE}/api/users/${deletingId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || '삭제 실패');
        }
        await loadAccounts();
        deletingId = null;
        closeModal();
    } catch (e) {
        alert(e.message);
    }
}

function showModal(contentId) {
    const modal = document.getElementById('modalOverlay');
    document.querySelectorAll('.alert-modal, .form-modal').forEach(el => el.style.display = 'none');
    modal.style.display = 'flex';
    document.getElementById(contentId).style.display = 'block';
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
}

function logout() {
    showModal('logoutContent');
}

async function confirmLogout() {
    closeModal();
    const token = getToken();
    if (token) {
        try {
            await fetch(`${API_BASE}/api/auth/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch {}
    }
    localStorage.removeItem('access_token');
    const overlay = document.getElementById('logoutOverlay');
    overlay.classList.add('active');
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 800);
}
