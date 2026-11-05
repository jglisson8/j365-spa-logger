// Keyboard layout only. Never stage, submit, save, convert or reset field values.
function mobileEditableField(node){return !!node?.matches?.('textarea,input:not([type]),input[type="text"],input[type="number"],input[type="email"],input[type="tel"],input[type="url"],input[type="search"],input[type="password"]')&&!node.disabled&&!node.readOnly}
function setupMobileInput(){
 if(typeof window==='undefined'||!document.body)return;
 const touch=()=>navigator.maxTouchPoints>0||window.matchMedia?.('(pointer: coarse)')?.matches,
  viewport=window.visualViewport,style=document.createElement('style');
 style.textContent=`
body.app-ui.keyboard-open .tabs,body.app-ui.keyboard-open .save-bar,body.app-ui.keyboard-open .toast,body.app-ui.keyboard-open #appSaveNotice{display:none!important}
body.app-ui.keyboard-open input,body.app-ui.keyboard-open textarea{scroll-margin-top:12px;scroll-margin-bottom:58px}
@media(pointer:coarse){body.app-ui input,body.app-ui textarea,body.app-ui select{font-size:16px}}
#mobileInputBar{position:fixed;left:50%;transform:translateX(-50%);width:min(100%,720px);box-sizing:border-box;z-index:2000;display:flex;align-items:center;gap:6px;padding:4px 10px;background:#142d39;border-top:1px solid #41636b;box-shadow:0 -3px 14px #0003}
#mobileInputBar[hidden]{display:none!important}#mobileInputBar button{flex:none;width:auto;min-height:40px;margin:0;padding:6px 12px;font-size:14px;border-radius:8px}#mobileInputBar button:disabled{opacity:.35}#mobileInputLabel{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:#aac4ce;font-size:12px}
@media(prefers-reduced-motion:reduce){#mobileInputBar{scroll-behavior:auto}}
`;
 document.head.append(style);
 const bar=document.createElement('div');bar.id='mobileInputBar';bar.hidden=true;bar.setAttribute('role','group');bar.setAttribute('aria-label','Field controls');bar.innerHTML='<button type="button" id="mobileInputPrevious" aria-label="Previous field">‹</button><button type="button" id="mobileInputNext" aria-label="Next field">Next</button><span id="mobileInputLabel"></span><button type="button" id="mobileInputDone">Done</button>';document.body.append(bar);
 let field=null,fullHeight=window.innerHeight,lastWidth=window.innerWidth,frame=null;
 const visible=node=>mobileEditableField(node)&&node.isConnected&&!node.closest('[hidden],[inert]')&&node.getClientRects().length>0,
  fields=()=>{const scope=field?.closest('form')||field?.closest('dialog[open]')||field?.closest('.tab')||document.body;return [...scope.querySelectorAll('input,textarea')].filter(visible)},
  configure=node=>{if(!mobileEditableField(node))return;if(node.type==='number'&&!node.hasAttribute('inputmode'))node.inputMode=(node.getAttribute('step')||'1')==='1'?'numeric':'decimal';if(node.tagName!=='TEXTAREA'&&!node.hasAttribute('enterkeyhint'))node.enterKeyHint='next'};
 const scan=node=>{if(node.nodeType!==1)return;configure(node);node.querySelectorAll('input,textarea').forEach(configure)};scan(document.body);
 new MutationObserver(records=>{for(const r of records)for(const node of r.addedNodes)scan(node)}).observe(document.body,{subtree:true,childList:true});
 function update(){
  frame=null;
  if(window.innerWidth!==lastWidth){fullHeight=Math.max(window.innerHeight,lastWidth);lastWidth=window.innerWidth}
  fullHeight=Math.max(fullHeight,window.innerHeight,viewport?.height??0);
  const active=document.activeElement;if(mobileEditableField(active))field=active;else if(!bar.contains(active))field=null;
  const open=!!(touch()&&visible(field)&&(viewport?.scale??1)<=1.05&&fullHeight-(viewport?.height??window.innerHeight)>Math.max(120,fullHeight*.18));
  document.body.classList.toggle('keyboard-open',open);bar.hidden=!open;
  if(!open)return;
  const host=field.closest('dialog[open]')||document.body;if(bar.parentElement!==host)host.append(bar);
  const bottom=Math.max(0,window.innerHeight-(viewport?.height??window.innerHeight)-(viewport?.offsetTop??0));bar.style.bottom=bottom+'px';
  const list=fields(),index=list.indexOf(field);$('mobileInputPrevious').disabled=index<=0;$('mobileInputNext').disabled=index<0||index===list.length-1;
  $('mobileInputLabel').textContent=(field.labels?.[0]?.textContent||(field.previousElementSibling?.tagName==='LABEL'?field.previousElementSibling.textContent:'')||field.getAttribute('aria-label')||field.placeholder||'').trim();
  if(field.tagName!=='TEXTAREA')field.enterKeyHint=index===list.length-1?'done':'next';
  // Scroll only when obscured, by the minimum amount. Do not recenter on every
  // viewport event or restore an old scroll position after the keyboard closes.
  const box=field.getBoundingClientRect(),top=(viewport?.offsetTop??0)+12,end=(viewport?.offsetTop??0)+(viewport?.height??window.innerHeight)-(bar.getBoundingClientRect().height||48)-12,
   delta=box.height>end-top?box.top-top:box.bottom>end?box.bottom-end:box.top<top?box.top-top:0;
  if(Math.abs(delta)>1){const dialog=field.closest('dialog[open]');if(dialog)dialog.scrollTop+=delta;else window.scrollBy?.({top:delta,behavior:'instant'})}
 }
 function schedule(){if(frame==null)frame=window.requestAnimationFrame?window.requestAnimationFrame(update):window.setTimeout(update,0)}
 function done(){field?.blur();if(bar.contains(document.activeElement))document.activeElement.blur();field=null;document.body.classList.remove('keyboard-open');bar.hidden=true}
 function move(direction){const list=fields(),next=list[list.indexOf(field)+direction];if(next){next.focus({preventScroll:true});field=next;schedule()}else done()}
 bar.addEventListener('pointerdown',e=>{if(e.target.closest('button'))e.preventDefault()});
 $('mobileInputPrevious').onclick=()=>move(-1);$('mobileInputNext').onclick=()=>move(1);$('mobileInputDone').onclick=done;
 document.addEventListener('focusin',e=>{if(mobileEditableField(e.target)){field=e.target;configure(field);schedule()}});
 document.addEventListener('focusout',()=>window.setTimeout(schedule,0));
 document.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing&&touch()&&mobileEditableField(e.target)&&e.target.tagName!=='TEXTAREA'){e.preventDefault();field=e.target;move(1)}});
 window.addEventListener('resize',schedule);viewport?.addEventListener('resize',schedule);viewport?.addEventListener('scroll',schedule);
}
