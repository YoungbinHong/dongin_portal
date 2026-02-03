/* === 모달 관리 === */
function showCompletionModal(message) {
    const noticeEnabled = localStorage.getItem('notice-completion') !== 'false';
    if (!noticeEnabled) {
        console.log('완료 알림이 비활성화되어 있습니다:', message);
        return;
    }

    if (completeTimeoutId) {
        clearTimeout(completeTimeoutId);
        completeTimeoutId = null;
    }

    const modal = document.getElementById('modalOverlay');
    const completeContent = document.getElementById('completeContent');

    document.querySelectorAll('.alert-modal, .settings-modal').forEach(el => el.style.display = 'none');

    modal.style.display = 'flex';
    completeContent.style.display = 'block';
    document.getElementById('completeMsg').innerText = message;

    completeTimeoutId = setTimeout(() => {
        if (completeContent.style.display !== 'none') {
            closeModal();
        }
    }, 3000);
}

function showAlertModal(title, message) {
    const modal = document.getElementById('modalOverlay');
    const alertContent = document.getElementById('alertContent');

    document.querySelectorAll('.alert-modal, .settings-modal').forEach(el => el.style.display = 'none');

    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertBody').innerText = message;

    modal.style.display = 'flex';
    alertContent.style.display = 'block';
}

function closeModal() {
    if (completeTimeoutId) {
        clearTimeout(completeTimeoutId);
        completeTimeoutId = null;
    }
    document.getElementById('modalOverlay').style.display = 'none';
}