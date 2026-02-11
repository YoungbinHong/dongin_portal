let currentFolder = 'inbox';
let selectedEmailId = null;

const mailData = {
    inbox: [
        { id: 1, from: 'Lee Jungwon', email: 'lee.jw@company.com', subject: 'Q1 보고서 검토 요청', preview: '안녕하세요, 1분기 보고서를 검토해 주시면 감사하겠습니다.', time: '오늘 09:15', read: false, body: '안녕하세요,\n\n1분기 보고서를 검토해 주시면 감사하겠습니다.\n\n주요 내용:\n• 매출 실적: 전분기 대비 12% 증가\n• 비용 절감: 운영비 8% 절감 달성\n• 고객 만족도: 92% (최고점)\n\n세부 사항은 첨부 파일을 참고하시기 바랍니다.\n\n감사합니다.\nLee Jungwon' },
        { id: 2, from: 'Park Sujin', email: 'park.sj@company.com', subject: '팀 회의 일정 변경 안내', preview: '안녕하세요. 내일 오후 3시로 회의 시간이 변경되었습니다.', time: '오늘 08:40', read: false, body: '안녕하세요,\n\n기존 오후 2시로 잡아두신 팀 회의를 오후 3시로 변경하고 있습니다.\n\n변경 사유: 회의실 예약 충돌로 인해\n새 일정: 내일 오후 3시 ~ 4시\n장소: 회의실 B\n\n불편드린 점 사과드립니다.\n\n감사합니다.\nPark Sujin' },
        { id: 3, from: 'Kim Minjun', email: 'kim.mj@naver.com', subject: 'DONGIN 프로젝트 진행 현황', preview: '현재 진행 현황을 공유드립니다. v0.2.0 개발이 순조롭게...', time: '오늘 07:20', read: true, body: '안녕하세요,\n\n현재 진행 현황을 공유드립니다.\n\nv0.2.0 개발 진행률: 78%\n- 원격 제어 모듈: 완료\n- 메일 스크리너: 테스팅 중\n- 커뮤니티: 개발 중\n\n예상 배포일: 2026년 2월 15일\n\n질문 사항이 있으시면 언제든지 연락주세요.\n\n감사합니다.\nKim Minjun' }
    ],
    spam: [
        { id: 4, from: 'Marketing Pro', email: 'promo@marketing-pro.xyz', subject: '특별 할인! 제한 시간 오퍼', preview: '지금당장 클릭하여 90% 할인을 받으세요! 오늘만의 특별 프로모션입니다.', time: '어제 14:22', read: false, spamReason: '불법 광고 메일로 감지됨', body: '특별 할인 행사 안내!\n\n지금당장 아래 링크를 클릭하여 90% 할인을 받으세요!\n\n본 오퍼는 오늘까지만 유효합니다.\n최고급 제품을 초저가로 구매하는 기회를 놓치지 마세요.\n\n문의: support@marketing-pro.xyz' }
    ],
    phishing: [
        { id: 5, from: 'Korea Bank Security', email: 'security@korea-bank-verify.net', subject: '[긴급] 계좌 보안 확인 필요', preview: '귀하의 계좌가 보안 위험에 처해 있습니다. 즉시 확인하세요.', time: '어제 11:05', read: false, phishingReason: '의심스러운 URL 및 사칭 발신자 감지', body: '[긴급 보안 경보]\n\n귀하의 계좌가 보안 위험에 처해 있습니다.\n즉시 아래 링크를 통해 본인인증을 완료하시기 바랍니다.\n\n24시간 내 확인하지 않으면 계좌가 정지될 수 있습니다.\n\nKorea Bank Security Team\nsecurity@korea-bank-verify.net' },
        { id: 6, from: 'PayService Support', email: 'support@pay-service-alert.com', subject: '결제 실패 - 즉시 조치 필요', preview: '귀하의 결제가 실패했습니다. 아래 링크를 클릭하여 정보를 확인하세요.', time: '2일 전', read: false, phishingReason: '피싱 링크 감지: 공식 사이트와 일치하지 않음', body: '결제 실패 안내\n\n귀하의 최근 결제 요청이 실패하였습니다.\n정상 처리를 위해 아래 링크를 통해 결제 정보를 확인하시기 바랍니다.\n\n신속한 조치를 취해 주시기 바랍니다.\n\nPayService Support\nsupport@pay-service-alert.com' }
    ],
    sent: [
        { id: 7, from: '나 (me@company.com)', email: 'me@company.com', subject: 'Re: Q1 보고서 검토 요청', preview: '확인하고 피드백드리겠습니다. 오후에 상세 리뷰를 진행하겠습니다.', time: '오늘 10:00', read: true, to: 'lee.jw@company.com', body: 'Re: Q1 보고서 검토 요청\n\n안녕하세요,\n\n감사합니다. 보고서를 확인하고 오후에 상세 리뷰를 진행하겠습니다.\n피드백을 드리겠습니다.\n\n감사합니다.' }
    ],
    drafts: [
        { id: 8, from: '나 (me@company.com)', email: 'me@company.com', subject: '프로젝트 제안서 (임시저장)', preview: '다음 분기 계획을 바탕으로 새로운 프로젝트 제안서를 작성 중입니다.', time: '어제 16:30', read: true, body: '프로젝트 제안서\n\n다음 분기 계획을 바탕으로 새로운 프로젝트를 제안합니다.\n\n1. 프로젝트 목표\n- 이용자 경험 개선\n- 새 기능 도입\n\n2. 예상 일정\n- 설계: 2월\n- 개발: 3월\n\n(작성 중)' }
    ]
};

