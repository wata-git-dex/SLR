// Controls belong to the review surface, never to the shipped app.
(() => {
  const root=document.documentElement;
  const toolbar=document.createElement('aside');
  toolbar.className='reviewToolbar';
  toolbar.setAttribute('aria-label','Design comparison');
  toolbar.innerHTML='<strong>SLR · Design review</strong><small>Current card layout · saved snapshot · no live writes</small>';
  document.body.prepend(toolbar);
  root.classList.add('weather-review');
  // Allow inspection of forms, but never authentication, refresh, photo or data writes.
  document.addEventListener('click',event=>{
    const action=event.target.closest('#refreshBtn,#asSubmit,#photoSave,#logSubmitBtn,#icSubmit');
    if(action){event.preventDefault();event.stopImmediatePropagation();toast('Design review — changes are not saved.');}
  },true);
  document.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();toast('Design review — changes are not saved.');},true);
})();
