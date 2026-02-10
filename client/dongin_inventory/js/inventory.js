const API_BASE = 'http://192.168.0.254:8000';

let currentCategory = 'all';

document.addEventListener('DOMContentLoaded', () => {
    loadSavedTheme();
    initCategoryList();
    initSearch();
});

function initCategoryList() {
    const categoryItems = document.querySelectorAll('.category-item');
    categoryItems.forEach(item => {
        item.addEventListener('click', () => {
            const category = item.dataset.category;
            selectCategory(category);
        });
    });
}

function selectCategory(category) {
    currentCategory = category;

    document.querySelectorAll('.category-item').forEach(item => {
        item.classList.remove('active');
    });

    const selectedCategory = document.querySelector(`.category-item[data-category="${category}"]`);
    if (selectedCategory) {
        selectedCategory.classList.add('active');

        const categoryName = selectedCategory.querySelector('span').textContent;
        document.querySelector('.header-title').textContent = categoryName;
    }

    filterInventory();
}

function initSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        filterInventory(e.target.value);
    });
}

function filterInventory(searchTerm = '') {
    const rows = document.querySelectorAll('#inventoryList tr');

    rows.forEach(row => {
        const itemName = row.querySelector('.item-name')?.textContent.toLowerCase() || '';
        const badge = row.querySelector('.badge');
        const categoryClass = badge?.className || '';

        let categoryMatch = true;
        if (currentCategory !== 'all') {
            categoryMatch = categoryClass.includes(currentCategory);
        }

        const searchMatch = !searchTerm || itemName.includes(searchTerm.toLowerCase());

        row.style.display = (categoryMatch && searchMatch) ? '' : 'none';
    });
}

function openAddModal() {
    alert('재고 추가 기능은 준비중입니다.');
}

function goHome() {
    localStorage.setItem('returnFromApp', 'card-inventory');
    const overlay = document.getElementById('logoutOverlay');
    if (overlay) {
        overlay.classList.add('active');
        setTimeout(() => {
            window.location.href = '../menu.html';
        }, 400);
    } else {
        window.location.href = '../menu.html';
    }
}

function openSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.add('active');

    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.value = localStorage.getItem('donginTheme') || 'light';
    }
}

function closeSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('active');
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeSettings();
    }
});
