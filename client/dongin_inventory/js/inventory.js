const API_BASE = 'http://192.168.0.254:8000';

let currentCategory = 'all';
let inventoryData = [];
let currentSort = null;
let currentSortDir = 'asc';

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

function getStatusOrder(item) {
    const threshold = item.low_stock_threshold || 10;
    if (item.quantity === 0) return 0;
    if (item.quantity < threshold) return 1;
    return 2;
}

function sortBy(field) {
    if (currentSort === field) {
        currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort = field;
        currentSortDir = 'asc';
    }
    document.querySelectorAll('.sort-icon').forEach(el => el.textContent = '');
    const icon = document.getElementById('sort-' + field);
    if (icon) icon.textContent = currentSortDir === 'asc' ? ' ▲' : ' ▼';
    renderInventory(document.getElementById('searchInput').value);
}

function renderInventory(searchTerm = '') {
    const tbody = document.getElementById('inventoryList');

    let filteredData = inventoryData.filter(item => {
        const categoryMatch = currentCategory === 'all' || item.category === currentCategory;
        const searchMatch = !searchTerm || item.name.toLowerCase().includes(searchTerm.toLowerCase());
        return categoryMatch && searchMatch;
    });

    if (currentSort) {
        filteredData = [...filteredData].sort((a, b) => {
            let va, vb;
            if (currentSort === 'status') {
                va = getStatusOrder(a); vb = getStatusOrder(b);
            } else if (currentSort === 'quantity') {
                va = a.quantity; vb = b.quantity;
            } else if (currentSort === 'created_at') {
                va = new Date(a.created_at); vb = new Date(b.created_at);
            } else {
                va = (a[currentSort] || '').toLowerCase();
                vb = (b[currentSort] || '').toLowerCase();
                return currentSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
            }
            return currentSortDir === 'asc' ? va - vb : vb - va;
        });
    }

    tbody.innerHTML = filteredData.map(item => {
        const threshold = item.low_stock_threshold || 10;
        const statusClass = item.quantity === 0 ? 'status-out' : item.quantity < threshold ? 'status-low' : 'status-available';
        const statusText = item.quantity === 0 ? '품절' : item.quantity < threshold ? '재고부족' : '재고있음';

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
    document.getElementById('addLowStockThreshold').value = '10';
    document.getElementById('addLocation').value = '';
    document.getElementById('addInventoryModal').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

async function submitAddInventory() {
    const name = document.getElementById('addItemName').value.trim();
    const category = document.getElementById('addCategory').value;
    const quantity = parseInt(document.getElementById('addQuantity').value);
    const low_stock_threshold = parseInt(document.getElementById('addLowStockThreshold').value);
    const location = document.getElementById('addLocation').value.trim();

    if (!name || isNaN(quantity) || isNaN(low_stock_threshold)) {
        alert('품목명, 수량, 재고부족 기준을 입력해주세요.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/inventory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, category, quantity, low_stock_threshold, location })
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
    document.getElementById('editLowStockThreshold').value = item.low_stock_threshold || 10;
    document.getElementById('editLocation').value = item.location || '';
    document.getElementById('editInventoryModal').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

async function submitEditInventory() {
    const id = document.getElementById('editItemId').value;
    const name = document.getElementById('editItemName').value.trim();
    const category = document.getElementById('editCategory').value;
    const quantity = parseInt(document.getElementById('editQuantity').value);
    const low_stock_threshold = parseInt(document.getElementById('editLowStockThreshold').value);
    const location = document.getElementById('editLocation').value.trim();

    if (!name || isNaN(quantity) || isNaN(low_stock_threshold)) {
        alert('품목명, 수량, 재고부족 기준을 입력해주세요.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/inventory/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, category, quantity, low_stock_threshold, location })
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

function logout() {
    hideAllModals();
    document.getElementById('logoutContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

async function confirmLogout() {
    closeModal();
    const token = localStorage.getItem('access_token');
    if (token) {
        try {
            await fetch(`${API_BASE}/api/auth/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch {}
    }
    localStorage.removeItem('access_token');
    const overlay = document.getElementById('logoutOverlay');
    if (overlay) {
        overlay.classList.add('active');
        setTimeout(() => { window.location.href = '../login.html?from=logout'; }, 600);
    } else {
        window.location.href = '../login.html?from=logout';
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