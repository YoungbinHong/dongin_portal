const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  // 프로그램 창 설정
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    // [v1.11] 최소 크기 제한 추가
    minWidth: 1280,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true // 상단 메뉴바 숨김
  });

  // 처음 실행할 파일 로드
  win.loadFile('login.html');
}

// 앱이 준비되면 창 실행
app.whenReady().then(createWindow);

// 창이 모두 닫히면 종료
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});