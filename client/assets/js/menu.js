const API_BASE = 'http://192.168.0.254:8000';

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

let _themeInitialized = false;

document.addEventListener('DOMContentLoaded', () => {
    loadSavedTheme();
    _themeInitialized = true;
    logEvent('메뉴 화면 진입');
});

const _originalApplyTheme = applyTheme;
applyTheme = function(theme) {
    _originalApplyTheme(theme);
    if (_themeInitialized) {
        logEvent(`테마 변경: ${theme === 'dark' ? '어두운 테마' : '밝은 테마'}`);
    }
};

function openSettings() {
    document.querySelectorAll('.alert-modal, .settings-modal').forEach(el => el.style.display = 'none');
    document.getElementById('settingsContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = localStorage.getItem('donginTheme') || 'light';
}

function logout() {
    document.querySelectorAll('.alert-modal, .settings-modal').forEach(el => el.style.display = 'none');
    document.getElementById('logoutContent').style.display = 'block';
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
        window.location.href = 'login.html?from=logout';
    }, 600);
}

const transitionConfigs = {
    'card-secure': {
        icon: '<svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>',
        title: 'DONGIN SECURE',
        gradient: 'linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%)'
    },
    'card-pdf': {
        icon: '<svg viewBox="0 0 24 24"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>',
        title: 'DONGIN PDF EDITOR',
        gradient: 'linear-gradient(135deg, #ff7675 0%, #d63031 100%)'
    },
    'card-ai': {
        icon: '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>',
        title: 'DONGIN AI AGENT',
        gradient: 'linear-gradient(135deg, #00b894 0%, #00a085 100%)'
    },
    'card-remote': {
        icon: '<svg viewBox="0 0 24 24"><path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/></svg>',
        title: 'DONGIN REMOTE CONTROL',
        gradient: 'linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)'
    },
    'card-mail': {
        icon: '<svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>',
        title: 'DONGIN MAIL SCREENER',
        gradient: 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)'
    },
    'card-community': {
        icon: '<svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>',
        title: 'DONGIN COMMUNITY',
        gradient: 'linear-gradient(135deg, #fd79a8 0%, #e84393 100%)'
    }
};

let lastDragDistance = 0;

document.querySelectorAll('.program-card.card-secure, .program-card.card-pdf, .program-card.card-ai, .program-card.card-remote, .program-card.card-mail, .program-card.card-community').forEach(card => {
    card.addEventListener('click', function(e) {
        e.preventDefault();
        if (lastDragDistance > 5) return;
        if (this.dataset.isCenter !== 'true') return;
        const href = this.getAttribute('href');
        const transition = document.getElementById('pageTransition');
        const loaderBar = document.getElementById('loaderBar');
        const transitionIcon = document.getElementById('transitionIcon');
        const transitionTitle = document.getElementById('transitionTitle');

        const cardType = this.classList.contains('card-pdf') ? 'card-pdf' :
                        this.classList.contains('card-ai') ? 'card-ai' :
                        this.classList.contains('card-remote') ? 'card-remote' :
                        this.classList.contains('card-mail') ? 'card-mail' :
                        this.classList.contains('card-community') ? 'card-community' : 'card-secure';
        const config = transitionConfigs[cardType];

        logEvent(`프로그램 선택: ${config.title}`);

        transitionIcon.innerHTML = config.icon;
        transitionTitle.textContent = config.title;
        transition.style.background = config.gradient;

        transition.classList.add('active');

        setTimeout(() => {
            loaderBar.classList.add('loading');
        }, 50);

        setTimeout(() => {
            window.location.href = href;
        }, 1600);
    });
});

const cardContainer = document.querySelector('.card-container');
const originalCards = Array.from(document.querySelectorAll('.program-card'));
const cardWidth = 280;
const cardGap = 24;
const cardTotal = cardWidth + cardGap;
const cardCount = originalCards.length;

let currentOffset = -cardTotal * 2;
let scrollVelocity = 0;
let isAnimating = false;
let isDragging = false;
let startX = 0;
let dragStartOffset = 0;
let lastDragX = 0;
let dragVelocity = 0;

function getContainerWidth() {
    return cardContainer.getBoundingClientRect().width;
}

