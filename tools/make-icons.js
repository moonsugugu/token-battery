// 아이콘 PNG 생성: electron tools/make-icons.js [출력폴더]
// 캐릭터 SVG(renderer/characters.js)를 캔버스로 그려 assets/에 저장한다. .ico는 tools/make-ico.py로 만든다.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const outDir = process.argv.find((a) => a.startsWith('--out='))?.slice(6) || path.join(__dirname, '..', 'assets');

app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false });
  await w.loadFile(path.join(__dirname, 'icon-page.html'));
  const files = await w.webContents.executeJavaScript('makeAll()');
  for (const [name, dataUrl] of Object.entries(files)) {
    fs.writeFileSync(path.join(outDir, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log('wrote', name);
  }
  app.quit();
});