const folderTitles = { inbox: '받은편지함', spam: '스팸', phishing: '피싱 경보', sent: '보내기', drafts: '임시저장' };

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('donginTheme');
    if (savedTheme === 'dark') document.body.classList.add('dark-theme');

    setTimeout(() => {
        document.querySelector('.sidebar').classList.add('show');
        document.querySelector('.main-container').classList.add('show');
    }, 100);

    renderMailList();
});

function selectFolder(folder) {
    currentFolder = folder;
    selectedEmailId = null;
    document.querySelectorAll('.menu-item[data-folder]').forEach(item => item.classList.remove('active'));
    document.querySelector(`[data-folder="${folder}"]`).classList.add('active');

    if (folder === 'account') {
        document.getElementById('mailView').classList.remove('active');
        document.getElementById('accountSection').classList.add('active');
    } else {
        document.getElementById('accountSection').classList.remove('active');
        document.getElementById('mailView').classList.add('active');
        renderMailList();
    }
}

function renderMailList() {
    const emails = mailData[currentFolder] || [];
    document.getElementById('mailListTitle').textContent = folderTitles[currentFolder] || '';
    const unread = emails.filter(e => !e.read).length;
    document.getElementById('mailCount').textContent = unread > 0 ? `${unread}개 미읽음` : `${emails.length}개`;

    document.getElementById('mailList').innerHTML = emails.map(email => `
        <div class="mail-item ${email.read ? 'read' : 'unread'} ${selectedEmailId === email.id ? 'selected' : ''}" onclick="selectEmail(${email.id})">
            <div class="mail-avatar">${email.from.charAt(0)}</div>
            <div class="mail-info">
                <div class="mail-sender">${email.from}</div>
                <div class="mail-subject">${email.subject}</div>
                <div class="mail-preview">${email.preview}</div>
            </div>
            <div class="mail-time">${email.time}</div>
        </div>
    `).join('');
}

function selectEmail(id) {
    selectedEmailId = id;
    const allEmails = Object.values(mailData).flat();
    const email = allEmails.find(e => e.id === id);
    if (!email) return;

    email.read = true;
    renderMailList();
    updateBadges();

    let warningHtml = '';
    if (email.phishingReason) {
        warningHtml = `<div class="warning-banner phishing">
            <svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
            <div><div class="warning-text">피싱 메일 주의!</div><div class="warning-reason">${email.phishingReason}</div></div>
        </div>`;
    } else if (email.spamReason) {
        warningHtml = `<div class="warning-banner spam">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            <div><div class="warning-text">스팸 메일로 감지됨</div><div class="warning-reason">${email.spamReason}</div></div>
        </div>`;
    }

    document.getElementById('mailPreviewPanel').innerHTML = `
        <div class="mail-preview-header">
            <div class="mail-preview-actions">
                <button class="action-btn" onclick="showAlert('답장', '백엔드 서버와 연결 후 사용 가능한 기능입니다.')">답장</button>
                <button class="action-btn" onclick="showAlert('전달', '백엔드 서버와 연결 후 사용 가능한 기능입니다.')">전달</button>
                <button class="action-btn danger" onclick="showAlert('삭제', '백엔드 서버와 연결 후 사용 가능한 기능입니다.')">삭제</button>
            </div>
        </div>
        ${warningHtml}
        <div class="mail-preview-subject">${email.subject}</div>
        <div class="mail-preview-meta">
            <span><strong>발신자:</strong> ${email.from} &lt;${email.email}&gt;</span>
            ${email.to ? `<span><strong>수신자:</strong> ${email.to}</span>` : ''}
            <span>${email.time}</span>
        </div>
        <div class="mail-preview-body">${email.body.replace(/\n/g, '<br>')}</div>
    `;
}

