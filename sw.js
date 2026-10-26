// SLR push worker. Deliberately does not cache app, API, authentication or drafts.
importScripts('/push/sw-runtime.js');
self.installSLRNotifications({version:'2.6.20',icon:'/slr-original-631039b0cf5b.png'});
