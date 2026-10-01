// Controls belong to the review surface, never to the shipped app.
(() => {
  const root=document.documentElement;
  const toolbar=document.createElement('aside');
  toolbar.className='reviewToolbar';
  toolbar.setAttribute('aria-label','Design comparison');
  toolbar.innerHTML='<strong>SLR · Design review</strong><button id="reviewCurrent" aria-pressed="false">Original backgrounds</button><button id="reviewLayered" aria-pressed="true">New backgrounds</button><button id="reviewLight" aria-pressed="false">Light mode</button><small>Current card layout · saved snapshot · no live writes</small>';
  document.body.prepend(toolbar);
  root.classList.add('weather-review');
  function choose(updated){
    root.classList.toggle('weather-review',updated);
    document.getElementById('reviewCurrent').setAttribute('aria-pressed',String(!updated));
    document.getElementById('reviewLayered').setAttribute('aria-pressed',String(updated));
  }
  document.getElementById('reviewCurrent').onclick=()=>choose(false);
  document.getElementById('reviewLayered').onclick=()=>choose(true);
  const lightButton=document.getElementById('reviewLight');
  lightButton.setAttribute('aria-pressed',String(root.classList.contains('light-mode')));
  lightButton.onclick=event=>{
    const light=!root.classList.contains('light-mode');
    setColorMode(light?'light':'dark');
    event.currentTarget.setAttribute('aria-pressed',String(light));
  };
  // Allow inspection of forms, but never authentication, refresh, photo or data writes.
  document.addEventListener('click',event=>{
    const action=event.target.closest('#refreshBtn,#asSubmit,#photoSave,#logSubmitBtn,#icSubmit');
    if(action){event.preventDefault();event.stopImmediatePropagation();toast('Design review — changes are not saved.');}
  },true);
  document.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();toast('Design review — changes are not saved.');},true);
})();
