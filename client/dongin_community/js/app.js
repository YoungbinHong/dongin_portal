const API_BASE = 'http://192.168.0.254:8000';

let posts = [];
let currentFilter = 'all';
let currentView = 'list';
let currentPost = null;

function getToken() {
    return localStorage.getItem('access_token');
}

function authHeaders() {
    const token = getToken();
    const h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
}

async function logEvent(action) {
    const token = getToken();
    if (!token) return;
    try {
        await fetch(`${API_BASE}/api/event`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ action })
        });
    } catch {}
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('donginTheme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    localStorage.setItem('donginTheme', theme);
    logEvent(`테마 변경: ${theme === 'dark' ? '어두운 테마' : '밝은 테마'}`);
}

document.addEventListener('DOMContentLoaded', async () => {
    loadSavedTheme();
    setTimeout(() => {
        document.querySelector('.sidebar').classList.add('show');
        document.querySelector('.main-container').classList.add('show');
    }, 100);
    await fetchPosts();
    logEvent('커뮤니티 진입');
});

async function fetchPosts() {
    try {
        const res = await fetch(`${API_BASE}/api/posts`, { headers: authHeaders() });
        if (res.ok) {
            posts = await res.json();
        }
    } catch {}
    renderPostList();
}

function filterCategory(category) {
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.closest('.menu-item').classList.add('active');

    if (category === 'popular') {
        currentFilter = 'popular';
    } else if (category === 'notice') {
        currentFilter = 'notice';
    } else if (category === 'my') {
        currentFilter = 'my';
    } else {
        currentFilter = 'all';
    }

    showView('list');
    renderPostList();
}

function setCategoryFilter(category) {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    currentFilter = category;
    renderPostList();
}

function renderPostList() {
    const searchInput = document.getElementById('searchInput').value.toLowerCase();
    let filteredPosts = posts;

    if (currentFilter === 'popular') {
        filteredPosts = posts.filter(p => p.likes > 10);
    } else if (currentFilter === 'notice') {
        filteredPosts = posts.filter(p => p.category === 'notice');
    } else if (currentFilter === 'my') {
        const username = localStorage.getItem('username') || 'user';
        filteredPosts = posts.filter(p => p.author === username);
    } else if (currentFilter !== 'all') {
        filteredPosts = posts.filter(p => p.category === currentFilter);
    }

    if (searchInput) {
        filteredPosts = filteredPosts.filter(p =>
            p.title.toLowerCase().includes(searchInput) ||
            p.content.toLowerCase().includes(searchInput)
        );
    }

    const postList = document.getElementById('postList');
    postList.innerHTML = filteredPosts.map(post => `
        <div class="post-item" onclick="viewPost(${post.id})">
            <div class="post-category cat-${post.category}">${getCategoryName(post.category)}</div>
            <div class="post-content">
                <div class="post-title">${post.title}</div>
                <div class="post-meta">
                    <span>${post.author}</span>
                    <span>${post.date}</span>
                </div>
            </div>
            <div class="post-stats">
                <span>👁️ ${post.views}</span>
                <span>❤️ ${post.likes}</span>
                <span>💬 ${post.comments.length}</span>
            </div>
        </div>
    `).join('');
}

function getCategoryName(category) {
    const names = {
        general: '일반',
        question: '질문',
        suggestion: '건의',
        notice: '공지'
    };
    return names[category] || category;
}

async function viewPost(id) {
    try {
        const res = await fetch(`${API_BASE}/api/posts/${id}`, { headers: authHeaders() });
        if (!res.ok) return;
        currentPost = await res.json();
    } catch { return; }

    const idx = posts.findIndex(p => p.id === id);
    if (idx !== -1) posts[idx] = currentPost;

    showView('detail');
    renderPostDetail();
    logEvent(`게시글 조회: ${currentPost.title}`);
}

