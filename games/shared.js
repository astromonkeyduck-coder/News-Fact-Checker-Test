(function(root){'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const loaded=new Map();
 function script(url){if(loaded.has(url))return loaded.get(url);const p=new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=url;el.onload=resolve;el.onerror=()=>{loaded.delete(url);el.remove();reject(new Error('Could not load '+url));};document.head.append(el);});loaded.set(url,p);return p;}
 function style(url){if(document.querySelector('link[href="'+url+'"]'))return;const el=document.createElement('link');el.rel='stylesheet';el.href=url;document.head.append(el);}
 function announce(text){const el=document.querySelector('#games-status');if(el)el.textContent=text;}
 function download(name,data,type='application/json'){const blob=new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function time(seconds){const t=Math.max(0,Math.floor(seconds||0));return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');}
 function closeDialog(dialog){dialog.close();dialog.remove();}
 function modal(title,body,onReady){const dialog=document.createElement('dialog');dialog.className='g-dialog';dialog.innerHTML='<div class="g-dialog-heading"><h2>'+esc(title)+'</h2><button type="button" class="g-icon-button" aria-label="Close dialog">×</button></div>'+body;dialog.querySelector('button').onclick=()=>closeDialog(dialog);dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog(dialog);},{once:true});document.body.append(dialog);dialog.showModal();onReady?.(dialog);return dialog;}
 let audio=null,ambient=null;
 function sound(settings,type='confirm'){if(!settings.effects)return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();audio.resume();const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type='sine';oscillator.frequency.value=type==='correct'?660:440;gain.gain.setValueAtTime(.035,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.18);oscillator.connect(gain).connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+.2);}catch{}}
 function ambience(settings){if(ambient){ambient.stop();ambient=null;}if(!settings.ambience)return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();audio.resume();const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.frequency.value=110;oscillator.type='sine';gain.gain.value=.008;oscillator.connect(gain).connect(audio.destination);oscillator.start();ambient=oscillator;}catch{}}
 const icon={arrow:'↗',pin:'◇',compass:'⊕',water:'≋',check:'✓',document:'▤'};
 root.NoteworthyGameUI={esc,script,style,announce,download,time,modal,sound,ambience,icon};
})(window);
