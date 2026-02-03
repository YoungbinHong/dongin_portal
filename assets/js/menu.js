document.addEventListener('DOMContentLoaded', () => {
    loadSavedTheme();
});

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

function confirmLogout() {
    closeModal();
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
    }
};

document.querySelectorAll('.program-card.card-secure, .program-card.card-pdf').forEach(card => {
    card.addEventListener('click', function(e) {
        e.preventDefault();
        const href = this.getAttribute('href');
        const transition = document.getElementById('pageTransition');
        const loaderBar = document.getElementById('loaderBar');
        const transitionIcon = document.getElementById('transitionIcon');
        const transitionTitle = document.getElementById('transitionTitle');

        const cardType = this.classList.contains('card-pdf') ? 'card-pdf' : 'card-secure';
        const config = transitionConfigs[cardType];

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