function renderPostDetail() {
    if (!currentPost) return;

    const postDetail = document.getElementById('postDetail');
    const isLiked = localStorage.getItem(`post_${currentPost.id}_liked`) === 'true';

    postDetail.innerHTML = `
        <div class="detail-header">
            <div class="post-category cat-${currentPost.category}">${getCategoryName(currentPost.category)}</div>
            <div class="detail-title">${currentPost.title}</div>
            <div class="detail-meta">
                <span>${currentPost.author}</span>
                <span>${currentPost.date}</span>
                <span>조회 ${currentPost.views}</span>
            </div>
        </div>
        <div class="detail-body">${currentPost.content}</div>
        <div class="detail-actions">
            <button class="action-btn back-btn" onclick="showView('list')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                </svg>
                목록
            </button>
            <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike(${currentPost.id})">
                ❤️ 좋아요 ${currentPost.likes}
            </button>
        </div>
        <div class="comments-section">
            <div class="comments-title">댓글 ${currentPost.comments.length}</div>
            ${currentPost.comments.map(comment => `
                <div class="comment-item">
                    <div class="comment-author">${comment.author}</div>
                    <div class="comment-text">${comment.text}</div>
                    <div class="comment-date">${comment.date}</div>
                </div>
            `).join('')}
            <div class="comment-form">
                <textarea class="comment-input" id="commentInput" placeholder="댓글을 입력하세요" rows="2"></textarea>
                <button class="submit-comment-btn" onclick="submitComment(${currentPost.id})">등록</button>
            </div>
        </div>
    `;
}

async function toggleLike(postId) {
    const isLiked = localStorage.getItem(`post_${postId}_liked`) === 'true';
    if (isLiked) {
        localStorage.removeItem(`post_${postId}_liked`);
        currentPost.likes = Math.max(0, currentPost.likes - 1);
    } else {
        try {
            const res = await fetch(`${API_BASE}/api/posts/${postId}/like`, {
                method: 'POST',
                headers: authHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                currentPost.likes = data.likes;
            }
        } catch {}
        localStorage.setItem(`post_${postId}_liked`, 'true');
    }
    renderPostDetail();
    logEvent(`게시글 좋아요: ${currentPost.title}`);
}

async function submitComment(postId) {
    const input = document.getElementById('commentInput');
    const text = input.value.trim();

    if (!text) {
        alert('댓글 내용을 입력하세요');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/posts/${postId}/comments`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ text })
        });
        if (res.ok) {
            const comment = await res.json();
            currentPost.comments.push(comment);
        }
    } catch {}

    input.value = '';
    renderPostDetail();
    logEvent(`댓글 작성: ${currentPost.title}`);
}

function showView(viewName) {
    currentView = viewName;

    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    if (viewName === 'list') {
        document.getElementById('listView').classList.add('active');
        renderPostList();
    } else if (viewName === 'detail') {
        document.getElementById('detailView').classList.add('active');
    } else if (viewName === 'write') {
        document.getElementById('writeView').classList.add('active');
        document.getElementById('postTitle').value = '';
        document.getElementById('postCategory').value = 'general';
        document.getElementById('postContent').value = '';
    }
}

async function submitPost() {
    const title = document.getElementById('postTitle').value.trim();
    const category = document.getElementById('postCategory').value;
    const content = document.getElementById('postContent').value.trim();

    if (!title || !content) {
        alert('제목과 내용을 입력하세요');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/posts`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ title, category, content })
        });
        if (res.ok) {
            const newPost = await res.json();
            posts.unshift(newPost);
        }
    } catch {}

    showView('list');
    logEvent(`게시글 작성: ${title}`);
}

function openSettings() {
    document.querySelectorAll('.alert-modal, .settings-modal').forEach(el => el.style.display = 'none');
    document.getElementById('settingsContent').style.display = 'flex';
    document.getElementById('modalOverlay').style.display = 'flex';
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = localStorage.getItem('donginTheme') || 'light';
}

function logout() {
    document.querySelectorAll('.alert-modal, .settings-modal').forEach(el => el.style.display = 'none');
    document.getElementById('logoutContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

function showHomeConfirm() {
    document.querySelectorAll('.alert-modal, .settings-modal').forEach(el => el.style.display = 'none');
    document.getElementById('homeContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.querySelectorAll('.alert-modal, .settings-modal').forEach(el => el.style.display = 'none');
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('modalOverlay');
        if (modal && modal.style.display === 'flex') {
            closeModal();
        }
    }
});

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
        window.location.href = '../login.html?from=logout';
    }, 600);
}

function confirmGoToMenu() {
    closeModal();
    const overlay = document.getElementById('logoutOverlay');
    overlay.classList.add('active');
    setTimeout(() => {
        window.location.href = '../menu.html';
    }, 600);
}

function switchTab(event, tabName) {
    document.querySelectorAll('.settings-menu-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.classList.add('active');

    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
}
