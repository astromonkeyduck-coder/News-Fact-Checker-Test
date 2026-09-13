(() => {
 'use strict';
 const M=window.PublicationModel;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const preview=document.body.dataset.preview==='true';
 const date=document.querySelector('#edition-date'); if(date) date.textContent=new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'America/New_York'});
 const menu=document.querySelector('.menu-toggle'),nav=document.querySelector('#primary-nav');
 menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('menu-open',open);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu?.getAttribute('aria-expanded')==='true'){menu.setAttribute('aria-expanded','false');nav.classList.remove('menu-open');menu.focus();}});
 document.querySelector('[data-retry]')?.addEventListener('click',()=>location.reload());
 document.querySelectorAll('video').forEach(v=>v.addEventListener('play',()=>document.querySelectorAll('video').forEach(other=>{if(other!==v) other.pause();})));
 document.addEventListener('error',event=>{const img=event.target;if(!(img instanceof HTMLImageElement))return;const wrapper=img.closest('.story-image');if(wrapper){wrapper.classList.add('image-unavailable');wrapper.innerHTML='<span>Image unavailable</span>';}else{img.hidden=true;const caption=img.parentElement.querySelector('figcaption');if(caption)caption.textContent+=' Image unavailable; see the original source.';}},true);
 const canonical=document.querySelector('link[rel=canonical]')?.href||location.href;
 async function copy(){try{await navigator.clipboard.writeText(canonical);document.querySelector('#share-status').textContent='Link copied.';}catch{document.querySelector('#share-status').innerHTML=`Copy this link: <a href="${esc(canonical)}">${esc(canonical)}</a>`;}}
 document.querySelector('[data-copy]')?.addEventListener('click',copy);
 document.querySelector('[data-share]')?.addEventListener('click',async()=>{if(navigator.share){try{await navigator.share({title:document.title,url:canonical});}catch(e){if(e.name!=='AbortError')copy();}}else copy();});
 const listen=document.querySelector('[data-listen]');
 if(listen){
  const listenStatus=document.querySelector('#listen-status');
  const speakerIcon='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9.5 9.5 0 0 1 0 13"/></svg>';
  const pauseIcon='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M9 5v14"/><path d="M15 5v14"/></svg>';
  let narration=null,loadingAudio=false;
  const setLabel=(icon,text)=>{listen.innerHTML=icon+' '+text;};
  document.querySelectorAll('video').forEach(v=>v.addEventListener('play',()=>narration?.pause()));
  listen.addEventListener('click',async()=>{
   if(preview){listenStatus.textContent='AI narration is disabled in this local preview.';return;}
   if(loadingAudio)return;
   if(narration){narration.paused?narration.play():narration.pause();return;}
   loadingAudio=true;listen.disabled=true;setLabel(speakerIcon,'Preparing audio…');
   try{
    const response=await fetch('/.netlify/functions/elevenlabs-tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:listen.dataset.listen})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.audio)throw Error();
    narration=new Audio('data:audio/mpeg;base64,'+data.audio);
    narration.addEventListener('play',()=>{setLabel(pauseIcon,'Pause');listen.setAttribute('aria-pressed','true');listenStatus.textContent='AI-generated narration.';document.querySelectorAll('video').forEach(v=>v.pause());});
    narration.addEventListener('pause',()=>{if(!narration.ended){setLabel(speakerIcon,'Resume');listen.setAttribute('aria-pressed','false');}});
    narration.addEventListener('ended',()=>{setLabel(speakerIcon,'Listen again');listen.setAttribute('aria-pressed','false');narration.currentTime=0;});
    await narration.play();
   }catch{listenStatus.textContent='Audio narration is unavailable right now.';setLabel(speakerIcon,'Listen');}
   finally{loadingAudio=false;listen.disabled=false;}
  });
 }
 const form=document.querySelector('#archive-filters');
 if(form){
  const posts=M.prepare(JSON.parse(document.querySelector('#publication-posts').textContent));
  const params=new URLSearchParams(location.search); let page=Math.max(1,parseInt(params.get('page'))||1);
  function readUrl(){const q=new URLSearchParams(location.search);for(const name of ['q','category','format','sort']){const f=form.elements[name];if(f) f.value=q.get(name)||(name==='sort'?'newest':'');}form.elements.alerts.checked=q.get('alerts')==='1';page=Math.max(1,parseInt(q.get('page'))||1);}
  function render(updateUrl=true){const state=Object.fromEntries(new FormData(form));state.page=page; const result=M.filter(posts,state);const grid=document.querySelector('#archive-results');
   document.querySelector('#result-count').textContent=`Showing ${result.shown.length} of ${result.total} matching stories`;
   grid.innerHTML=result.shown.length?result.shown.map(p=>{const img=p.media.type==='video'?p.media.poster:p.media.url;const date=p.published&&Number.isFinite(Date.parse(p.published))?new Date(p.published).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York',timeZoneName:'short'}):'Publication time unavailable';return `<article class="story">${img?`<a class="story-image" href="${esc(p.href)}" tabindex="-1" aria-hidden="true"><img src="${esc(img)}" alt="" width="800" height="500" loading="lazy">${p.format==='video'?'<span class="video-label">▶ Video</span>':''}</a>`:''}<div class="eyebrow">${esc(p.category)}</div><h3><a href="${esc(p.href)}">${esc(p.title)}</a></h3><div class="metadata"><time>${esc(date)}</time><span>${esc(p.type)}</span></div></article>`;}).join(''):'<div class="empty-state"><h2>No stories match</h2><p>Try another search or reset the filters.</p></div>';
   const more=document.querySelector('#load-more');more.hidden=!result.remaining;more.textContent=`Load more stories (${result.remaining})`;
   if(updateUrl){const q=new URLSearchParams();for(const [k,v]of Object.entries(state))if(v&&!(k==='sort'&&v==='newest')&&!(k==='page'&&v===1))q.set(k,v);history.replaceState(null,'','/archive.html'+(q.size?'?'+q:'')+location.hash);}
  }
  readUrl();render(false);
  form.addEventListener('submit',e=>{e.preventDefault();page=1;render();});
  form.addEventListener('input',()=>{page=1;render();});
  form.addEventListener('change',()=>{page=1;render();});
  document.querySelector('#reset-filters').addEventListener('click',e=>{e.preventDefault();form.reset();for(const n of ['q','category','format'])form.elements[n].value='';form.elements.sort.value='newest';form.elements.alerts.checked=false;page=1;render();});
  document.querySelector('#load-more').addEventListener('click',()=>{page++;render();});
  window.addEventListener('popstate',()=>{readUrl();render(false);});
 }
 const signup=document.querySelector('#newsletter-form');
 signup?.addEventListener('submit',async e=>{e.preventDefault();if(!signup.reportValidity())return;const button=signup.querySelector('button'),status=document.querySelector('#newsletter-status');button.disabled=true;status.textContent='Submitting…';try{const response=await fetch('/.netlify/functions/send-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:signup.elements.email.value})});const data=await response.json();if(!response.ok||!data.success)throw Error(data.message||'Signup could not be completed. Please try again.');status.textContent=preview?'Test signup completed. No email was sent and no subscriber was added.':data.message||'Subscribed. Check your inbox.';signup.reset();}catch(error){status.textContent=error.message;}finally{button.disabled=false;}});
 function loadScript(src){const s=document.createElement('script');s.src=src;s.defer=true;document.head.append(s);}
 let adsLoaded=false;
 function activateAds(){if(preview||adsLoaded)return;adsLoaded=true;loadScript('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5427142458403577');loadScript('/js/ads.js');}
 function consent(){try{const c=JSON.parse(localStorage.getItem('cookieConsent'));return c&&new Date(c.expiry)>new Date()?c.choice:null;}catch{return null;}}
 function showConsent(){if(document.querySelector('#publication-consent'))return;const region=document.createElement('section');region.id='publication-consent';region.className='inline-consent';region.setAttribute('aria-label','Cookie preferences');region.innerHTML='<h2>Your cookie preferences</h2><p>Choose whether to allow optional advertising cookies. Essential account features use their own storage. <a href="/privacy.html">Read the privacy policy</a>.</p><button type="button" class="button button-blue" data-consent="accepted">Accept optional cookies</button><button type="button" class="button" data-consent="rejected">Reject optional cookies</button>';document.querySelector('.site-footer').before(region);region.addEventListener('click',e=>{const choice=e.target.dataset.consent;if(!choice)return;try{localStorage.setItem('cookieConsent',JSON.stringify({choice,date:new Date().toISOString(),expiry:new Date(Date.now()+365*86400000).toISOString()}));}catch{}document.dispatchEvent(new CustomEvent('cookieConsent',{detail:{choice}}));region.remove();if(choice==='accepted')activateAds();else if(adsLoaded)location.reload();});}
 document.querySelectorAll('[data-cookie-settings]').forEach(b=>b.addEventListener('click',()=>{showConsent();document.querySelector('#publication-consent').scrollIntoView({block:'center'});document.querySelector('[data-consent]').focus();}));
 if(consent()==='accepted')activateAds(); else if(!consent())showConsent();
 // Continue existing Auth0 callbacks, without loading account scripts for ordinary reading.
 if(new URLSearchParams(location.search).has('code'))import('/v2/js/auth.js').then(m=>m.initAuth()).catch(()=>{});
 const research=document.querySelector('#launch-research');research?.addEventListener('click',()=>{if(preview){document.querySelector('#research-status').textContent='AI requests are disabled in this local preview. The existing assistant will open here after deployment.';return;}loadScript('/src/widgets/noteworthy-chat-loader.js');research.disabled=true;document.querySelector('#research-status').textContent='The optional assistant is loading. Use the chat launcher to begin.';});
})();
