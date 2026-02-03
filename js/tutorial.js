/* === 튜토리얼 기능 === */
const tutorialSteps = [
    { type: 'intro' },
    {
        target: '#sidebarMenu',
        message: '이 곳에서 원하는 경로를 선택할 수 있습니다.',
        position: 'right',
        highlightClass: 'tutorial-highlight-area'
    },
    {
        target: '.footer-icon[onclick="openSettings()"]',
        message: '프로그램의 설정을 관리합니다.',
        position: 'right'
    },
    {
        target: '.footer-icon[onclick="logout()"]',
        message: '이 버튼으로 로그아웃 할 수 있습니다.',
        position: 'right'
    },
    {
        target: '#backBtn',
        message: '이전 경로로 되돌아갑니다.',
        position: 'bottom'
    },
    {
        target: '.header-content',
        message: '현재 경로를 표시합니다.',
        position: 'bottom'
    },
    {
        target: '#previewToggleBtn',
        message: 'PDF와 이미지 파일의 미리보기를 사용할 수 있습니다.',
        position: 'bottom'
    },
    {
        target: '#viewToggleBtn',
        message: '보기 모드를 전환할 수 있습니다.',
        position: 'bottom'
    }
];

function startTutorial() {
    tutorialStep = 0;
    const overlay = document.getElementById('tutorialOverlay');
    const introModal = document.getElementById('tutorialIntroModal');
    const tooltip = document.getElementById('tutorialTooltip');

    overlay.classList.add('active');
    introModal.style.display = 'block';
    tooltip.classList.remove('active');
}

function nextTutorialStep() {
    tutorialStep++;

    if (currentHighlightedElement) {
        currentHighlightedElement.classList.remove('tutorial-highlight', 'tutorial-highlight-area');
        currentHighlightedElement = null;
    }

    if (tutorialStep >= tutorialSteps.length) {
        endTutorial();
        return;
    }

    const step = tutorialSteps[tutorialStep];
    const introModal = document.getElementById('tutorialIntroModal');
    const tooltip = document.getElementById('tutorialTooltip');
    const tooltipContent = document.getElementById('tutorialTooltipContent');
    const tooltipArrow = document.getElementById('tutorialTooltipArrow');

    introModal.style.display = 'none';

    const targetElement = document.querySelector(step.target);
    if (!targetElement) {
        nextTutorialStep();
        return;
    }

    const highlightClass = step.highlightClass || 'tutorial-highlight';
    targetElement.classList.add(highlightClass);
    currentHighlightedElement = targetElement;

    tooltipContent.innerText = step.message;

    const rect = targetElement.getBoundingClientRect();
    const tooltipWidth = 280;
    const tooltipPadding = 15;

    tooltipArrow.className = 'tutorial-tooltip-arrow';

    let tooltipLeft, tooltipTop;

    switch (step.position) {
        case 'right':
            tooltipLeft = rect.right + tooltipPadding;
            tooltipTop = rect.top + (rect.height / 2) - 60;
            tooltipArrow.classList.add('left');
            break;
        case 'left':
            tooltipLeft = rect.left - tooltipWidth - tooltipPadding;
            tooltipTop = rect.top + (rect.height / 2) - 60;
            tooltipArrow.classList.add('right');
            break;
        case 'bottom':
            tooltipLeft = rect.left + (rect.width / 2) - (tooltipWidth / 2);
            tooltipTop = rect.bottom + tooltipPadding;
            tooltipArrow.classList.add('top');
            break;
        case 'top':
            tooltipLeft = rect.left + (rect.width / 2) - (tooltipWidth / 2);
            tooltipTop = rect.top - 120 - tooltipPadding;
            tooltipArrow.classList.add('bottom');
            break;
    }

    if (tooltipLeft < 10) tooltipLeft = 10;
    if (tooltipLeft + tooltipWidth > window.innerWidth - 10) {
        tooltipLeft = window.innerWidth - tooltipWidth - 10;
    }
    if (tooltipTop < 10) tooltipTop = 10;

    tooltip.style.left = tooltipLeft + 'px';
    tooltip.style.top = tooltipTop + 'px';
    tooltip.classList.add('active');
}

function endTutorial() {
    const overlay = document.getElementById('tutorialOverlay');
    const introModal = document.getElementById('tutorialIntroModal');
    const tooltip = document.getElementById('tutorialTooltip');

    if (currentHighlightedElement) {
        currentHighlightedElement.classList.remove('tutorial-highlight', 'tutorial-highlight-area');
        currentHighlightedElement = null;
    }

    overlay.classList.remove('active');
    introModal.style.display = 'none';
    tooltip.classList.remove('active');
    tutorialStep = 0;
}