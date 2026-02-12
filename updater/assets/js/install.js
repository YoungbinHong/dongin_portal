const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const statusText = document.getElementById('statusText');
const versionText = document.getElementById('versionText');

window.api.getVersion().then(v => {
    if (v) versionText.textContent = `v${v}`;
});

window.api.onProgress(p => {
    progressBar.style.width = p + '%';
    progressText.textContent = p + '%';
});

window.api.onStatus(s => {
    statusText.textContent = s;
});

window.api.onError(msg => {
    document.getElementById('errorModal').classList.add('show');
    document.getElementById('errorText').textContent = msg;
});