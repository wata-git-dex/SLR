// Shared mechanics, one existing service worker per app origin.
self.installSLRNotifications = function ({version,icon}) {
  const safeURL=value=>{try{const url=new URL(value,self.location.origin);return url.origin===self.location.origin&&url.pathname==='/'?url.href:self.location.origin+'/#notifications';}catch{return self.location.origin+'/#notifications';}};
  const badge=async count=>{try{if(Number.isSafeInteger(count)&&count>0)await self.navigator.setAppBadge?.(count);else if(count===0)await self.navigator.clearAppBadge?.();}catch{}};
  self.addEventListener('push',event=>event.waitUntil((async()=>{
    let data={};try{data=event.data?.json()||{};}catch{}
    // Payload never controls visible private text. Always display a user-visible alert.
    await self.registration.showNotification('Stoned Lab Rats',{
      body:data.category==='test'?'Your test notification has arrived.':data.category==='achievement'?'New achievement unlocked. Open the Lab to view your progress.':'Device notifications are enabled for your account.',
      icon,tag:typeof data.id==='string'?data.id.slice(0,150):'wata-update',
      data:{url:safeURL(data.url)}
    });
    await badge(data.unread);
    for(const client of await self.clients.matchAll({type:'window'}))client.postMessage({type:'SLR_NOTIFICATION'});
  })()));
  self.addEventListener('notificationclick',event=>{
    event.notification.close();const target=safeURL(event.notification.data?.url);
    event.waitUntil((async()=>{
      const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
      const existing=windows.find(client=>client.url===target);
      if(existing){await existing.focus();return;}
      // Do not navigate an existing editor away from its unsaved work.
      await self.clients.openWindow(target);
    })());
  });
  self.addEventListener('pushsubscriptionchange',event=>event.waitUntil((async()=>{
    // Server credentials never live in the SW; authenticated foreground reconciliation renews.
    for(const client of await self.clients.matchAll({type:'window'}))client.postMessage({type:'SLR_SUBSCRIPTION_CHANGED'});
  })()));
  self.addEventListener('message',event=>{
    if(event.data?.type==='SLR_VERSION')event.ports[0]?.postMessage({version,push:true});
    if(event.data?.type==='SLR_APPLY_UPDATE')event.waitUntil((async()=>{
      const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
      if(windows.length!==1||windows[0].id!==event.source?.id){event.ports[0]?.postMessage({ok:false,error:'Close other SLR tabs before applying this update.'});return;}
      event.ports[0]?.postMessage({ok:true});await self.skipWaiting();
    })());
  });
};
