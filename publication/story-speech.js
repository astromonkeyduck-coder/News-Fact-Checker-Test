(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NoteworthyStorySpeech=api;})(typeof window==='object'?window:this,function(){
 'use strict';
 function plainText(value){return String(value||'').replace(/!\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/https?:\/\/\S+/g,'').replace(/^\s{0,3}#{1,6}\s+/gm,'').replace(/[*_`~]/g,'').replace(/\s+/g,' ').trim();}
 function chunks(text){const words=plainText(text).split(/\s+/),parts=[];let part='';for(const word of words){if(part.length+word.length+(part?1:0)>240){parts.push(part);part='';}part+=(part?' ':'')+word;}if(part)parts.push(part);return parts.filter(Boolean);}
 function createSpeech({synthesis,Utterance,onChange=()=>{}}){
  const supported=Boolean(synthesis&&Utterance);let generation=0,current=null;
  function stop(){generation++;current=null;if(supported)synthesis.cancel();onChange({state:'stopped'});}
  function speak(text){
   stop();if(!supported){onChange({state:'unavailable',message:'Spoken answers are unavailable in this browser.'});return false;}
   const parts=chunks(text),token=generation;if(!parts.length)return false;
   function next(index){
    if(token!==generation)return;if(index>=parts.length){current=null;onChange({state:'ended'});return;}
    const utterance=new Utterance(parts[index]);current=utterance;utterance.lang='en-US';utterance.rate=1;utterance.pitch=1;
    const voices=synthesis.getVoices?.()||[],english=voices.filter(v=>/^en[-_]/i.test(v.lang));utterance.voice=english.find(v=>/Samantha|Natural|Google US English/i.test(v.name))||english.find(v=>v.default)||english[0]||null;
    utterance.onstart=()=>{if(token===generation)onChange({state:'speaking'});};
    utterance.onend=()=>{if(token===generation)next(index+1);};
    utterance.onerror=()=>{if(token===generation){generation++;current=null;onChange({state:'error',message:'Audio could not play. Use Read aloud to try again.'});}};
    onChange({state:'starting'});try{synthesis.speak(utterance);}catch{utterance.onerror();}
   }
   next(0);return true;
  }
  return {supported,speak,stop};
 }
 return {plainText,chunks,createSpeech};
});
