const API_BASE = 'http://192.168.0.254:8000';

let currentCategory = 'all';
let inventoryData = [];

document.addEventListener('DOMContentLoaded', () => {
    loadSavedTheme();
    setTimeout(() => {
        document.querySelector('.sidebar').classList.add('show');
        document.querySelector('.main').classList.add('show');
    }, 100);
    initCategoryList();
    initSearch();
    loadInventory();
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

    renderInventory();
}

function initSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        renderInventory(e.target.value);
    });
}

async function loadInventory() {
    try {
        const response = await fetch(`${API_BASE}/api/inventory`);
        if (response.ok) {
            inventoryData = await response.json();
            renderInventory();
            updateCategoryCounts();
        }
    } catch (error) {
        console.error('재고 로드 실패:', error);
    }
}

function renderInventory(searchTerm = '') {
    const tbody = document.getElementById('inventoryList');

    const filteredData = inventoryData.filter(item => {
        const categoryMatch = currentCategory === 'all' || item.category === currentCategory;
        const searchMatch = !searchTerm || item.name.toLowerCase().includes(searchTerm.toLowerCase());
        return categoryMatch && searchMatch;
    });

    tbody.innerHTML = filteredData.map(item => {
        const statusClass = item.quantity > 10 ? 'status-available' : item.quantity > 0 ? 'status-low' : 'status-out';
        const statusText = item.quantity > 10 ? '재고있음' : item.quantity > 0 ? '재고부족' : '품절';

        return `
            <tr data-id="${item.id}">
                <td class="item-name">${item.name}</td>
                <td><span class="badge badge-${item.category}">${getCategoryName(item.category)}</span></td>
                <td>${item.quantity}</td>
                <td>${item.location || '-'}</td>
                <td><span class="status ${statusClass}">${statusText}</span></td>
                <td>${formatDate(item.created_at)}</td>
                <td>
                    <button class="action-btn" title="수정" onclick="openEditModal(${item.id})">
                        <svg viewBox="0 0 24 24">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                    </button>
                    <button class="action-btn" title="삭제" onclick="openDeleteModal(${item.id}, '${item.name}')">
                        <svg viewBox="0 0 24 24">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function getCategoryName(category) {
    const names = {
        electronics: '전자기기',
        office: '사무용품',
        furniture: '가구',
        etc: '기타'
    };
    return names[category] || category;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
}

function updateCategoryCounts() {
    const counts = {
        all: inventoryData.length,
        electronics: inventoryData.filter(i => i.category === 'electronics').length,
        office: inventoryData.filter(i => i.category === 'office').length,
        furniture: inventoryData.filter(i => i.category === 'furniture').length,
        etc: inventoryData.filter(i => i.category === 'etc').length
    };

    document.querySelectorAll('.category-item').forEach(item => {
        const category = item.dataset.category;
        const countEl = item.querySelector('.count');
        if (countEl && counts[category] !== undefined) {
            countEl.textContent = counts[category];
        }
    });
}

function openAddModal() {
    hideAllModals();
    document.getElementById('addItemName').value = '';
    document.getElementById('addCategory').value = 'electronics';
    document.getElementById('addQuantity').value = '';
    document.getElementById('addLocation').value = '';
    document.getElementById('addInventoryModal').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

async function submitAddInventory() {
    const name = document.getElementById('addItemName').value.trim();
    const category = document.getElementById('addCategory').value;
    const quantity = parseInt(document.getElementById('addQuantity').value);
    const location = document.getElementById('addLocation').value.trim();

    if (!name || isNaN(quantity)) {
        alert('품목명과 수량을 입력해주세요.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/inventory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, category, quantity, location })
        });

        if (response.ok) {
            closeModal();
            await loadInventory();
        } else {
            alert('재고 추가에 실패했습니다.');
        }
    } catch (error) {
        console.error('재고 추가 실패:', error);
        alert('서버 연결에 실패했습니다.');
    }
}

function openEditModal(id) {
    const item = inventoryData.find(i => i.id === id);
    if (!item) return;

    hideAllModals();
    document.getElementById('editItemId').value = item.id;
    document.getElementById('editItemName').value = item.name;
    document.getElementById('editCategory').value = item.category;
    document.getElementById('editQuantity').value = item.quantity;
    document.getElementById('editLocation').value = item.location || '';
    document.getElementById('editInventoryModal').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

async function submitEditInventory() {
    const id = document.getElementById('editItemId').value;
    const name = document.getElementById('editItemName').value.trim();
    const category = document.getElementById('editCategory').value;
    const quantity = parseInt(document.getElementById('editQuantity').value);
    const location = document.getElementById('editLocation').value.trim();

    if (!name || isNaN(quantity)) {
        alert('품목명과 수량을 입력해주세요.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/inventory/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, category, quantity, location })
        });

        if (response.ok) {
            closeModal();
            await loadInventory();
        } else {
            alert('재고 수정에 실패했습니다.');
        }
    } catch (error) {
        console.error('재고 수정 실패:', error);
        alert('서버 연결에 실패했습니다.');
    }
}

function openDeleteModal(id, name) {
    hideAllModals();
    document.getElementById('deleteItemId').value = id;
    document.getElementById('deleteItemName').textContent = name;
    document.getElementById('deleteConfirmModal').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

async function confirmDeleteInventory() {
    const id = document.getElementById('deleteItemId').value;

    try {
        const response = await fetch(`${API_BASE}/api/inventory/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            closeModal();
            await loadInventory();
        } else {
            alert('재고 삭제에 실패했습니다.');
        }
    } catch (error) {
        console.error('재고 삭제 실패:', error);
        alert('서버 연결에 실패했습니다.');
    }
}

function showHomeConfirm() {
    hideAllModals();
    document.getElementById('homeContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

function confirmGoToMenu() {
    closeModal();
    const overlay = document.getElementById('logoutOverlay');
    if (overlay) {
        overlay.classList.add('active');
        setTimeout(() => {
            window.location.href = '../menu.html?from=inventory';
        }, 400);
    } else {
        window.location.href = '../menu.html?from=inventory';
    }
}

function hideAllModals() {
    document.querySelectorAll('.alert-modal, .inventory-form-modal').forEach(el => el.style.display = 'none');
}

function closeModal() {
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) modalOverlay.style.display = 'none';
    hideAllModals();
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
        closeModal();
        closeSettings();
    }
});