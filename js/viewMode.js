/* === 보기 모드 전환 === */
function toggleViewMode() {
    const grid = document.getElementById('fileGrid');
    const smallGrid = document.getElementById('fileSmallGrid');
    const list = document.getElementById('fileList');
    const iconGrid = document.getElementById('viewIconGrid');
    const iconSmallGrid = document.getElementById('viewIconSmallGrid');
    const iconList = document.getElementById('viewIconList');

    grid.classList.add('hidden');
    smallGrid.classList.add('hidden');
    list.classList.remove('active');
    iconGrid.style.display = 'none';
    iconSmallGrid.style.display = 'none';
    iconList.style.display = 'none';

    if (viewMode === 'list') {
        viewMode = 'grid';
        grid.classList.remove('hidden');
        iconSmallGrid.style.display = 'block';
    } else if (viewMode === 'grid') {
        viewMode = 'small-grid';
        smallGrid.classList.remove('hidden');
        iconList.style.display = 'block';
    } else {
        viewMode = 'list';
        list.classList.add('active');
        iconGrid.style.display = 'block';
    }

    localStorage.setItem('view-mode', viewMode);
}

function loadSavedViewMode() {
    const saved = localStorage.getItem('view-mode');
    const grid = document.getElementById('fileGrid');
    const smallGrid = document.getElementById('fileSmallGrid');
    const list = document.getElementById('fileList');
    const iconGrid = document.getElementById('viewIconGrid');
    const iconSmallGrid = document.getElementById('viewIconSmallGrid');
    const iconList = document.getElementById('viewIconList');

    grid.classList.add('hidden');
    smallGrid.classList.add('hidden');
    list.classList.remove('active');
    iconGrid.style.display = 'none';
    iconSmallGrid.style.display = 'none';
    iconList.style.display = 'none';

    if (saved === 'grid') {
        viewMode = 'grid';
        grid.classList.remove('hidden');
        iconSmallGrid.style.display = 'block';
    } else if (saved === 'small-grid') {
        viewMode = 'small-grid';
        smallGrid.classList.remove('hidden');
        iconList.style.display = 'block';
    } else {
        viewMode = 'list';
        list.classList.add('active');
        iconGrid.style.display = 'block';
    }
}