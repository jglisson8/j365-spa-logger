function setupPwa() {
  if (typeof window === 'undefined' || !document.querySelector) return;
  // Install only the secure origin, where existing private sync and local records live.
  if (!location.hostname.endsWith('workers.dev') && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  const panel = document.createElement('section');
  panel.id = 'pwaStatus'; panel.className = 'help'; panel.setAttribute('aria-live', 'polite');
  panel.innerHTML = '<span id="pwaConnection"></span> <span id="pwaReady"></span><button type="button" class="secondary" id="pwaInstall" hidden>Install Spa Log</button><details id="pwaHelp"><summary>Install on your phone</summary><p>In Chrome on Android, open the menu and choose Add to home screen → Install. Use this secure address so your existing records and sync stay together.</p></details><p id="pwaUpdate" hidden>Update available. Finish and save your entry, then close all Spa Log windows and reopen. No reload will interrupt your work.</p>';
  document.querySelector('.status').after(panel);
  const connection = document.getElementById('pwaConnection'), ready = document.getElementById('pwaReady'), install = document.getElementById('pwaInstall');
  const online = () => { connection.textContent = navigator.onLine ? '' : 'Offline · entries save on this device; sync resumes when connected.'; };
  online(); window.addEventListener('offline', online);
  const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  const hideInstall = () => { install.hidden = true; document.getElementById('pwaHelp').hidden = !!standalone(); };
  let installPrompt = null;
  hideInstall();
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; if (!standalone()) install.hidden = false; });
  install.onclick = async () => { if (!installPrompt) return; const prompt = installPrompt; installPrompt = null; install.hidden = true; await prompt.prompt(); await prompt.userChoice; };
  window.addEventListener('appinstalled', () => { installPrompt = null; install.hidden = true; document.getElementById('pwaHelp').hidden = true; });
  if (!('serviceWorker' in navigator)) { ready.textContent = 'Offline startup unavailable in this browser.'; window.addEventListener('online', online); return; }
  let registration;
  const checkUpdate = () => registration?.update().catch(() => {});
  let reconnecting = false;
  window.addEventListener('online', async () => { online(); checkUpdate(); if (!reconnecting && typeof connect === 'function') { reconnecting = true; try { await connect(); } finally { reconnecting = false; } } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });
  navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' }).then(reg => {
    registration = reg;
    const waiting = () => { if (reg.waiting && reg.active) document.getElementById('pwaUpdate').hidden = false; };
    waiting();
    const watch = worker => worker?.addEventListener('statechange', () => { if (worker.state === 'installed') waiting(); if (worker.state === 'redundant' && !reg.active) ready.textContent = 'Offline startup not ready yet. Reopen online to retry.'; });
    watch(reg.installing); reg.addEventListener('updatefound', () => watch(reg.installing));
    navigator.serviceWorker.ready.then(() => { ready.textContent = 'Ready for offline startup on this device.'; });
  }).catch(() => { ready.textContent = 'Offline startup not ready yet. Reopen online to retry.'; });
  // Never call skipWaiting, clients.claim, reload or erase local records here.
}
