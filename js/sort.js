/* === 정렬 기능 === */
function toggleSort(column) {
    const headers = document.querySelectorAll('.file-list-header .sortable');

    if (currentSort === column) {
        if (sortDirection === 'asc') {
            sortDirection = 'desc';
        } else if (sortDirection === 'desc') {
            sortDirection = null;
            currentSort = null;
        }
    } else {
        currentSort = column;
        sortDirection = 'asc';
    }

    headers.forEach(header => {
        header.classList.remove('asc', 'desc', 'active');
        if (header.dataset.sort === currentSort) {
            header.classList.add('active');
            if (sortDirection) {
                header.classList.add(sortDirection);
            }
        }
    });

    renderFileList();
}

function sortFiles(files) {
    if (!currentSort || !sortDirection) {
        return [...files];
    }

    const sorted = [...files];
    const dir = sortDirection === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;

        let comparison = 0;

        switch (currentSort) {
            case 'name':
                comparison = a.name.localeCompare(b.name, 'ko');
                break;
            case 'date':
                comparison = (a.modifiedTime || 0) - (b.modifiedTime || 0);
                break;
            case 'type':
                const typeA = getFileType(a.name, a.isDirectory);
                const typeB = getFileType(b.name, b.isDirectory);
                comparison = typeA.localeCompare(typeB, 'ko');
                break;
            case 'size':
                comparison = (a.size || 0) - (b.size || 0);
                break;
        }

        return comparison * dir;
    });

    return sorted;
}