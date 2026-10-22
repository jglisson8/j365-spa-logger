function setupPwa() {
  if (typeof window === 'undefined' || !document.querySelector) return;
  // Install only the secure origin, where existing private sync and local records live.
  if (!location.hostname.endsWith('workers.dev') && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  const panel = document.createElement('section');
  panel.id = 'pwaStatus'; panel.className = 'help'; panel.setAttribute('aria-live', 'polite');
  panel.innerHTML = '<span id="pwaConnection"></span> <span id="pwaReady"></span><button type="button" class="secondary" id="pwaInstall" hidden>Install Spa Log</button><details id="pwaHelp"><summary>Install on your phone</summary><p>In Chrome on Android, open the menu and choose Add to home screen → Install. Use this secure address so your existing records and sync stay together.</p></details><div id="pwaUpdate" hidden><button type="button" class="pwa-update-link" id="pwaUpdateNow">Update available — update now</button><span id="pwaUpdateText"></span></div>';
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
  const serviceUpdate=settings?document.createElement('button'):null;
  if(serviceUpdate){serviceUpdate.id='pwaServiceUpdate';serviceUpdate.type='button';serviceUpdate.className='pwa-update-link';serviceUpdate.textContent='Update available — update now';serviceUpdate.hidden=true;settings.append(serviceUpdate);serviceUpdate.onclick=()=>{updateButton.click();panel.scrollIntoView?.({behavior:'smooth',block:'center'});};}
  const style=document.createElement('style');style.textContent='.pwa-update-link{display:inline-block;background:transparent;border:0;color:#9fe5da;text-decoration:underline;text-underline-offset:3px;font:inherit;font-weight:650;min-height:44px;padding:8px 2px;text-align:left;cursor:pointer}.pwa-update-link:focus-visible{outline:2px solid #9fe5da;outline-offset:3px}.pwa-update-link:disabled{opacity:.6;cursor:wait}#pwaUpdateText:not(:empty){display:block;margin:4px 0}';document.head.append(style);
  const setBusy=value=>{updateButton.disabled=value;if(serviceUpdate)serviceUpdate.disabled=value;};
  const dirty=()=>typeof appHasUnsavedWork==='function'?appHasUnsavedWork():[...document.querySelectorAll('input,textarea,select')].some(e=>e.value!==e.defaultValue&&e.tagName!=='SELECT');
  const reloadSafely=()=>{if(dirty()){updateText.textContent='Update ready. Save or finish your unsaved work, then tap Update now.';setBusy(false);return;}if(!reloading){reloading=true;location.reload();}};
  updateButton.onclick=()=>{
    if(dirty()){updateText.textContent='Save or finish your unsaved work before updating. Nothing has been restarted.';return;}
    if(requestedWorker&&requestedWorker.state==='activated'){reloadSafely();return;}
    if(!registration?.waiting){updateText.textContent='Checking for an update…';checkUpdate();return;}
    requestedWorker=registration.waiting;setBusy(true);updateText.textContent='Applying update…';
    requestedWorker.postMessage({type:'J365_ACTIVATE_UPDATE'});
    clearTimeout(updateTimer);updateTimer=setTimeout(()=>{setBusy(false);updateText.textContent='Update has not restarted this window. Try again, or close other Spa Log windows.';},15000);
  };
  navigator.serviceWorker.addEventListener('message',e=>{if(!requestedWorker||e.source!==requestedWorker)return;if(e.data?.type==='J365_UPDATE_BLOCKED'){clearTimeout(updateTimer);setBusy(false);requestedWorker=null;updateText.textContent='Close other Spa Log windows or browser tabs, then tap Update now again.';}});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(requestedWorker){clearTimeout(updateTimer);reloadSafely();}});
  const checkUpdate = () => registration?.update().catch(() => {});
  let reconnecting = false;
  window.addEventListener('online', async () => { online(); checkUpdate(); if (!reconnecting && typeof connect === 'function') { reconnecting = true; try { await connect(); } finally { reconnecting = false; } } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });
  navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' }).then(reg => {
    registration = reg;
    const waiting = () => { if (reg.waiting && reg.active){document.getElementById('pwaUpdate').hidden = false;if(serviceUpdate)serviceUpdate.hidden=false;}refreshPanel(); };
    waiting();
    const watch = worker => worker?.addEventListener('statechange', () => { if (worker.state === 'installed') waiting(); if (worker.state === 'redundant' && !reg.active) ready.textContent = 'Offline startup not ready yet. Reopen online to retry.'; });
    watch(reg.installing); reg.addEventListener('updatefound', () => watch(reg.installing));
    navigator.serviceWorker.ready.then(() => { ready.textContent = 'Ready for offline startup on this device.'; });
  }).catch(() => { ready.textContent = 'Offline startup not ready yet. Reopen online to retry.'; });
  // No automatic activation/reload. User-requested activation is draft-checked,
  // and the worker additionally refuses while another app window is open.
}
