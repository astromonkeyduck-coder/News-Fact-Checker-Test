(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NoteworthyAtlas=api;})(typeof window==='object'?window:this,function(){
'use strict';
const MODES=['expedition','classic','hard','typing','reasoning'], RULES='atlas-accuracy-v1';
const clone=value=>JSON.parse(JSON.stringify(value));
const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/['’\.]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
function hash(seed){let n=2166136261;for(const c of String(seed))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
function random(seed){let n=hash(seed);return()=>{n+=0x6D2B79F5;let x=n;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);return((x^(x>>>14))>>>0)/4294967296;};}
function shuffle(values,seed){const result=values.slice(),rng=random(seed);for(let i=result.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
const country=(data,id)=>data.countries.find(c=>c.id===id)||null;
const feature=(data,id)=>data.features.find(c=>c.id===id)||null;
function aliasMatch(data,id,value){const c=country(data,id);return Boolean(c&&c.aliases.some(alias=>normalize(alias)===normalize(value)));}
function identify(data,value){const match=data.countries.filter(c=>aliasMatch(data,c.id,value));return match.length===1?match[0]:null;}
function distance(a,b){const r=Math.PI/180,lat1=a[1]*r,lat2=b[1]*r;const d=Math.sin((lat2-lat1)/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin((b[0]-a[0])*r/2)**2;return 6371*2*Math.asin(Math.min(1,Math.sqrt(d)));}
function targetsFor(data,mode,seed,targets){
 if(targets!==undefined){if(!Array.isArray(targets)||!targets.length||targets.some(id=>!country(data,id)))throw new Error('Atlas targets must be eligible ISO3 country IDs.');return [...new Set(targets)].slice(0,50);}
 if(mode!=='expedition'&&mode!=='reasoning')return shuffle(data.countries.map(c=>c.id),seed);
 const anchors=['IND','USA','NGA','DEU'],anchor=country(data,anchors[hash(seed)%anchors.length]);
 return data.countries.slice().sort((a,b)=>distance(anchor.label,a.label)-distance(anchor.label,b.label)||a.rank-b.rank).slice(0,10).map(c=>c.id);
}
function create(data,options={}){
 const mode=MODES.includes(options.mode)?options.mode:'expedition',seed=String(options.seed??'atlas-first-expedition'),ids=targetsFor(data,mode,seed,options.targets),now=Number.isFinite(options.now)?options.now:Date.now();
 return {schemaVersion:1,contentVersion:data.version,rules:RULES,mode,seed,sessionId:options.sessionId||`${seed}:${now}:${Math.random().toString(36).slice(2,9)}`,createdAt:now,targets:ids,queue:ids.map(id=>({id,review:false})),index:0,status:'question',paused:false,current:{attempts:[],assistance:0,typed:''},results:[],reviewResults:[],reviewScheduled:[],view:{x:0,y:0,width:1080,height:540},finishReported:false};
}
function score(attempts,assistance){if(assistance===3)return 0;const points=attempts<=1?100:attempts===2?60:30;return assistance>0?Math.min(30,points):points;}
function currentCountry(data,state){return country(data,state.queue[state.index]?.id);}
function roundKey(state){return `${state.index}:${state.queue[state.index]?.id||'finished'}`;}
function scheduleReview(state,id){if(state.mode!=='expedition'||state.reviewScheduled.includes(id))return;state.reviewScheduled.push(id);state.queue.splice(Math.min(state.queue.length,state.index+3),0,{id,review:true});}
function answer(data,input,action){
 if(input.paused||input.status!=='question'||(action.roundKey&&action.roundKey!==roundKey(input)))return input;
 const s=clone(input),target=currentCountry(data,s);if(!target)return input;
 if(action.type==='hint'){s.current.assistance=Math.min(2,s.current.assistance+1);return s;}
 if(action.type==='type'){s.current.typed=String(action.value||'').slice(0,100);return s;}
 let correct=false;
 if(action.type==='reveal')s.current.assistance=3;
 else if(action.type==='guess'){
  const guess=String(action.value||'').trim();if(!guess)return input;
  const selected=['typing','reasoning'].includes(s.mode)?identify(data,guess)?.id:guess;
  const attempt={value:guess,id:selected||null};
  if(s.current.attempts.length&&s.current.attempts.at(-1).value===guess)return input;
  s.current.attempts.push(attempt);correct=selected===target.id;
  if(!correct){s.current.feedback=selected?`You selected ${feature(data,selected)?.name||selected}.`:'That answer does not identify this target. Check the spelling or use a hint.';return s;}
 }else return input;
 const review=s.queue[s.index].review,result={id:target.id,correct,assistance:s.current.assistance,attempts:s.current.attempts.length,score:correct?score(s.current.attempts.length,s.current.assistance):0,review};
 (review?s.reviewResults:s.results).push(result);s.status='feedback';s.current.correct=correct;
 if(!review&&(!correct||result.assistance>0||result.attempts>1))scheduleReview(s,target.id);
 return s;
}
function next(input,key){if(input.paused||input.status!=='feedback'||(key&&key!==roundKey(input)))return input;const s=clone(input);s.index++;s.current={attempts:[],assistance:0,typed:''};s.status=s.index>=s.queue.length?'finished':'question';return s;}
function summary(state){const scoreSum=state.results.reduce((n,r)=>n+r.score,0);return{seen:[...new Set(state.queue.slice(0,Math.min(state.queue.length,state.index+1)).map(q=>q.id))],score:scoreSum,maxScore:state.targets.length*100,correct:state.results.filter(r=>r.correct).length,total:state.targets.length,assistance:state.results.filter(r=>r.assistance>0).length,results:clone(state.results),reviewResults:clone(state.reviewResults),mode:state.mode,seed:state.seed,contentVersion:state.contentVersion,rules:state.rules,sessionId:state.sessionId,createdAt:state.createdAt,complete:state.status==='finished'};}
function restore(data,value){
 try{const s=clone(value);if(!s||s.schemaVersion!==1||s.contentVersion!==data.version||s.rules!==RULES||!MODES.includes(s.mode)||!['question','feedback','finished'].includes(s.status)||typeof s.seed!=='string'||typeof s.sessionId!=='string')return{ok:false,reason:'This save uses a different Atlas edition or an unreadable format. It has not been changed.'};
  if(!Array.isArray(s.targets)||!s.targets.length||s.targets.length>50||new Set(s.targets).size!==s.targets.length||s.targets.some(id=>!country(data,id))||!Array.isArray(s.queue)||s.queue.length>s.targets.length*2||s.queue.some(q=>!s.targets.includes(q.id)||typeof q.review!=='boolean')||!Number.isInteger(s.index)||s.index<0||s.index>s.queue.length||!s.current||!Array.isArray(s.current.attempts)||!Number.isInteger(s.current.assistance)||s.current.assistance<0||s.current.assistance>3||!Array.isArray(s.results)||!Array.isArray(s.reviewResults)||!Array.isArray(s.reviewScheduled))throw Error('Invalid run');
  if(s.status==='finished'&&s.index!==s.queue.length||s.status!=='finished'&&s.index>=s.queue.length)throw Error('Invalid position');
  const completed=s.queue.slice(0,s.index+(s.status==='feedback'?1:0));
  if(JSON.stringify(s.queue.filter(q=>!q.review).map(q=>q.id))!==JSON.stringify(s.targets)||JSON.stringify(completed.filter(q=>!q.review).map(q=>q.id))!==JSON.stringify(s.results.map(r=>r.id))||JSON.stringify(completed.filter(q=>q.review).map(q=>q.id))!==JSON.stringify(s.reviewResults.map(r=>r.id))||s.current.attempts.some(a=>!a||typeof a.value!=='string'||a.value.length>100)||s.status==='feedback'&&typeof s.current.correct!=='boolean')throw Error('Inconsistent run position');
  const reviews=s.queue.filter(q=>q.review).map(q=>q.id);
  if(new Set(reviews).size!==reviews.length||JSON.stringify(reviews.slice().sort())!==JSON.stringify(s.reviewScheduled.slice().sort())||s.mode!=='expedition'&&reviews.length)throw Error('Invalid review queue');
  if(new Set(s.results.map(r=>r.id)).size!==s.results.length||[...s.results,...s.reviewResults].some(r=>!s.targets.includes(r.id)||typeof r.correct!=='boolean'||!Number.isInteger(r.attempts)||r.attempts<0||r.correct&&r.attempts<1||!Number.isInteger(r.assistance)||r.assistance<0||r.assistance>3||r.correct&&r.assistance===3||!r.correct&&r.assistance!==3))throw Error('Invalid results');
  if(s.status==='feedback'){const latest=s.queue[s.index].review?s.reviewResults.at(-1):s.results.at(-1);if(latest.correct!==s.current.correct||latest.attempts!==s.current.attempts.length||latest.assistance!==s.current.assistance)throw Error('Inconsistent feedback');}
  [...s.results,...s.reviewResults].forEach(r=>{r.score=r.correct?score(r.attempts,r.assistance):0;});
  s.view=clampView(s.view);s.paused=Boolean(s.paused);s.finishReported=Boolean(s.finishReported);return{ok:true,state:s};
 }catch(_){return{ok:false,reason:'This saved run could not be read. The stored record has not been changed.'};}
}
function hint(data,c,level,mode){if(level<1)return'';if(mode==='reasoning')return level===1?`This edition’s displayed name begins with ${c.name[0]}.`:`Its displayed name has ${normalize(c.name).replace(/ /g,'').length} letters, excluding spaces and punctuation, and begins with ${c.name[0]}.`;if(level===1)return `Begin in ${c.region}.`;const names=c.neighbors.map(id=>feature(data,id)?.name).filter(Boolean);return names.length?`Look for mapped land neighbors including ${names.slice(0,3).join(', ')}. The name begins with ${c.name[0]}.`:`No shared land boundary is shown. Its label point lies around ${Math.round(Math.abs(c.label[1]))}°${c.label[1]>=0?'N':'S'}, ${Math.round(Math.abs(c.label[0]))}°${c.label[0]>=0?'E':'W'}.`;}
function reasoning(data,c){const names=c.neighbors.map(id=>feature(data,id)?.name).filter(Boolean).slice(0,3);return `Name the country in ${c.region}. ${names.length?`Mapped land neighbors include ${names.join(', ')}.`:'No shared land border is shown in this map edition.'} It ranks ${c.rank} by population in this challenge’s frozen 2024 edition.`;}
function clampView(v={}){const width=Math.max(67.5,Math.min(1080,Number(v.width)||1080)),height=width/2;return{x:Math.max(0,Math.min(1080-width,Number(v.x)||0)),y:Math.max(0,Math.min(540-height,Number(v.y)||0)),width,height};}
function zoom(view,factor,anchor=[.5,.5]){const width=Math.max(67.5,Math.min(1080,view.width/factor)),height=width/2;return clampView({width,x:view.x+(view.width-width)*anchor[0],y:view.y+(view.height-height)*anchor[1]});}
function project(point){return[(point[0]+180)*3,(90-point[1])*3];}
function geometryPath(geometry){const polys=geometry.type==='MultiPolygon'?geometry.coordinates:[geometry.coordinates];return polys.map(poly=>poly.map(ring=>ring.map((p,i)=>{const xy=project(p);return`${i?'L':'M'}${xy[0].toFixed(2)},${xy[1].toFixed(2)}`;}).join('')+'Z').join('')).join('');}
function inRing(point,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function contains(geometry,point){const ps=geometry.type==='MultiPolygon'?geometry.coordinates:[geometry.coordinates];return ps.some(poly=>inRing(point,poly[0])&&!poly.slice(1).some(ring=>inRing(point,ring)));}
function hit(data,coordinate){return data.features.find(f=>contains(f.geometry,coordinate))?.id||null;}
function updateMastery(previous,run,now=Date.now()){
 const out=previous&&typeof previous==='object'&&!Array.isArray(previous)?clone(previous):{};
 const results=Array.isArray(run?.results)?run.results:[],seen=Array.isArray(run?.seen)?run.seen:results.map(r=>r.id);
 for(const id of [...new Set(seen.concat(results.map(r=>r.id)))]){
  const old=out[id],entry={history:Array.isArray(old?.history)?old.history.filter(h=>h&&typeof h.sessionId==='string'&&Number.isFinite(h.at)):[]};
  const result=results.find(r=>r.id===id),existing=entry.history.find(h=>h.sessionId===run.sessionId);
  if(!existing||existing.outcome==='seen'&&result){
   const record={sessionId:run.sessionId,at:now,correct:Boolean(result?.correct),assistance:result?.assistance||0,attempts:result?.attempts||0,mode:run.mode,contentVersion:run.contentVersion,outcome:result?'completed':'seen'};
   if(existing)Object.assign(existing,record);else entry.history.push(record);
  }
  entry.history=entry.history.slice(-40);const independent=entry.history.filter(h=>h.correct&&h.assistance===0&&h.attempts===1);
  entry.level=independent.some(a=>independent.some(b=>b.mode===a.mode&&b.at-a.at>=86400000))?'recalled independently':independent.length?'found independently':entry.history.some(h=>h.correct||h.assistance===3)?'found with help':'seen';out[id]=entry;
 }
 return out;
}
return{MODES,RULES,normalize,hash,shuffle,country,feature,aliasMatch,identify,distance,targetsFor,create,score,currentCountry,roundKey,answer,next,summary,restore,hint,reasoning,clampView,zoom,project,geometryPath,contains,hit,updateMastery};
});
