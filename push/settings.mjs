import {NotificationClient,installationRequired,workerMessage,badge} from './client.mjs';
const host=window.SLRPushHost;
const root=document.getElementById('slrPush');
const status=document.getElementById('pushStatus');
let registrationPromise,client,identity='',busy=false,lastRead=0,applying=false,reg;
const supported=()=>isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
function say(text){status.textContent=text;}
async function registration(){
  if(!supported())throw Error('Device notifications are unavailable in this browser.');
  registrationPromise ||= navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(error=>{registrationPromise=null;throw error;});
  reg=await registrationPromise;if(!reg.slrWatching){reg.slrWatching=true;reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'){void version();if(reg.waiting)say('Update ready. Save work and close other SLR windows before applying.');}});});}return reg;
}
export async function request(action,data,code=host.code()){
  if(!code)throw Error('Enter your invite code first.');
  const response=await fetch(host.api+'/notifications/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,data}),cache:'no-store',credentials:'omit'});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Notification request failed.');return result;
}
const make=(tag,text)=>{const element=document.createElement(tag);if(text)element.textContent=text;return element;};
const icons={bell:'M18 8a6 6 0 0 0-12 0v5l-2 3h16l-2-3V8M9 20h6',send:'m3 3 18 9-18 9 4-9-4-9Zm4 9h14',check:'m4 12 5 5L20 6',refresh:'M20 7a8 8 0 1 0 0 10M20 3v5h-5',close:'m6 6 12 12M6 18 18 6',view:'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 21v-2a8 8 0 0 1 16 0v2'};
function decorate(b){const label=b.textContent;const key=label.includes('test')?'send':label.includes('read')?'check':label.includes('update')||label.includes('Refresh')?'refresh':label==='Remove'?'close':label==='View'?'view':'bell';const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',icons[key]);svg.append(path);b.prepend(svg);return b;}
function button(label,fn){const b=decorate(make('button',label));b.type='button';b.addEventListener('click',()=>run(fn));return b;}
function render(){
  const state=client?.state;if(!state)return;
  document.getElementById('pushCount').textContent=state.unread?` · ${state.unread} unread`:'';
  document.getElementById('pushPermission').textContent=installationRequired()?'On iPhone: Safari → Share → Add to Home Screen. Open SLR from that icon to enable notifications.':`Device permission: ${Notification.permission}. ${state.devices.length} registered device${state.devices.length===1?'':'s'}.`;
  const devices=document.getElementById('pushDevices');devices.replaceChildren();
  state.devices.forEach((device,index)=>{
    const row=make('div');row.className='slrPushRow';row.append(make('span',device.id===client.deviceId?'This device':`Device ${index+1}`));
    for(const [key,label]of [['achievement_enabled','Achievements'],['account_enabled','Device alerts']]){
      const wrap=make('label'),toggle=make('input');toggle.type='checkbox';toggle.checked=Boolean(device[key]);toggle.setAttribute('aria-label',`${label}, device ${index+1}`);wrap.append(toggle,document.createTextNode(label));
      toggle.addEventListener('change',()=>run(async()=>{const values={account:Boolean(device.account_enabled),achievements:Boolean(device.achievement_enabled)};values[key==='account_enabled'?'account':'achievements']=toggle.checked;await request('preferences',{id:device.id,...values});await refresh(true);}));row.append(wrap);
    }
    row.append(button('Remove',async()=>{if(device.id===client.deviceId)await client.disable();else await request('remove-device',{id:device.id});await refresh(true);}));devices.append(row);
  });
  const events=document.getElementById('pushEvents');events.replaceChildren();
  if(!state.events.length)events.append(make('p','New achievements and device alerts will appear here.'));
  state.events.forEach(event=>{
    const row=make('div');row.className='slrPushRow';const label=make('span',event.category==='achievement'?'New achievement':event.category==='test'?'Test notification':'Device enabled');const time=make('time',new Date(event.created).toLocaleString());label.append(time);row.append(label);
    if(event.category==='achievement')row.append(button('View',async()=>{await request('read',{ids:[event.id]});await refresh(true);host.profile();}));
    if(event.read_at===null)row.append(button('Mark read',async()=>{await request('read',{ids:[event.id]});await refresh(true);}));events.append(row);
  });
  document.getElementById('pushEnable').disabled=busy||installationRequired();
  document.getElementById('pushTest').disabled=busy||!state.devices.length;
  document.getElementById('pushDisable').disabled=busy||!client.deviceId;
}
async function refresh(force=false){
  if(!identity||!navigator.onLine||document.hidden)return;
  if(!force&&Date.now()-lastRead<30000)return;
  const c=client;const state=await c.refresh();if(c!==client||!state)return;lastRead=Date.now();render();
}
async function run(action){
  if(busy)return;busy=true;
  try{say('Working…');await action();if(status.textContent==='Working…')say('Updated.');}catch(error){say(error.message);}finally{busy=false;render();}
}
async function authenticated(member){
  if(member!==identity){client?.reset();identity=member;lastRead=0;client=new NotificationClient({identity:()=>identity,request,registration});}
  root.hidden=!identity;if(!identity||!supported()){say('Device notifications are unavailable in this browser.');return;}
  try{await registration();await refresh();if(client?.state){await client.reconcileDevice();render();}await version();}catch(error){say(error.message);}
  if(location.hash==='#notifications'){host.openSettings();root.open=true;root.scrollIntoView({block:'start'});}
}
async function version(){
  const r=await registration();if(!r.active)return;
  const value=await workerMessage(r.active,{type:'SLR_VERSION'});document.getElementById('pushVersion').textContent=`App ${host.version} · Worker ${value.version}`;
  document.getElementById('pushApply').disabled=!r.waiting;
}
async function signOut(code){
  const old=client;identity='';client?.reset();client=null;root.hidden=true;await badge(0);
  try{const r=await registration(),sub=await r.pushManager.getSubscription();if(sub){const endpoint=sub.endpoint;await sub.unsubscribe();await request('unsubscribe',{endpoint},code);}}catch{/* No credentials are saved in the worker. Revoked invites are checked at dispatch. */}
  try{localStorage.removeItem('slr.push.device.v1');}catch{}
}
document.getElementById('pushEnable').addEventListener('click',()=>run(async()=>{await client.enable();render();}));
document.getElementById('pushDisable').addEventListener('click',()=>run(async()=>{await client.disable();render();}));
document.getElementById('pushTest').addEventListener('click',()=>run(async()=>{await request('test',{});await refresh(true);say('Test queued. Close SLR and check your device notifications.');}));
document.getElementById('pushRead').addEventListener('click',()=>run(async()=>{await request('read',{ids:client.state.events.filter(e=>e.read_at===null).map(e=>e.id)});await refresh(true);}));
document.getElementById('pushRefresh').addEventListener('click',()=>run(()=>refresh(true)));
document.getElementById('pushCheck').addEventListener('click',()=>run(async()=>{const r=await registration();await r.update();await version();say(r.waiting?'Update ready. Save work and close other SLR windows before applying.':'No waiting update.');}));
document.getElementById('pushApply').addEventListener('click',()=>run(async()=>{
  if(!host.safeToUpdate())throw Error('Save or close your open form, upload or Lab view before updating.');
  const r=await registration();if(!r.waiting)throw Error('No update is waiting.');
  applying=true;try{const result=await workerMessage(r.waiting,{type:'SLR_APPLY_UPDATE'});if(!result.ok)throw Error(result.error);if(!navigator.serviceWorker.controller&&host.safeToUpdate())location.reload();}catch(error){applying=false;throw error;}
}));
root.querySelectorAll('button').forEach(decorate);
root.addEventListener('toggle',()=>{if(root.open)void run(()=>refresh(true));});
if('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('message',event=>{if(['SLR_NOTIFICATION','SLR_SUBSCRIPTION_CHANGED'].includes(event.data?.type))void run(()=>refresh(true));});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(applying&&host.safeToUpdate())location.reload();});
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void run(()=>refresh());});
window.addEventListener('online',()=>void run(()=>refresh(true)));
// An explicit update freezes editing until takeover; it never clears local data.
document.addEventListener('click',event=>{if(applying){event.preventDefault();event.stopImmediatePropagation();}},true);
document.addEventListener('keydown',event=>{if(applying){event.preventDefault();event.stopImmediatePropagation();}},true);
window.SLRPush={authenticated,signOut};
if(host.member())void authenticated(host.member());
