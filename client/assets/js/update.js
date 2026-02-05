const statusText = document.getElementById('statusText');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

window.api.onUpdateStatus((event, data) => {
    switch (data.status) {
        case 'checking':
            statusText.textContent = '업데이트 확인중...';
            break;
        case 'available':
            statusText.textContent = `새 버전 ${data.version} 다운로드중...`;
            progressBar.classList.add('determinate');
            break;
        case 'not-available':
            statusText.textContent = '최신 버전입니다';
            progressBar.style.width = '100%';
            progressBar.classList.add('determinate');
            setTimeout(() => {
                document.querySelector('.wave-wrapper').classList.add('success');
                document.querySelector('.update-wrapper').classList.add('success');
                setTimeout(() => {
                    window.api.goToLogin();
                }, 800);
            }, 500);
            break;
        case 'downloading':
            progressBar.style.width = data.percent + '%';
            progressText.textContent = `${Math.round(data.percent)}% (${formatBytes(data.transferred)} / ${formatBytes(data.total)})`;
            break;
        case 'downloaded':
            statusText.textContent = '업데이트 설치중...';
            progressBar.style.width = '100%';
            progressText.textContent = '잠시 후 재시작됩니다';
            break;
        case 'error':
            statusText.textContent = '업데이트 확인 실패';
            progressText.textContent = '로그인 화면으로 이동합니다...';
            progressBar.style.width = '100%';
            progressBar.classList.add('determinate');
            setTimeout(() => {
                document.querySelector('.wave-wrapper').classList.add('success');
                document.querySelector('.update-wrapper').classList.add('success');
                setTimeout(() => {
                    window.api.goToLogin();
                }, 800);
            }, 1500);
            break;
    }
});

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}