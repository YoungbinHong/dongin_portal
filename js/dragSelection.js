/* === 드래그 선택 기능 === */
function initDragSelection() {
    const selectionBox = document.getElementById('selectionBox');
    const mainContainer = document.querySelector('.main-container');
    if (!mainContainer || !selectionBox) return;

    mainContainer.addEventListener('mousedown', (e) => {
        if (e.target.closest('.action-bar') ||
            e.target.closest('button') ||
            e.target.closest('.file-list-header') ||
            e.target.closest('input') ||
            e.target.closest('select') ||
            e.target.closest('.preview-pane') ||
            e.target.closest('.preview-resizer')) {
            return;
        }

        isDragPending = true;
        isDragging = false;
        dragStartX = e.clientX;
        dragStartY = e.clientY;

        selectionBox.style.left = dragStartX + 'px';
        selectionBox.style.top = dragStartY + 'px';
        selectionBox.style.width = '0';
        selectionBox.style.height = '0';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragPending && !isDragging) return;

        const currentX = e.clientX;
        const currentY = e.clientY;
        const deltaX = Math.abs(currentX - dragStartX);
        const deltaY = Math.abs(currentY - dragStartY);

        if (isDragPending && !isDragging) {
            if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
                isDragging = true;
                isDragPending = false;

                if (!e.ctrlKey) {
                    clearAllSelections();
                }
            } else {
                return;
            }
        }

        const left = Math.min(dragStartX, currentX);
        const top = Math.min(dragStartY, currentY);
        const width = Math.abs(currentX - dragStartX);
        const height = Math.abs(currentY - dragStartY);

        selectionBox.style.left = left + 'px';
        selectionBox.style.top = top + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
        selectionBox.classList.add('active');

        selectItemsInBox(left, top, width, height, e.ctrlKey);
    });

    document.addEventListener('mouseup', (e) => {
        const wasDragging = isDragging;

        if (isDragging) {
            isDragging = false;
            selectionBox.classList.remove('active');
            selectionBox.style.width = '0';
            selectionBox.style.height = '0';
            updateBar();
        }

        if (isDragPending && !wasDragging) {
            const target = e.target;
            if (!target.closest('.file-card') &&
                !target.closest('.file-list-item') &&
                !target.closest('.action-bar') &&
                !target.closest('button')) {
                if (!e.ctrlKey) {
                    clearAllSelections();
                }
            }
        }

        isDragPending = false;
    });
}

function selectItemsInBox(boxLeft, boxTop, boxWidth, boxHeight, addToSelection) {
    const boxRight = boxLeft + boxWidth;
    const boxBottom = boxTop + boxHeight;

    const gridItems = document.querySelectorAll('.file-card');
    gridItems.forEach(item => {
        const rect = item.getBoundingClientRect();
        const intersects = !(rect.right < boxLeft ||
                            rect.left > boxRight ||
                            rect.bottom < boxTop ||
                            rect.top > boxBottom);

        if (intersects) {
            item.classList.add('selected');
        } else if (!addToSelection) {
            item.classList.remove('selected');
        }
    });

    const smallGridItems = document.querySelectorAll('.file-card-small');
    smallGridItems.forEach(item => {
        const rect = item.getBoundingClientRect();
        const intersects = !(rect.right < boxLeft ||
                            rect.left > boxRight ||
                            rect.bottom < boxTop ||
                            rect.top > boxBottom);

        if (intersects) {
            item.classList.add('selected');
        } else if (!addToSelection) {
            item.classList.remove('selected');
        }
    });

    const listItems = document.querySelectorAll('.file-list-item');
    listItems.forEach(item => {
        const rect = item.getBoundingClientRect();
        const intersects = !(rect.right < boxLeft ||
                            rect.left > boxRight ||
                            rect.bottom < boxTop ||
                            rect.top > boxBottom);

        if (intersects) {
            item.classList.add('selected');
        } else if (!addToSelection) {
            item.classList.remove('selected');
        }
    });
}