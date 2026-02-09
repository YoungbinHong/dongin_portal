const API_BASE = 'http://localhost:8000';

(function() {
    const params = new URLSearchParams(window.location.search);
    var fromLogout = params.get('from') === 'logout' || localStorage.getItem('fromLogout') === '1';
    if (fromLogout) {
        localStorage.removeItem('fromLogout');
        document.querySelector('.wave-wrapper').classList.add('from-logout');
        document.querySelector('.login-wrapper').classList.add('from-logout');
        history.replaceState(null, '', 'login.html');
    }
})();

async function checkLogin() {
    const username = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.querySelector('button');
    const errorBox = document.getElementById('errorBox');

    if (!username || !password) {
        errorBox.classList.remove('show');
        void errorBox.offsetWidth;
        errorBox.classList.add('show');
        return;
    }

    btn.classList.add('loading');

    try {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });

        if (!res.ok) {
            throw new Error('로그인 실패');
        }

        const data = await res.json();
        localStorage.setItem('access_token', data.access_token);

        const userRes = await fetch(`${API_BASE}/api/users/me`, {
            headers: { 'Authorization': `Bearer ${data.access_token}` }
        });
        const user = await userRes.json();

        const targetPage = user.role === 'admin' ? 'management.html' : 'menu.html';

        btn.classList.remove('loading');
        btn.classList.add('success-btn');

        setTimeout(() => {
            document.querySelector('.wave-wrapper').classList.add('success');
            document.querySelector('.login-wrapper').classList.add('success');

            setTimeout(() => {
                window.location.href = targetPage;
            }, 1000);
        }, 1000);

    } catch (e) {
        btn.classList.remove('loading');
        errorBox.classList.remove('show');
        void errorBox.offsetWidth;
        errorBox.classList.add('show');
    }
}

document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', () => {
        document.getElementById('errorBox').classList.remove('show');
    });
});

document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const btn = document.querySelector('.login-form button');
        if (btn && btn.disabled) return;
        checkLogin();
    }
});
