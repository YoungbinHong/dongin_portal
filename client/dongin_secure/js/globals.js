let currentPath = '';
let pathHistory = [];
let isCanceled = false;
let completeTimeoutId = null;
let autoLogoutTimerId = null;
let lastActivityTime = Date.now();
let homePath = '';
let pathSep = '\\';
let viewMode = 'list';
let previewEnabled = false;
const DEFAULT_PREVIEW_WIDTH = 350;
const MIN_PREVIEW_WIDTH = 200;
let currentSort = null;
let sortDirection = null;
let originalFiles = [];
let lastSelectedPath = null;
let tutorialStep = 0;
let currentHighlightedElement = null;

let isDragPending = false;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
const DRAG_THRESHOLD = 5;

const previewableImageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'ico', 'svg'];
const previewablePdfExtensions = ['pdf'];