function updateCarousel() {
    const containerWidth = getContainerWidth();
    const centerX = containerWidth / 2;
    const visibleHalf = cardTotal * 2;

    originalCards.forEach((card, index) => {
        let offsetIndex = index - Math.floor(cardCount / 2);
        let basePos = centerX + offsetIndex * cardTotal - cardWidth / 2;
        let pos = basePos - currentOffset;

        const totalWidth = cardCount * cardTotal;
        while (pos < centerX - visibleHalf - cardWidth) pos += totalWidth;
        while (pos > centerX + visibleHalf) pos -= totalWidth;

        card.style.left = pos + 'px';

        const cardCenter = pos + cardWidth / 2;
        const distance = Math.abs(centerX - cardCenter);
        const isCenter = distance < cardTotal * 1.5;
        const isVisible = distance < cardTotal * 1.5 + cardWidth * 0.7;

        card.dataset.isCenter = isCenter;

        if (!isVisible) {
            card.style.visibility = 'hidden';
        } else if (isCenter) {
            card.style.visibility = 'visible';
            card.style.transform = 'scale(1)';
            card.style.opacity = '1';
            card.style.filter = 'blur(0px)';
            card.style.pointerEvents = 'auto';
            card.style.cursor = 'pointer';
        } else {
            card.style.visibility = 'visible';
            card.style.transform = 'scale(0.85)';
            card.style.opacity = '0.5';
            card.style.filter = 'blur(3px)';
            card.style.pointerEvents = 'none';
            card.style.cursor = 'default';
        }
    });
}

function snapToCard() {
    if (!isSnapping) return;

    const snapIndex = Math.round(currentOffset / cardTotal);
    const targetOffset = snapIndex * cardTotal;
    const diff = targetOffset - currentOffset;

    if (Math.abs(diff) < 0.5) {
        currentOffset = targetOffset;
        updateCarousel();
        isSnapping = false;
        return;
    }

    currentOffset += diff * 0.15;
    updateCarousel();
    requestAnimationFrame(snapToCard);
}

function animateScroll() {
    if (Math.abs(scrollVelocity) < 0.5) {
        isAnimating = false;
        scrollVelocity = 0;
        isSnapping = true;
        snapToCard();
        return;
    }

    currentOffset += scrollVelocity;
    scrollVelocity *= 0.92;
    updateCarousel();

    requestAnimationFrame(animateScroll);
}

let wheelTimeout = null;
let wheelAccum = 0;
let isSnapping = false;

function handleWheel(e) {
    e.preventDefault();
    e.stopPropagation();

    const delta = e.deltaY || e.deltaX;
    wheelAccum += delta;

    if (wheelTimeout) clearTimeout(wheelTimeout);

    wheelTimeout = setTimeout(() => {
        const direction = wheelAccum > 0 ? 1 : -1;
        wheelAccum = 0;
        isSnapping = false;
        scrollVelocity = direction * 25;
        isAnimating = true;
        requestAnimationFrame(animateScroll);
    }, 50);
}

cardContainer.addEventListener('wheel', handleWheel, { passive: false });

let dragDistance = 0;

cardContainer.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragDistance = 0;
    startX = e.pageX;
    dragStartOffset = currentOffset;
    lastDragX = e.pageX;
    dragVelocity = 0;
    scrollVelocity = 0;
    isAnimating = false;
    isSnapping = false;
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const x = e.pageX;
    dragDistance += Math.abs(x - lastDragX);

    if (dragDistance > 5) {
        cardContainer.classList.add('dragging');
        e.preventDefault();
    }

    const walk = startX - x;
    currentOffset = dragStartOffset + walk;

    dragVelocity = (lastDragX - x) * 0.3;
    lastDragX = x;

    updateCarousel();
});

document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    lastDragDistance = dragDistance;
    const wasDragging = dragDistance > 5;
    isDragging = false;
    cardContainer.classList.remove('dragging');

    if (wasDragging) {
        if (Math.abs(dragVelocity) > 1) {
            scrollVelocity = dragVelocity;
            isAnimating = true;
            requestAnimationFrame(animateScroll);
        } else {
            isSnapping = true;
            snapToCard();
        }
    }
});

originalCards.forEach(card => {
    card.style.position = 'absolute';
    card.style.top = '20px';
    card.setAttribute('draggable', 'false');

    card.addEventListener('dragstart', (e) => e.preventDefault());

    card.addEventListener('mouseenter', () => {
        if (!isDragging && card.dataset.isCenter === 'true') {
            card.style.transform = 'scale(1) translateY(-8px)';
        }
    });

    card.addEventListener('mouseleave', () => {
        if (!isDragging && card.dataset.isCenter === 'true') {
            card.style.transform = 'scale(1)';
        }
    });
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        isSnapping = false;
        scrollVelocity = -25;
        isAnimating = true;
        requestAnimationFrame(animateScroll);
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        isSnapping = false;
        scrollVelocity = 25;
        isAnimating = true;
        requestAnimationFrame(animateScroll);
    }
});

updateCarousel();
window.addEventListener('resize', updateCarousel);
