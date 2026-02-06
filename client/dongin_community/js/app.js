const API_BASE = 'http://localhost:8000';

let posts = [
    {
        id: 1,
        category: 'notice',
        title: 'DONGIN COMMUNITY 오픈 안내',
        author: 'admin',
        date: '2024-01-15',
        content: 'DONGIN COMMUNITY에 오신 것을 환영합니다.\n\n자유롭게 의견을 나누고 소통하는 공간입니다.\n서로 존중하며 건설적인 대화를 나누어주세요.',
        views: 245,
        likes: 18,
        comments: [
            { author: 'user1', text: '오픈 축하드립니다!', date: '2024-01-15' },
            { author: 'user2', text: '기대됩니다', date: '2024-01-15' }
        ]
    },
    {
        id: 2,
        category: 'question',
        title: 'PDF Editor 사용법 문의',
        author: 'user1',
        date: '2024-01-16',
        content: 'PDF 파일을 병합하려고 하는데 순서를 바꿀 수 있나요?',
        views: 89,
        likes: 5,
        comments: [
            { author: 'user3', text: '드래그 앤 드롭으로 순서 변경 가능합니다', date: '2024-01-16' }
        ]
    },
    {
        id: 3,
        category: 'suggestion',
        title: '다크 모드 색상 개선 건의',
        author: 'user2',
        date: '2024-01-17',
        content: '다크 모드 사용 시 일부 텍스트가 잘 안 보여요.\n좀 더 명도를 높여주시면 좋을 것 같습니다.',
        views: 156,
        likes: 12,
        comments: []
    },
    {
        id: 4,
        category: 'general',
        title: 'AI Agent 정말 편리하네요',
        author: 'user3',
        date: '2024-01-18',
        content: '업무용으로 사용 중인데 정말 유용합니다.\n특히 문서 작성 기능이 마음에 들어요.',
        views: 203,
        likes: 24,
        comments: [
            { author: 'user1', text: '저도 잘 쓰고 있습니다!', date: '2024-01-18' }
        ]
    },
    {
        id: 5,
        category: 'general',
        title: '새로운 기능 추가 예정인가요?',
        author: 'user4',
        date: '2024-01-19',
        content: '앞으로 어떤 기능들이 추가될 예정인지 궁금합니다.',
        views: 178,
        likes: 8,
        comments: []
    }
];

let currentFilter = 'all';
let currentView = 'list';
let currentPost = null;

function getToken() {
    return localStorage.getItem('access_token');
}

async function logEvent(action) {
    const token = getToken();
    if (!token) return;
    try {
        await fetch(`${API_BASE}/api/event`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
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

document.addEventListener('DOMContentLoaded', () => {
    loadSavedTheme();
    setTimeout(() => {
        document.body.classList.add('show');
    }, 100);
    renderPostList();
    logEvent('커뮤니티 진입');
});

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
        filteredPosts = posts.filter(p => p.author === 'user1');
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

function viewPost(id) {
    currentPost = posts.find(p => p.id === id);
    if (!currentPost) return;

    currentPost.views++;
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

function toggleLike(postId) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const isLiked = localStorage.getItem(`post_${postId}_liked`) === 'true';

    if (isLiked) {
        post.likes--;
        localStorage.removeItem(`post_${postId}_liked`);
    } else {
        post.likes++;
        localStorage.setItem(`post_${postId}_liked`, 'true');
    }

    renderPostDetail();
    logEvent(`게시글 좋아요: ${post.title}`);
}

function submitComment(postId) {
    const input = document.getElementById('commentInput');
    const text = input.value.trim();

    if (!text) {
        alert('댓글 내용을 입력하세요');
        return;
    }

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    post.comments.push({
        author: 'user1',
        text: text,
        date: new Date().toISOString().split('T')[0]
    });

    input.value = '';
    renderPostDetail();
    logEvent(`댓글 작성: ${post.title}`);
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

function submitPost() {
    const title = document.getElementById('postTitle').value.trim();
    const category = document.getElementById('postCategory').value;
    const content = document.getElementById('postContent').value.trim();

    if (!title || !content) {
        alert('제목과 내용을 입력하세요');
        return;
    }

    const newPost = {
        id: posts.length + 1,
        category: category,
        title: title,
        author: 'user1',
        date: new Date().toISOString().split('T')[0],
        content: content,
        views: 0,
        likes: 0,
        comments: []
    };

    posts.unshift(newPost);
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
