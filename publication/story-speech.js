/* Spoken answers use ElevenLabs exclusively. No browser speech fallback. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NoteworthyStorySpeech=api;})(typeof window==='object'?window:this,function(){
 'use strict';
 const ENDPOINT='/.netlify/functions/elevenlabs-tts';
 function plainText(value){return String(value||'').replace(/!\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/https?:\/\/\S+/g,'').replace(/^\s{0,3}#{1,6}\s+/gm,'').replace(/[*_`~]/g,'').replace(/\s+/g,' ').trim();}
 function chunks(value){let text=plainText(value);const result=[];while(text){if(text.length<=900){result.push(text);break;}const slice=text.slice(0,900),sentence=Math.max(slice.lastIndexOf('. '),slice.lastIndexOf('? '),slice.lastIndexOf('! ')),space=slice.lastIndexOf(' '),cut=sentence>350?sentence+1:space>0?space:900;result.push(text.slice(0,cut));text=text.slice(cut).trim();}return result;}
 function createSpeech({window:w,preview=false,onChange=()=>{}}){
  const supported=Boolean(w?.fetch&&w.Audio&&w.AbortController);let generation=0,current=null,controller=null,timer=null,finishPlayback=null,cacheSize=0;const cache=new Map();
  function stop(){generation++;if(timer)w.clearTimeout(timer);timer=null;controller?.abort();controller=null;if(current){current.onended=current.onerror=current.onplaying=null;current.pause();current.removeAttribute?.('src');current.load?.();current=null;}if(finishPlayback){finishPlayback(false);finishPlayback=null;}onChange({state:'stopped'});}
  async function speak(value){
   stop();if(preview){onChange({state:'unavailable',message:'ElevenLabs audio is not connected in this local preview.'});return false;}if(!supported){onChange({state:'unavailable',message:'ElevenLabs audio is unavailable in this browser.'});return false;}
   const parts=chunks(value),token=generation;if(!parts.length)return false;
   try{
    for(const text of parts){
     if(token!==generation)return false;onChange({state:'starting',message:'Preparing ElevenLabs audio…'});let source=cache.get(text);
     if(!source){
      const requestController=new w.AbortController(),requestTimer=w.setTimeout(()=>requestController.abort(),25000);controller=requestController;timer=requestTimer;
      let response,data;try{response=await w.fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,storyAnswer:true}),signal:requestController.signal});data=await response.json().catch(()=>({}));}finally{w.clearTimeout(requestTimer);if(timer===requestTimer)timer=null;if(controller===requestController)controller=null;}
      if(token!==generation)return false;
      if(!response.ok)throw Error(response.status===429?'ElevenLabs audio has reached its request limit. Please try again later.':'ElevenLabs audio is unavailable right now. Use Read aloud to try again.');
      if(data.format!=='mp3'||typeof data.audio!=='string'||!data.audio.length||data.audio.length>6000000||!/^[A-Za-z0-9+/]+={0,2}$/.test(data.audio)||data.truncated===true||(Number.isFinite(data.character_count)&&data.character_count!==text.length))throw Error('The complete ElevenLabs audio was not returned. Use Read aloud to try again.');
      source='data:audio/mpeg;base64,'+data.audio;cache.set(text,source);cacheSize+=source.length;while(cache.size>24||cacheSize>12000000){const first=cache.keys().next().value;cacheSize-=cache.get(first).length;cache.delete(first);}
     }
     if(token!==generation)return false;
     const audio=current=new w.Audio(source);
     const played=await new Promise((resolve,reject)=>{finishPlayback=resolve;audio.onplaying=()=>{if(token===generation)onChange({state:'speaking',message:'Reading aloud · ElevenLabs'});};audio.onended=()=>resolve(true);audio.onerror=()=>reject(Error('ElevenLabs audio could not play. Use Read aloud to try again.'));try{const playing=audio.play();playing?.catch(()=>reject(Error('Your browser paused audio. Use Read aloud to play the ElevenLabs answer.')));}catch{reject(Error('ElevenLabs audio could not play. Use Read aloud to try again.'));}});
     if(token!==generation||!played)return false;audio.onended=audio.onerror=audio.onplaying=null;current=null;finishPlayback=null;
    }
    if(token===generation)onChange({state:'ended'});return token===generation;
   }catch(error){if(token!==generation)return false;stop();onChange({state:'error',message:error.name==='AbortError'?'ElevenLabs audio took too long. Use Read aloud to try again.':error.message});return false;}
  }
  return {supported,speak,stop};
 }
 return {plainText,chunks,createSpeech};
});
