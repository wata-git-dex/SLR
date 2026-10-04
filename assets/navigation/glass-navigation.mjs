/** Opt-in glass navigation. No routing, storage, network, or idle animation. */
export function releaseIndex(rects, x, y, cancelled = false) {
  if (cancelled) return -1;
  return rects.findIndex(r => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
}
const mounts = new WeakMap();
export function mountGlassNavigation(tray, {orientation = 'horizontal'} = {}) {
  if (!tray) return {destroy(){}};
  if (mounts.has(tray)) return mounts.get(tray);
  const buttons = () => [...tray.querySelectorAll('[data-wata-menu-nav]')];
  const selected = () => buttons().find(b => b.matches('[aria-current="page"],[aria-selected="true"],[aria-pressed="true"]'));
  const enabled = b => !b.disabled && b.getAttribute('aria-disabled') !== 'true';
  const lens = document.createElement('span');
  lens.className = 'wata-glass-lens'; lens.setAttribute('aria-hidden', 'true');
  tray.classList.add('wata-glass-nav'); tray.dataset.wataGlassHousing = ''; tray.dataset.wataMenuSurface = '';
  tray.prepend(lens);
  let drag = null, suppressClick = false;
  const reduced = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
  const glass = () => document.documentElement.dataset.wataMenuMaterial !== 'solid' && !matchMedia('(prefers-reduced-transparency:reduce),(prefers-contrast:more),(forced-colors:active)').matches;
  const box = b => {const r=b.getBoundingClientRect(), t=tray.getBoundingClientRect();return {x:r.left-t.left-tray.clientLeft,y:r.top-t.top-tray.clientTop,w:r.width,h:r.height}};
  const paint = (b, delta=0, held=false) => {
    if(!b){lens.hidden=true;return} lens.hidden=false;
    const r=box(b), vertical=orientation==='vertical', lift=held&&glass()&&!reduced();
    lens.style.width=`${r.w}px`; lens.style.height=`${r.h}px`;
    lens.style.transform=`translate(${r.x+(vertical?0:delta)}px,${r.y+(vertical?delta:0)}px) scale(${lift?1.04:1},${lift?1.06:1})`;
  };
  const sync = () => {if(!drag)paint(selected())};
  const clear = () => {tray.classList.remove('wata-glass-held');tray.style.removeProperty('--wata-rim-angle');for(const b of buttons())b.removeAttribute('data-wata-nav-preview')};
  const start = e => {
    const b=e.target.closest('[data-wata-menu-nav]');
    if(e.button!==0||e.isPrimary===false||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||!b||!tray.contains(b)||!enabled(b)||drag)return;
    suppressClick=false; drag={id:e.pointerId,button:b,start:orientation==='vertical'?e.clientY:e.clientX};
    tray.setPointerCapture(e.pointerId);tray.classList.toggle('wata-glass-held',glass());paint(b,0,true);
  };
  const move = e => {
    if(!drag||drag.id!==e.pointerId)return;
    const list=buttons(),vertical=orientation==='vertical', axis=vertical?'y':'x';
    const base=box(drag.button),first=box(list[0]),last=box(list.at(-1));
    const delta=(vertical?e.clientY:e.clientX)-drag.start;
    paint(drag.button,Math.max(first[axis]-base[axis],Math.min(last[axis]-base[axis],delta)),true);
    const target=releaseIndex(list.map(b=>b.getBoundingClientRect()),e.clientX,e.clientY);
    list.forEach((b,i)=>b.toggleAttribute('data-wata-nav-preview',i===target&&enabled(b)));
    if(!reduced())tray.style.setProperty('--wata-rim-angle',`${Math.max(-35,Math.min(35,delta/5))}deg`);
  };
  const finish = (e,cancelled=false) => {
    if(!drag||drag.id!==e.pointerId)return;
    drag=null;clear();suppressClick=true;
    if(tray.hasPointerCapture(e.pointerId))tray.releasePointerCapture(e.pointerId);
    const list=buttons(),i=releaseIndex(list.map(b=>b.getBoundingClientRect()),e.clientX,e.clientY,cancelled);
    if(i>=0&&enabled(list[i]))list[i].click(); // Existing host handler runs once, only on release.
    sync();
  };
  const up=e=>finish(e); const cancel=e=>finish(e,true);
  const key=e=>{if(e.key==='Escape'&&drag){const id=drag.id;drag=null;clear();suppressClick=true;if(tray.hasPointerCapture(id))tray.releasePointerCapture(id);sync();e.preventDefault()}};
  const lost=e=>{if(drag?.id===e.pointerId){drag=null;clear();sync()}};
  const click=e=>{if(suppressClick&&e.isTrusted&&e.detail!==0){suppressClick=false;e.preventDefault();e.stopImmediatePropagation()}};
  tray.addEventListener('pointerdown',start);tray.addEventListener('pointermove',move);
  tray.addEventListener('pointerup',up);tray.addEventListener('pointercancel',cancel);tray.addEventListener('lostpointercapture',lost);
  tray.addEventListener('click',click,true);
  tray.addEventListener('keydown',key);
  const resize=new ResizeObserver(sync);resize.observe(tray);
  const observe=new MutationObserver(sync);observe.observe(tray,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-current','aria-selected','aria-pressed']});
  const api={refresh:sync,destroy(){drag=null;clear();resize.disconnect();observe.disconnect();lens.remove();tray.classList.remove('wata-glass-nav');delete tray.dataset.wataGlassHousing;for(const [name,fn] of [['pointerdown',start],['pointermove',move],['pointerup',up],['pointercancel',cancel],['lostpointercapture',lost],['keydown',key]])tray.removeEventListener(name,fn);tray.removeEventListener('click',click,true);mounts.delete(tray)}};
  mounts.set(tray,api);sync();return api;
}
