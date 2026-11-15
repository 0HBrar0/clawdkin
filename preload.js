const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('clawdkinApi', {
  // shared
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (partial) => ipcRenderer.send('set-config', partial),
  onConfig: (fn) => ipcRenderer.on('config', (_e, c) => fn(c)),
  meta: () => ipcRenderer.invoke('meta'),
  trigger: (tr) => ipcRenderer.send('trigger', tr),
  openClaude: () => ipcRenderer.send('open-claude'),
  openDiary: () => ipcRenderer.send('open-diary'),
  // buddy window
  onState: (fn) => ipcRenderer.on('state', (_e, s) => fn(s)),
  onCursor: (fn) => ipcRenderer.on('cursor', (_e, c) => fn(c)),
  onTrigger: (fn) => ipcRenderer.on('trigger', (_e, t) => fn(t)),
  setIgnore: (v) => ipcRenderer.send('set-ignore', v),
  dragStart: () => ipcRenderer.send('drag-start'),
  dragEnd: () => ipcRenderer.send('drag-end'),
  menu: () => ipcRenderer.send('menu'),
  openReply: () => ipcRenderer.send('open-reply'),
  fileDropped: (file) => { try { ipcRenderer.send('file-dropped', webUtils.getPathForFile(file)); } catch {} },
  // popup windows (settings, diary, reply)
  closeMe: () => ipcRenderer.send('close-me'),
  fitMe: (h) => ipcRenderer.send('fit-me', h),
  setLogin: (on) => ipcRenderer.send('set-login', on),
  getDiary: () => ipcRenderer.invoke('get-diary'),
  onDiary: (fn) => ipcRenderer.on('diary', (_e, d) => fn(d)),
  getAsk: () => ipcRenderer.invoke('get-ask'),
  answer: (ans) => ipcRenderer.send('answer', ans),
});