function updateBadges() {
    const counts = { inbox: 'inboxBadge', spam: 'spamBadge', phishing: 'phishingBadge' };
    Object.keys(counts).forEach(folder => {
        const unread = mailData[folder].filter(e => !e.read).length;
        const el = document.getElementById(counts[folder]);
        el.style.display = unread > 0 ? 'flex' : 'none';
        if (unread > 0) el.textContent = unread;
    });
}

function selectProtocol(proto) {
    document.querySelectorAll('.proto-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-proto="${proto}"]`).classList.add('active');
    if (proto === 'imap') {
        document.getElementById('serverLabel').textContent = 'IMAP 서버';
        document.getElementById('accountServer').placeholder = 'imap.example.com';
        document.getElementById('accountPort').value = '993';
    } else {
        document.getElementById('serverLabel').textContent = 'POP3 서버';
        document.getElementById('accountServer').placeholder = 'pop3.example.com';
        document.getElementById('accountPort').value = '995';
    }
}

function saveAccount() {
    const name = document.getElementById('accountName').value.trim();
    const email = document.getElementById('accountEmail').value.trim();
    const server = document.getElementById('accountServer').value.trim();
    if (!name || !email || !server) {
        showAlert('입력 오류', '이름, 이메일 주소, 서버 정보를 모두 입력해주세요.');
        return;
    }
    showAlert('계정 저장', '백엔드 서버와 연결 후 사용 가능한 기능입니다.');
}

function showAlert(title, message) {
    document.getElementById('alertTitle').textContent = title;
    document.getElementById('alertBody').textContent = message;
    document.querySelectorAll('.alert-modal').forEach(m => m.style.display = 'none');
    document.getElementById('alertContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.querySelectorAll('.alert-modal, .settings-modal').forEach(el => el.style.display = 'none');
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('modalOverlay');
        if (modal && modal.style.display === 'flex') closeModal();
    }
});

function logout() {
    document.querySelectorAll('.alert-modal, .settings-modal').forEach(m => m.style.display = 'none');
    document.getElementById('logoutContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

function confirmLogout() {
    closeModal();
    document.getElementById('logoutOverlay').classList.add('active');
    setTimeout(() => { window.location.href = '../login.html?from=logout'; }, 600);
}

function showHomeConfirm() {
    document.querySelectorAll('.alert-modal, .settings-modal').forEach(m => m.style.display = 'none');
    document.getElementById('homeContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

function confirmGoToMenu() {
    closeModal();

    const pathname = window.location.pathname;
    const appMatch = pathname.match(/client[\/\\]dongin_([^\/\\]+)/);
    let targetUrl = '../menu.html';

    if (appMatch) {
        const appName = appMatch[1];
        targetUrl = `../menu.html?from=${appName}`;
    }

    document.getElementById('logoutOverlay').classList.add('active');
    setTimeout(() => { window.location.href = targetUrl; }, 400);
}

function openSettings() {
    document.querySelectorAll('.alert-modal').forEach(el => el.style.display = 'none');
    document.getElementById('modalOverlay').style.display = 'flex';
    document.getElementById('settingsContent').style.display = 'flex';
    loadSettingsState();
}

function switchTab(event, tabName) {
    document.querySelectorAll('.settings-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.settings-menu-item').forEach(item => item.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
}

function applyTheme(theme) {
    localStorage.setItem('donginTheme', theme);
    if (theme === 'dark') document.body.classList.add('dark-theme');
    else document.body.classList.remove('dark-theme');
}

function loadSettingsState() {
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = localStorage.getItem('donginTheme') || 'light';
    checkAutoStartStatus();
}

async function checkAutoStartStatus() {
    const checkbox = document.getElementById('autoStartCheckbox');
    if (!checkbox || !window.api) return;
    checkbox.checked = await window.api.checkAutoStart();
}

async function toggleAutoStart(enabled) {
    if (!window.api) return;
    const result = await window.api.setAutoStart(enabled);
    if (!result.success) {
        showAlert('오류', '자동 실행 설정에 실패했습니다.');
        document.getElementById('autoStartCheckbox').checked = !enabled;
    }
}
