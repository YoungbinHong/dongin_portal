const API_BASE = 'http://192.168.0.254:8000';

document.addEventListener('DOMContentLoaded', () => {
    loadSavedTheme();
});

function openSettings() {
    document.getElementById('settingsContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = localStorage.getItem('donginTheme') || 'light';
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.getElementById('settingsContent').style.display = 'none';
    document.getElementById('signupContent').style.display = 'none';
    resetSignupForm();
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('modalOverlay');
        if (modal && modal.style.display === 'flex') closeModal();
    }
});

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
    const btn = document.querySelector('.login-form button');
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

document.querySelectorAll('.login-form input').forEach(input => {
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

let otpVerified = false;
let currentEmail = '';
let lastOtpSendTime = 0;

function openSignup(e) {
    e.preventDefault();
    document.getElementById('settingsContent').style.display = 'none';
    document.getElementById('signupContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

function resetSignupForm() {
    document.getElementById('signupEmail').value = '';
    document.getElementById('otpCode').value = '';
    document.getElementById('signupPassword').value = '';
    document.getElementById('signupName').value = '';
    document.getElementById('emailError').textContent = '';
    document.getElementById('otpError').textContent = '';
    document.getElementById('otpSuccess').textContent = '';
    document.getElementById('passwordError').textContent = '';
    document.getElementById('nameError').textContent = '';
    document.getElementById('otpGroup').style.display = 'none';
    document.getElementById('verifyBtn').disabled = false;
    otpVerified = false;
    currentEmail = '';
    lastOtpSendTime = 0;
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

async function sendOTP() {
    const email = document.getElementById('signupEmail').value.trim();
    const emailError = document.getElementById('emailError');
    const verifyBtn = document.getElementById('verifyBtn');

    if (!email) {
        emailError.textContent = '이메일을 입력해주세요.';
        return;
    }

    if (!validateEmail(email)) {
        emailError.textContent = '올바른 이메일 형식이 아닙니다.';
        return;
    }

    const now = Date.now();
    const timeSinceLastSend = now - lastOtpSendTime;
    const oneMinute = 60000;

    if (lastOtpSendTime > 0 && timeSinceLastSend < oneMinute) {
        const remainingSeconds = Math.ceil((oneMinute - timeSinceLastSend) / 1000);
        emailError.textContent = `${remainingSeconds}초 후에 재발송할 수 있습니다.`;
        return;
    }

    emailError.textContent = '';
    verifyBtn.disabled = true;
    verifyBtn.textContent = '확인 중...';

    try {
        const checkRes = await fetch(`${API_BASE}/api/auth/check-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        if (!checkRes.ok) {
            const data = await checkRes.json();
            throw new Error(data.detail || '이메일 확인 실패');
        }

        const checkData = await checkRes.json();
        if (checkData.exists) {
            throw new Error('이미 가입된 이메일입니다.');
        }

        verifyBtn.textContent = '발송 중...';

        const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.detail || '인증번호 발송 실패');
        }

        lastOtpSendTime = Date.now();
        currentEmail = email;
        document.getElementById('otpGroup').style.display = 'block';
        verifyBtn.textContent = '발송';
        verifyBtn.disabled = false;

        document.getElementById('otpCode').addEventListener('input', async function() {
            const code = this.value.trim();
            if (code.length === 6) {
                await verifyOTP(code);
            }
        });

    } catch (e) {
        emailError.textContent = e.message;
        verifyBtn.textContent = '인증하기';
        verifyBtn.disabled = false;
    }
}

async function verifyOTP(code) {
    const otpError = document.getElementById('otpError');
    const otpSuccess = document.getElementById('otpSuccess');

    try {
        const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentEmail, otp: code })
        });

        if (!res.ok) {
            throw new Error('인증번호가 일치하지 않습니다.');
        }

        otpVerified = true;
        otpError.textContent = '';
        otpSuccess.textContent = '✓ 인증되었습니다.';
        document.getElementById('otpCode').disabled = true;
        document.getElementById('verifyBtn').disabled = true;

    } catch (e) {
        otpVerified = false;
        otpError.textContent = e.message;
        otpSuccess.textContent = '';
    }
}

async function submitSignup() {
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const name = document.getElementById('signupName').value.trim();

    const emailError = document.getElementById('emailError');
    const passwordError = document.getElementById('passwordError');
    const nameError = document.getElementById('nameError');

    let hasError = false;

    if (!validateEmail(email)) {
        emailError.textContent = '올바른 이메일 형식이 아닙니다.';
        hasError = true;
    } else {
        emailError.textContent = '';
    }

    if (!otpVerified) {
        emailError.textContent = '이메일 인증을 완료해주세요.';
        hasError = true;
    }

    if (password.length < 8) {
        passwordError.textContent = '비밀번호는 8자 이상이어야 합니다.';
        hasError = true;
    } else {
        passwordError.textContent = '';
    }

    if (!name) {
        nameError.textContent = '이름을 입력해주세요.';
        hasError = true;
    } else {
        nameError.textContent = '';
    }

    if (hasError) return;

    const submitBtn = document.querySelector('.signup-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '처리 중...';

    try {
        const res = await fetch(`${API_BASE}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name })
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.detail || '회원가입 실패');
        }

        alert('회원가입이 완료되었습니다. 로그인해주세요.');
        closeModal();
        document.getElementById('email').value = email;

    } catch (e) {
        alert(e.message);
        submitBtn.disabled = false;
        submitBtn.textContent = '제출하기';
    }
}
