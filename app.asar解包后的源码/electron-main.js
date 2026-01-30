const { app, BrowserWindow, Menu, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { json } = require('stream/consumers');
const { exec } = require('child_process');
const log = require('electron-log');
log.info('主进程 - 第一步');

// 是否开发模式
const isDev = process.env.NODE_ENV === 'development';

log.info('主进程 - 第二步');

// 监听进程代码 - start
let interval = null;
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
async function fetchWhiteList () {
  try {
    const res = await fetch('https://videoapp.obs.myhuaweicloud.com/static/whiteList.json'); // ✅ 替换为你的服务端接口
    const json = await res.json();
    return json; // 比如 [{ name: 'WeChat.exe', alias: '微信' }]
  } catch (err) {
    console.error('❌ 获取白名单失败:', err);
    fs.writeFileSync('fetch-error.txt', '获取白名单失败');
    return [];
  }
}
function getWindowsProcessList () {
  return new Promise((resolve, reject) => {
    exec('tasklist', (err, stdout) => {
      if (err) {
        return reject(err);
      }
      // 每行一个进程，第一行是表头
      const lines = stdout.trim().split('\n').slice(3);
      const processList = lines.map(line => {
        const parts = line.trim().split(/\s+/);
        return { name: parts[0] };
      });
      resolve(processList);
    });
  });
}
async function startWatching (window) {
  console.log('🚀 启动监听...');
  if (interval) clearInterval(interval);
  interval = setInterval(async () => {
    const whiteList = await fetchWhiteList(); // ✅ 每次监听前重新获取
    const processList = await getWindowsProcessList();
    // 转换为统一格式：全大写 & 去掉 .exe
    const processNameList = processList.map(p =>
      p.name.replace(/\.exe$/i, '').toUpperCase()
    );
    const matched = whiteList.filter(item =>
      processNameList.some(pname => pname === item.name.toUpperCase())
    );

    if (matched.length > 0) {
      console.log('✅ 发现进程：', matched.map(p => p.name));
      window.webContents.send('running-process-list', matched);
    }
  }, 10000);
}
// 监听进程代码 - end

// const menuTemplate = [
//   {
//     label: '刷新',
//     submenu: [
//       { role: 'reload' },
//       { role: 'forcereload' }
//     ]
//   }
// ]
// const menu = Menu.buildFromTemplate(menuTemplate)
// Menu.setApplicationMenu(menu)

function createWindow () {
  const win = new BrowserWindow({
    width: 1000,
    height: 668,
    // resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });
  log.info('主进程 - 第四步');
  startWatching(win);

  if (isDev) {
    // 开发阶段加载本地服务（HBuilderX 运行时）
    win.loadURL('http://localhost:9091');
    win.webContents.openDevTools();
  } else {
    // 打包阶段加载构建好的 H5 页面
    // const indexPath = path.join(__dirname, 'unpackage/dist/build/web/index.html');
    // win.loadFile(indexPath);
    // fs.writeFileSync('main-log.txt', '主进程启动成功');


    const indexPath = path.join(__dirname, 'unpackage/dist/build/web/index.html');
    if (fs.existsSync(indexPath)) {
      win.loadFile(indexPath);
      log.info('加载页面成功：' + indexPath);
    } else {
      log.error('❌ 页面文件不存在：' + indexPath);
      fs.writeFileSync('main-error.txt', '页面文件不存在：' + indexPath);
    }
  }

  globalShortcut.register('CommandOrControl+R', () => {
    console.log('刷新被禁用');
  });

  globalShortcut.register('F5', () => {
    console.log('F5刷新被禁用');
  });

  win.on('closed', () => {
    clearInterval(interval);
    interval = null;
  });
}

app.whenReady().then(() => {
  log.info('主进程 - 第三步');
  createWindow();
});
// app.on('window-all-closed', () => app.quit());
