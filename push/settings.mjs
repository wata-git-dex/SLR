import {NotificationClient,installationRequired,workerMessage,badge} from './client.mjs';
import {checkAppUpdate,applyAppUpdate} from './updates.mjs';
const host=window.SLRPushHost;
const root=document.getElementById('slrPush'),updates=document.getElementById('slrUpdates');
const status=document.getElementById('pushStatus'),updateStatus=document.getElementById('pushUpdateStatus');
const get=id=>document.getElementById(id);
let registrationPromise,client,identity='',busy=false,lastRead=0,applying=false,reg,updateBusy=false,updateAvailable=false;
const supported=()=>isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
function say(text){status.textContent=text;}
function showUpdate(text){updateStatus.textContent=text;}
async function registration(){
  if(!isSecureContext||!('serviceWorker' in navigator))throw Error('App updates are unavailable in this browser.');
  registrationPromise ||= navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(error=>{registrationPromise=null;throw error;});
  reg=await registrationPromise;
  if(!reg.slrWatching){
    reg.slrWatching=true;
    reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&reg.waiting)updateReady();});});
  }
  return reg;
}
export async function request(action,data,code=host.code()){
  if(!code)throw Error('Enter your invite code first.');
  const response=await fetch(host.api+'/notifications/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,data}),cache:'no-store',credentials:'omit'});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Notification request failed.');return result;
}
const make=(tag,text)=>{const element=document.createElement(tag);if(text)element.textContent=text;return element;};
function button(label,fn,icon=false){const b=make('button',icon?'✓':label);b.className=icon?'slrPushQuiet slrPushIcon':'slrPushQuiet';if(icon){b.setAttribute('aria-label',label);b.title=label;}b.type='button';b.disabled=busy;b.addEventListener('click',()=>run(fn));return b;}
function preferenceRows(parent,device,deviceLabel='this device'){
  for(const [key,label]of [['achievement_enabled','Achievements'],['account_enabled','Device alerts']]){
    const wrap=make('label'),toggle=make('input');wrap.className='slrPushSetting';toggle.type='checkbox';toggle.setAttribute('role','switch');toggle.setAttribute('aria-label',`${label}, ${deviceLabel}`);toggle.checked=Boolean(device[key]);toggle.disabled=busy;wrap.append(make('span',label),toggle);
    toggle.addEventListener('change',()=>{const checked=toggle.checked;void run(async()=>{const values={account:Boolean(device.account_enabled),achievements:Boolean(device.achievement_enabled)};values[key==='account_enabled'?'account':'achievements']=checked;await request('preferences',{id:device.id,...values});await refresh(true);});});parent.append(wrap);
  }
}
function render(){
  const state=client?.state;if(!state)return;
  get('pushCount').textContent=state.unread?` · ${state.unread} unread`:'';
  const current=state.devices.find(device=>device.id===client.deviceId);
  const needsInstall=installationRequired();
  get('pushPermission').textContent=needsInstall?'Open SLR from its Home Screen icon to enable alerts.':globalThis.Notification?.permission==='denied'?'Allow notifications in your device settings to turn these on.':current?'Notifications are on.':'Get notified about new achievements.';
  get('pushEnabled').checked=Boolean(current);get('pushEnabled').disabled=busy||needsInstall||!supported();
  const currentPanel=get('pushCurrent');currentPanel.replaceChildren();if(current)preferenceRows(currentPanel,current);
  const devices=get('pushDevices');devices.replaceChildren();
  const others=state.devices.filter(device=>device.id!==client.deviceId);get('pushOther').hidden=!others.length;get('pushDeviceCount').textContent=` · ${others.length}`;
  others.forEach((device,index)=>{
    const row=make('div');row.className='slrPushDevice';const head=make('div');head.className='slrPushDeviceHead';head.append(make('b',`Device ${index+1}`),button('Remove',async()=>{await request('remove-device',{id:device.id});await refresh(true);}));row.append(head);preferenceRows(row,device,`device ${index+1}`);devices.append(row);
  });
  const events=get('pushEvents');events.replaceChildren();
  if(!state.events.length)events.append(make('p','Your new achievements will appear here.'));
  state.events.forEach(event=>{
    const row=make('div');row.className='slrPushRow';if(event.read_at===null)row.dataset.unread='';
    const label=make('span',event.category==='achievement'?'New achievement':event.category==='test'?'Test notification':'Device enabled');const time=make('time',new Date(event.created).toLocaleString());time.dateTime=event.created;label.append(time);row.append(label);
    const read=async()=>{await request('read',{ids:[event.id]});await refresh(true);};
    if(event.category==='achievement')row.append(button('View',async()=>{await read();host.profile();}));
    else if(event.read_at===null)row.append(button('Mark read',read,true));events.append(row);
  });
  get('pushRead').disabled=busy||!state.events.some(event=>event.read_at===null);
  get('pushRefresh').disabled=busy;get('pushTest').hidden=!current;get('pushTest').disabled=busy||!current;
}
async function refresh(force=false){
  if(!identity||!navigator.onLine||document.hidden)return;
  if(!force&&Date.now()-lastRead<30000)return;
  const c=client;const state=await c.refresh();if(c!==client||!state)return;lastRead=Date.now();render();
}
async function run(action){
  if(busy)return;busy=true;const owner=identity;say('');render();
  try{await action();}catch(error){if(owner===identity)say(error.message);}finally{busy=false;render();}
}
function updateReady(){updateAvailable=true;get('pushApply').hidden=false;showUpdate('Update ready. Save your work before updating.');}
async function authenticated(member){
  if(member!==identity){client?.reset();identity=member;lastRead=0;say('');client=new NotificationClient({identity:()=>identity,request,registration});}
  root.hidden=!identity;updates.hidden=!identity;get('pushVersion').textContent=`App ${host.version}`;
  if(!identity)return;
  // App updates do not depend on notification permission or push support.
  try{await registration();if(reg.waiting)updateReady();}catch(error){showUpdate(error.message);}
  if(!supported()){say('Device notifications are unavailable in this browser.');get('pushPermission').textContent='Try SLR on a supported device.';return;}
  try{await refresh();if(client?.state){await client.reconcileDevice();render();}}catch(error){say(error.message);}
  if(location.hash==='#notifications'){host.openSettings();root.open=true;root.scrollIntoView({block:'start'});}
}
async function signOut(code){
  identity='';client?.reset();client=null;root.hidden=true;updates.hidden=true;await badge(0);
  try{const r=await registration(),sub=await r.pushManager.getSubscription();if(sub){const endpoint=sub.endpoint;await sub.unsubscribe();await request('unsubscribe',{endpoint},code);}}catch{/* No credentials are saved in the worker. Revoked invites are checked at dispatch. */}
  try{localStorage.removeItem('slr.push.device.v1');}catch{}
}
get('pushEnabled').addEventListener('change',()=>{const enabled=get('pushEnabled').checked;void run(async()=>{if(enabled)await client.enable();else await client.disable();});});
get('pushTest').addEventListener('click',()=>run(async()=>{await request('test',{});await refresh(true);say('Test queued. Check your device notifications.');}));
get('pushRead').addEventListener('click',()=>run(async()=>{await request('read',{ids:client.state.events.filter(e=>e.read_at===null).map(e=>e.id)});await refresh(true);}));
get('pushRefresh').addEventListener('click',()=>run(()=>refresh(true)));
async function runUpdate(action){
  if(updateBusy)return;updateBusy=true;get('pushCheck').disabled=true;get('pushApply').disabled=true;
  try{await action();}catch(error){showUpdate(error.message);}finally{updateBusy=false;get('pushCheck').disabled=false;get('pushApply').disabled=false;}
}
get('pushCheck').addEventListener('click',()=>runUpdate(async()=>{
  showUpdate('Checking for updates…');
  const result=await checkAppUpdate(await registration(),host.version);
  updateAvailable=result.available;get('pushApply').hidden=!result.available;
  showUpdate(result.available?`Update ready (${result.version}). Save your work before updating.`:`You’re up to date (${host.version}).`);
}));
get('pushApply').addEventListener('click',()=>runUpdate(async()=>{
  showUpdate('Applying update…');applying=true;
  try{await applyAppUpdate({registration:await registration(),safeToUpdate:host.safeToUpdate,available:updateAvailable,send:workerMessage,reload:()=>location.reload(),serviceWorker:navigator.serviceWorker});}
  finally{applying=false;}
}));
root.addEventListener('toggle',()=>{if(root.open)void run(()=>refresh(true));});
if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('message',event=>{if(['SLR_NOTIFICATION','SLR_SUBSCRIPTION_CHANGED'].includes(event.data?.type))void run(()=>refresh(true));});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void run(()=>refresh());});
window.addEventListener('online',()=>void run(()=>refresh(true)));
// An explicit update freezes editing until takeover; errors restore interaction.
document.addEventListener('click',event=>{if(applying){event.preventDefault();event.stopImmediatePropagation();}},true);
document.addEventListener('keydown',event=>{if(applying){event.preventDefault();event.stopImmediatePropagation();}},true);
window.SLRPush={authenticated,signOut};
if(host.member())void authenticated(host.member());
