function setupPwa() {
  if (typeof window === 'undefined' || !document.querySelector) return;
  // Install only the secure origin, where existing private sync and local records live.
  if (!location.hostname.endsWith('workers.dev') && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  const panel = document.createElement('section');
  panel.id = 'pwaStatus'; panel.className = 'help'; panel.setAttribute('aria-live', 'polite');
  panel.innerHTML = '<span id="pwaConnection"></span> <span id="pwaReady"></span><button type="button" class="secondary" id="pwaInstall" hidden>Install Spa Log</button><details id="pwaHelp"><summary>Install on your phone</summary><p>In Chrome on Android, open the menu and choose Add to home screen → Install. Use this secure address so your existing records and sync stay together.</p></details><div id="pwaUpdate" hidden><span id="pwaUpdateText">Update available.</span> <button type="button" class="secondary" id="pwaUpdateNow">Update now</button></div>';
  document.querySelector('.status').after(panel);
  const connection = document.getElementById('pwaConnection'), ready = document.getElementById('pwaReady'), install = document.getElementById('pwaInstall');
  const settings=document.getElementById('appConnectionSettings');if(settings){const line=document.createElement('p');line.append(ready);settings.append(line);}
  const refreshPanel=()=>{panel.hidden=!!settings&&!connection.textContent&&install.hidden&&document.getElementById('pwaUpdate').hidden;};
  const online = () => { connection.textContent = navigator.onLine ? '' : 'Offline · entries save on this device; sync resumes when connected.';refreshPanel(); };
  online(); window.addEventListener('offline', online);
  const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  const hideInstall = () => { install.hidden = true; document.getElementById('pwaHelp').hidden = !!standalone();refreshPanel(); };
  let installPrompt = null;
  hideInstall();
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; if (!standalone()) install.hidden = false;refreshPanel(); });
  install.onclick = async () => { if (!installPrompt) return; const prompt = installPrompt; installPrompt = null; install.hidden = true; await prompt.prompt(); await prompt.userChoice; };
  window.addEventListener('appinstalled', () => { installPrompt = null; install.hidden = true; document.getElementById('pwaHelp').hidden = true; });
  if (!('serviceWorker' in navigator)) { ready.textContent = 'Offline startup unavailable in this browser.'; window.addEventListener('online', online); return; }
  let registration,requestedWorker=null,reloading=false,updateTimer;
  const updateButton=document.getElementById('pwaUpdateNow'),updateText=document.getElementById('pwaUpdateText');
  const dirty=()=>typeof appHasUnsavedWork==='function'?appHasUnsavedWork():[...document.querySelectorAll('input,textarea,select')].some(e=>e.value!==e.defaultValue&&e.tagName!=='SELECT');
  const reloadSafely=()=>{if(dirty()){updateText.textContent='Update ready. Save or finish your unsaved work, then tap Update now.';updateButton.disabled=false;return;}if(!reloading){reloading=true;location.reload();}};
  updateButton.onclick=()=>{
    if(dirty()){updateText.textContent='Save or finish your unsaved work before updating. Nothing has been restarted.';return;}
    if(requestedWorker&&requestedWorker.state==='activated'){reloadSafely();return;}
    if(!registration?.waiting){updateText.textContent='Checking for an update…';checkUpdate();return;}
    requestedWorker=registration.waiting;updateButton.disabled=true;updateText.textContent='Applying update…';
    requestedWorker.postMessage({type:'J365_ACTIVATE_UPDATE'});
    clearTimeout(updateTimer);updateTimer=setTimeout(()=>{updateButton.disabled=false;updateText.textContent='Update has not restarted this window. Try again, or close other Spa Log windows.';},15000);
  };
  navigator.serviceWorker.addEventListener('message',e=>{if(!requestedWorker||e.source!==requestedWorker)return;if(e.data?.type==='J365_UPDATE_BLOCKED'){clearTimeout(updateTimer);updateButton.disabled=false;requestedWorker=null;updateText.textContent='Close other Spa Log windows or browser tabs, then tap Update now again.';}});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(requestedWorker){clearTimeout(updateTimer);reloadSafely();}});
  const checkUpdate = () => registration?.update().catch(() => {});
  let reconnecting = false;
  window.addEventListener('online', async () => { online(); checkUpdate(); if (!reconnecting && typeof connect === 'function') { reconnecting = true; try { await connect(); } finally { reconnecting = false; } } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });
  navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' }).then(reg => {
    registration = reg;
    const waiting = () => { if (reg.waiting && reg.active) document.getElementById('pwaUpdate').hidden = false;refreshPanel(); };
    waiting();
    const watch = worker => worker?.addEventListener('statechange', () => { if (worker.state === 'installed') waiting(); if (worker.state === 'redundant' && !reg.active) ready.textContent = 'Offline startup not ready yet. Reopen online to retry.'; });
    watch(reg.installing); reg.addEventListener('updatefound', () => watch(reg.installing));
    navigator.serviceWorker.ready.then(() => { ready.textContent = 'Ready for offline startup on this device.'; });
  }).catch(() => { ready.textContent = 'Offline startup not ready yet. Reopen online to retry.'; });
  // No automatic activation/reload. User-requested activation is draft-checked,
  // and the worker additionally refuses while another app window is open.
}
