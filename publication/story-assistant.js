(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else{root.NoteworthyStoryAssistant=api;api.mount(root.document,root);}
})(typeof window==='object'?window:this,function(){
 'use strict';
 const ENDPOINT='/.netlify/functions/noteworthy-chat';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const mark='<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle class="sa-orbit" cx="20" cy="20" r="16"/><path class="sa-star" d="M20 7c0 8-5 13-13 13 8 0 13 5 13 13 0-8 5-13 13-13-8 0-13-5-13-13Z"/><circle cx="32" cy="8" r="2" fill="currentColor" stroke="none"/></svg>';
 function safeUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
 function answerMarkup(value){
  const format=value=>esc(value).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
  const text=String(value||'').slice(0,20000),parts=[];let last=0;
  const pattern=/\[([^\]\n]{1,200})\]\((https?:\/\/)/g;let match;
  while((match=pattern.exec(text))){
   const start=match.index+match[0].length-match[2].length;let cursor=start,depth=0;
   for(;cursor<text.length;cursor++){const char=text[cursor];if(/\s|[<>]/.test(char)||(char===')'&&depth===0))break;if(char==='(')depth++;if(char===')')depth--;}
   if(text[cursor]!==')')continue;const url=safeUrl(text.slice(start,cursor));if(!url)continue;
   parts.push(format(text.slice(last,match.index)));parts.push('<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(match[1])+'</a>');last=cursor+1;pattern.lastIndex=last;
  }
  parts.push(format(text.slice(last)));return parts.join('');
 }
 function sourceMarkup(sources){
  const seen=new Set(),valid=(Array.isArray(sources)?sources:[]).filter(s=>s&&safeUrl(s.url)&&!seen.has(s.url)&&seen.add(s.url)).slice(0,6);
  return valid.length?'<div class="sa-answer-sources"><span>Sources cited in this answer</span>'+valid.map(s=>'<a href="'+esc(safeUrl(s.url))+'" target="_blank" rel="noopener noreferrer">'+esc(s.title||s.label||new URL(s.url).hostname)+(s.label?' — '+esc(s.label):'')+' <span aria-hidden="true">↗</span></a>').join('')+'</div>':'';
 }
 function imageMarkup(image){
  const value=String(image?.imageUrl||''),inline=value.length<=6000000&&/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(value),url=inline?value:safeUrl(value);if(!url)return '';
  return '<figure class="sa-generated-image"><a href="'+esc(url)+'" '+(inline?'download="noteworthy-ai-explainer.png"':'target="_blank" rel="noopener noreferrer"')+' aria-label="'+(inline?'Save':'Open')+' AI-generated explanatory image"><img src="'+esc(url)+'" alt="AI-generated explanatory illustration. May contain visual or factual errors; it is not evidence of the reported event."><span class="sa-image-action">'+(inline?'Save illustration ↓':'Open illustration ↗')+'</span></a><figcaption><strong>AI-generated illustration</strong> A visual explanation, not a news photograph or evidence. Verify labels and details against the sources.</figcaption></figure>';
 }
 function markup(article){
  if(!article||!article.id||article.review_required)return '';
  const context={articleId:String(article.id),title:article.title,url:new URL(article.href,'https://noteworthynews.co').href};
  return `<aside class="story-assistant" data-story-assistant data-context="${esc(JSON.stringify(context))}" hidden>
   <section class="sa-panel" id="story-ai-panel" aria-label="Ask Noteworthy AI about this story" hidden>
    <header class="sa-header"><div class="sa-brand"><span class="sa-emblem">${mark}</span><span>Noteworthy <strong>AI</strong><small>Your story companion</small></span></div><button type="button" class="sa-audio" aria-pressed="true" aria-label="Mute spoken answers">Voice on</button><button type="button" class="sa-close" aria-label="Dismiss story assistant">×</button>
     <div class="sa-invitation"><span class="sa-eyebrow">Stay curious.</span><h2>A question about<br>this story?</h2><p>Let’s look a little closer.</p></div>
    </header>
    <div class="sa-scroll"><div class="sa-context"><span>You’re reading</span><p>${esc(article.title)}</p></div>
     <section class="sa-call-panel" aria-label="Voice conversation" hidden><div class="sa-call-orb" aria-hidden="true">${mark}</div><span class="sa-call-provider">ElevenLabs voice</span><h3>Talk through the story.</h3><p class="sa-call-status" role="status">Connecting your voice call…</p><p class="sa-call-disclosure">Your microphone audio and this story’s context are shared with ElevenLabs during the call. The AI can make mistakes.</p><div class="sa-call-controls"><button type="button" data-call-mute aria-pressed="false">Mute microphone</button><button type="button" data-call-end>End call</button><button type="button" data-call-retry hidden>Try again</button></div></section>
     <div class="sa-suggestions" aria-label="Suggested questions"><button type="button" data-story-question="What happened in this story? Summarize the reported facts and attribute them to the available sources.">What happened? <span aria-hidden="true">↗</span></button><button type="button" data-story-question="Why does this story matter? Distinguish sourced context from interpretation and say what the available reporting cannot establish.">Why does it matter? <span aria-hidden="true">↗</span></button><button type="button" data-story-question="What is still unclear in this story? Explain the limits of the available evidence and link to the cited sources.">What’s still unclear? <span aria-hidden="true">↗</span></button></div>
     <div class="sa-messages" role="log" aria-label="Conversation with Noteworthy AI" aria-live="polite" aria-relevant="additions text"></div>
    </div>
    <div class="sa-compose"><div class="sa-tools"><button type="button" data-story-visual aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/></svg> Make a visual</button><button type="button" data-story-call><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2c-3-1.4-5.6-4-7-7l2-2-2-5Z"/></svg> Voice call</button></div><form><label for="story-ai-question">Your question</label><div class="sa-input-wrap"><textarea id="story-ai-question" name="question" rows="1" maxlength="2000" placeholder="Ask about this story…" required></textarea><button type="submit" class="sa-send" aria-label="Send your question"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button></div></form>
     <div class="sa-speech-actions"><button type="button" data-speech-stop hidden>Stop reading</button><button type="button" data-speech-replay hidden>Read aloud</button><span data-speech-status role="status"></span></div><p class="sa-status" role="status"></p><p class="sa-disclosure">AI can make mistakes. <a href="#sources" data-story-sources>Check the story’s sources.</a> Questions, chat and story context go to OpenAI and Noteworthy. ElevenLabs provides speech and voice calls. Chats may be stored and included in operational notifications. <a href="/privacy.html#ai">Privacy</a></p>
    </div>
   </section>
   <button type="button" class="sa-launcher" aria-expanded="false" aria-controls="story-ai-panel">${mark}<span>Ask about this story</span><span aria-hidden="true">↗</span></button>
  </aside>`;
 }
 function createConversation({fetch:request,context,preview=false,setTimeout:schedule=setTimeout,clearTimeout:clear=clearTimeout,AbortController:Controller=AbortController}){
  const history=[];let busy=false;
  return {async ask(question,options={}){
   const message=String(question||'').trim();if(!message||message.length>2000)throw Error('Please ask a question of up to 2,000 characters.');if(busy)throw Error('Please wait for the current answer.');
   if(preview&&options.image)return {preview:true,reply:'Image generation is not connected in this local preview. On the published site, Make a visual requests a labeled illustration using this article’s available source record. No image was generated and no AI request was sent.',sources:[]};
   if(preview)return {preview:true,reply:'Live AI answers are not connected in this local preview. On the published site, your question will use the existing Noteworthy AI service with this article as context. You can inspect the story’s source trail below; no AI request was sent.',sources:[]};
   busy=true;const controller=new Controller(),timeout=schedule(()=>controller.abort(),options.image?90000:30000);
   try{
    const response=await request(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,chatHistory:history.slice(-12),pageContext:context,...(options.image?{articleImage:true}:{})}),signal:controller.signal});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(response.status===429?'The assistant has reached its request limit. Please try again later.':'The assistant is unavailable right now. Your question is still here; please try again.');
    if(typeof data.reply!=='string'||!data.reply.trim())throw Error('No answer was returned. Please try again.');
    const reply=data.reply.slice(0,20000);history.push({role:'user',content:message},{role:'assistant',content:reply});history.splice(0,Math.max(0,history.length-12));
    return {reply,sources:data.sources,image:data.image,groundingUnavailable:Boolean(data.groundingUnavailable)};
   }catch(error){if(error.name==='AbortError')throw Error('The answer took too long. Your question is still here; please try again.');if(error.name==='TypeError')throw Error('The assistant could not connect. Your question is still here; please try again.');throw error;}
   finally{clear(timeout);busy=false;}
  }};
 }
 function mount(doc,win){
  const root=doc?.querySelector('[data-story-assistant]');if(!root||root.dataset.mounted)return null;root.dataset.mounted='true';
  let context;try{context=JSON.parse(root.dataset.context);}catch{return null;}
  const panel=root.querySelector('.sa-panel'),launcher=root.querySelector('.sa-launcher'),close=root.querySelector('.sa-close'),input=root.querySelector('textarea'),form=root.querySelector('form'),messages=root.querySelector('.sa-messages'),status=root.querySelector('.sa-status'),scroll=root.querySelector('.sa-scroll');
  const key='noteworthy-story-ai-dismissed:'+context.articleId;
  let open=false,pending=false,autoTimer=null,lastTrigger=null,introduced=false,imageMode=false,lastAnswer='',voiceOn=true,callMode=false,micMuted=false;
  const audioToggle=root.querySelector('.sa-audio'),speechStop=root.querySelector('[data-speech-stop]'),speechReplay=root.querySelector('[data-speech-replay]'),speechStatus=root.querySelector('[data-speech-status]'),visualButton=root.querySelector('[data-story-visual]'),callButton=root.querySelector('[data-story-call]'),callPanel=root.querySelector('.sa-call-panel'),callStatus=root.querySelector('.sa-call-status'),callMute=root.querySelector('[data-call-mute]'),callEnd=root.querySelector('[data-call-end]'),callRetry=root.querySelector('[data-call-retry]');
  try{voiceOn=win.localStorage.getItem('noteworthy-story-ai-voice')!=='off';}catch{}
  const speech=win.NoteworthyStorySpeech?.createSpeech({window:win,preview:doc.body.dataset.preview==='true',onChange:({state,message})=>{if(speechStop)speechStop.hidden=!['starting','speaking'].includes(state);if(speechReplay)speechReplay.hidden=!lastAnswer||['starting','speaking'].includes(state);if(speechStatus)speechStatus.textContent=message||(state==='speaking'?'Reading aloud.':state==='starting'?'Preparing spoken answer…':'');}});
  function audioLabel(){if(audioToggle){audioToggle.textContent=voiceOn?'Voice on':'Voice off';audioToggle.setAttribute('aria-pressed',String(voiceOn));audioToggle.setAttribute('aria-label',voiceOn?'Mute spoken answers':'Enable spoken answers');}}
  function claimAudio(owner){doc.dispatchEvent?.(new win.CustomEvent('noteworthy:audio-owner',{detail:{owner}}));doc.querySelectorAll('video').forEach(video=>video.pause());}
  function readAnswer(){if(!lastAnswer||!speech?.supported){if(speechStatus)speechStatus.textContent='ElevenLabs audio is unavailable in this browser.';return;}if(doc.body.dataset.preview!=='true')claimAudio('story-assistant');speech.speak(lastAnswer);}
  const call=win.NoteworthyStoryVoice?.createCall({window:win,onState:({state,message,muted,active})=>{if(!callMode)return;if(callStatus)callStatus.textContent=message||({connecting:'Connecting your voice call…',listening:'Listening — ask about the story.',speaking:'Noteworthy AI is speaking.',muted:'Microphone muted.',ended:'Call ended.',error:'The call could not connect.'}[state]||state);micMuted=Boolean(muted);if(callMute){callMute.disabled=!active;callMute.textContent=micMuted?'Unmute microphone':'Mute microphone';callMute.setAttribute('aria-pressed',String(micMuted));}if(callEnd)callEnd.textContent=active||state==='connecting'?'End call':'Back to chat';if(callRetry)callRetry.hidden=state!=='error'||doc.body.dataset.preview==='true';root.dataset.callState=state;},onTranscript:({role,text,final})=>{if(final&&text)append(role==='user'?'user':'assistant',text);}});
  function endCall(){call?.stop();callMode=false;root.classList.remove('has-call');if(callPanel)callPanel.hidden=true;form.hidden=false;if(visualButton)visualButton.disabled=pending;if(callButton)callButton.disabled=pending;}
  async function startCall(){if(pending||callMode)return;speech?.stop();callMode=true;root.classList.add('has-call');if(callPanel)callPanel.hidden=false;form.hidden=true;if(visualButton)visualButton.disabled=true;if(callButton)callButton.disabled=true;if(callRetry)callRetry.hidden=true;if(callMute)callMute.disabled=true;claimAudio('story-call');if(callStatus)callStatus.textContent='Connecting your voice call…';if(!call){if(callStatus)callStatus.textContent='Voice calls could not load. Reload the page and try again.';if(callEnd)callEnd.textContent='Back to chat';return;}await call.start(context);}
  audioLabel();if(audioToggle&&!speech?.supported){audioToggle.disabled=true;audioToggle.textContent='Voice unavailable';audioToggle.setAttribute('aria-label','Spoken answers unavailable in this browser');}
  const conversation=createConversation({fetch:(...args)=>win.fetch(...args),context,preview:doc.body.dataset.preview==='true',setTimeout:win.setTimeout.bind(win),clearTimeout:win.clearTimeout.bind(win),AbortController:win.AbortController});
  function dismissed(){if(introduced)return true;try{return win.sessionStorage.getItem(key)==='1';}catch{return false;}}
  function setOpen(next,manual=false){
   const trigger=doc.activeElement;win.clearTimeout(autoTimer);open=next;panel.hidden=!next;launcher.hidden=next;launcher.setAttribute('aria-expanded',String(next));root.classList.toggle('is-open',next);
   if(next){introduced=true;try{win.sessionStorage.setItem(key,'1');}catch{}if(manual){lastTrigger=trigger;input.focus({preventScroll:true});}}
   else{speech?.stop();if(callMode)endCall();try{win.sessionStorage.setItem(key,'1');}catch{}if(panel.contains(trigger))(lastTrigger?.isConnected?lastTrigger:launcher).focus({preventScroll:true});}
  }
  function append(role,content,sources,preview){const item=doc.createElement('div');item.className='sa-message sa-message-'+role;item.innerHTML='<span class="sa-message-label">'+(role==='user'?'You':preview?'Local preview':'Noteworthy AI · Generated answer')+'</span><div>'+answerMarkup(content)+'</div>'+(role==='assistant'?sourceMarkup(sources):'');messages.append(item);scroll.scrollTop=scroll.scrollHeight;return item;}
  async function send(question){
   if(pending||callMode)return;speech?.stop();const value=String(question||'').trim();if(!value)return;
   input.value=value;if(!input.reportValidity())return;pending=true;if(visualButton)visualButton.disabled=true;if(callButton)callButton.disabled=true;root.classList.add('has-conversation');root.querySelectorAll('[data-story-question]').forEach(b=>b.disabled=true);form.querySelector('button').disabled=true;input.readOnly=true;
   const userMessage=append('user',value);status.textContent='Preparing an answer…';root.classList.add('is-thinking');
   try{const answer=await conversation.ask(value,{image:imageMode});const replyElement=append('assistant',answer.reply,answer.sources,answer.preview);if(answer.image){const figure=doc.createElement('div');figure.innerHTML=imageMarkup(answer.image);figure.querySelector('img')?.addEventListener('error',()=>{figure.innerHTML='<p>The generated image could not load. Its temporary link may have expired. You can request it again.</p>';},{once:true});replyElement.append(figure);scroll.scrollTop=scroll.scrollHeight;}lastAnswer=answer.reply;if(speechReplay)speechReplay.hidden=!speech?.supported;if(voiceOn&&open&&!doc.hidden)readAnswer();input.value='';status.textContent=answer.preview?'Preview only · No AI request sent':answer.groundingUnavailable?'Supporting sources were unavailable. Check the answer’s limitations.':sourceMarkup(answer.sources)?'Answer ready. Follow its sources to check the details.':'No source citations were returned. Check the story’s source trail before relying on this answer.';}
   catch(error){userMessage.remove();status.textContent=error.message;}
   finally{pending=false;if(visualButton)visualButton.disabled=false;if(callButton)callButton.disabled=false;root.classList.remove('is-thinking');form.querySelector('button').disabled=false;input.readOnly=false;root.querySelectorAll('[data-story-question]').forEach(b=>b.disabled=false);}
  }
  audioToggle?.addEventListener('click',()=>{voiceOn=!voiceOn;try{win.localStorage.setItem('noteworthy-story-ai-voice',voiceOn?'on':'off');}catch{}if(!voiceOn)speech?.stop();audioLabel();});
  speechStop?.addEventListener('click',()=>speech?.stop());speechReplay?.addEventListener('click',readAnswer);
  visualButton?.addEventListener('click',()=>{imageMode=!imageMode;root.classList.toggle('is-image-mode',imageMode);visualButton.setAttribute('aria-pressed',String(imageMode));input.placeholder=imageMode?'Describe a diagram or illustration…':'Ask about this story…';form.querySelector('button').setAttribute('aria-label',imageMode?'Generate explanatory image':'Send your question');status.textContent=imageMode?'Describe what a visual should explain. Generated images will be labeled and may contain errors.':'';input.focus({preventScroll:true});});
  callButton?.addEventListener('click',startCall);callEnd?.addEventListener('click',endCall);callMute?.addEventListener('click',()=>call?.setMuted(!micMuted));callRetry?.addEventListener('click',()=>{endCall();startCall();});
  doc.addEventListener('noteworthy:audio-owner',event=>{if(!['story-assistant','story-call'].includes(event.detail?.owner)){speech?.stop();if(callMode)endCall();}});
  win.addEventListener?.('pagehide',()=>{speech?.stop();call?.stop();});
  root.hidden=false;close.addEventListener('click',()=>setOpen(false));launcher.addEventListener('click',()=>setOpen(true,true));
  root.querySelector('[data-story-sources]').addEventListener('click',()=>setOpen(false));
  root.querySelectorAll('[data-story-question]').forEach(b=>b.addEventListener('click',()=>send(b.dataset.storyQuestion)));
  doc.querySelectorAll('[data-ask-story]').forEach(b=>{b.hidden=false;b.addEventListener('click',()=>setOpen(true,true));});
  form.addEventListener('submit',event=>{event.preventDefault();send(input.value);});
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();send(input.value);}});
  doc.addEventListener('keydown',event=>{if(event.key==='Escape'&&open){event.preventDefault();setOpen(false);}});
  function invite(){if(!dismissed()&&!doc.hidden&&!open&&!/^(INPUT|TEXTAREA|SELECT)$/.test(doc.activeElement?.tagName)&&!doc.querySelector('dialog[open]'))setOpen(true);}
  if(!dismissed())autoTimer=win.setTimeout(invite,2400);
  doc.addEventListener('visibilitychange',()=>{if(doc.hidden){speech?.stop();if(callMode)endCall();}if(!doc.hidden&&!dismissed()&&!open)autoTimer=win.setTimeout(invite,1200);});
  return {open:()=>setOpen(true,true),close:()=>setOpen(false)};
 }
 return {markup,mount,createConversation,answerMarkup,sourceMarkup,imageMarkup,safeUrl};
});
