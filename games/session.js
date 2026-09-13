(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NoteworthyGameState=api;})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  const VERSION='waterline-1',KEY='noteworthy-games-v1',SCHEMA=1;
  const copy=value=>JSON.parse(JSON.stringify(value));
  const finite=value=>typeof value==='number'&&Number.isFinite(value);
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  const object=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
  const id=value=>typeof value==='string'&&value.length>0&&!['__proto__','prototype','constructor'].includes(value);
  const ids=value=>Array.isArray(value)&&value.every(id);
  const time=value=>finite(value)&&value>=0&&value<=8640000000000000;
  function hash(text){let n=2166136261;for(const c of String(text)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
  function random(seed){let n=hash(seed)||1;return()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return(n>>>0)/4294967296;};}
  function shuffle(values,seed){const out=values.slice(),rand=random(seed);for(let i=out.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
  const utcDay=now=>new Date(now??Date.now()).toISOString().slice(0,10);
  function blank(){return{schema:SCHEMA,gameVersion:VERSION,revision:0,updatedAt:0,settings:{effects:false,ambience:false,motion:'system',textSize:100},active:null,drafts:{},receipts:{},history:[],bests:{},mastery:{},review:[],briefings:[],daily:{},achievements:[]};}
  function safeTree(value){
    if(value===null||typeof value==='string'||typeof value==='boolean')return true;
    if(typeof value==='number')return finite(value);
    if(Array.isArray(value))return value.every(safeTree);
    return object(value)&&Object.entries(value).every(([key,item])=>id(key)&&safeTree(item));
  }
  function validScore(value){return object(value)&&finite(value.score)&&finite(value.maxScore)&&value.maxScore>0&&value.score>=0&&value.score<=value.maxScore;}
  function validAnswer(value){return object(value)&&(!own(value,'evidenceIds')||ids(value.evidenceIds))&&(!own(value,'uncertaintyIds')||ids(value.uncertaintyIds));}
  function validPlan(value){
    if(!object(value)||!/^\d{4}-\d{2}-\d{2}$/.test(value.date)||value.gameVersion!==VERSION||!id(value.contentVersion)||!id(value.atlasVersion)||!ids(value.quickIds)||!ids(value.countryIds)||new Set(value.quickIds).size!==value.quickIds.length||new Set(value.countryIds).size!==value.countryIds.length)return false;
    const midnight=Date.parse(value.date+'T00:00:00Z');
    return Number.isFinite(midnight)&&utcDay(midnight)===value.date&&value.seed===[VERSION,value.contentVersion,value.atlasVersion,value.date].join(':')&&value.changesAt===new Date(midnight+86400000).toISOString();
  }
  function validRun(value){
    if(!object(value)||!id(value.id)||!id(value.kind)||value.gameVersion!==VERSION||!id(value.contentVersion)||typeof value.seed!=='string'||!time(value.startedAt)||!['active','feedback','complete'].includes(value.phase))return false;
    for(const key of ['index','stageIndex','decisionStep'])if(own(value,key)&&(!Number.isInteger(value[key])||value[key]<0))return false;
    for(const key of ['ids','targets'])if(own(value,key)&&!ids(value[key]))return false;
    if(own(value,'selection')&&!validAnswer(value.selection))return false;
    if(own(value,'answers')&&(!object(value.answers)||!Object.values(value.answers).every(record=>object(record)&&validAnswer(record.answer)&&Array.isArray(record.answer.evidenceIds)&&validScore(record.result))))return false;
    if(own(value,'atlasState')&&!object(value.atlasState))return false; // Atlas validates its own edition and transitions on restore.
    if(own(value,'dailyPlan')&&!validPlan(value.dailyPlan)||own(value,'dailyFactResult')&&!validScore(value.dailyFactResult))return false;
    return true;
  }
  function eligibleRecall(record){return record.ruleVersion===2&&record.correct===true&&record.assistance===0&&record.attempts===1&&!record.hinted&&!record.revealed&&id(record.mode)&&time(record.at)&&id(record.runId);}
  function describeMastery(value){
    const next=copy(value),independent=next.history.filter(eligibleRecall);
    next.independentDays=[...new Set(independent.map(record=>utcDay(record.at)))];
    next.recalled=independent.some(a=>independent.some(b=>a.runId!==b.runId&&a.mode===b.mode&&b.at-a.at>=86400000));
    next.label=next.recalled?'Recalled independently':independent.length?'Found independently':next.history.some(record=>record.correct||record.helped)?'Found with help':'Seen';return next;
  }
  function validate(raw){
    try{
      if(!object(raw)||!safeTree(raw)||raw.schema!==SCHEMA||raw.gameVersion!==VERSION||!Array.isArray(raw.history)||!object(raw.receipts))return null;
      const base=blank();for(const key of Object.keys(base))if(own(raw,key))base[key]=copy(raw[key]);
      if(!object(base.settings)||!Number.isInteger(base.revision)||base.revision<0||!time(base.updatedAt))return null;
      for(const key of ['drafts','receipts','bests','mastery','daily'])if(!object(base[key]))return null;
      for(const key of ['history','review','briefings','achievements'])if(!Array.isArray(base[key]))return null;
      if(base.active!==null&&!validRun(base.active)||!Object.entries(base.drafts).every(([key,run])=>validRun(run)&&key===run.id))return null;
      if(!Object.values(base.receipts).every(value=>value===true)||!Object.values(base.bests).every(value=>finite(value)&&value>=0))return null;
      if(!base.history.every(record=>validScore(record)&&id(record.runId)&&id(record.kind)&&id(record.mode)&&id(record.contentVersion)&&time(record.finishedAt)&&(!own(record,'results')||Array.isArray(record.results)&&record.results.every(row=>object(row)&&id(row.id)&&typeof row.correct==='boolean'))))return null;
      if(!base.review.every(record=>object(record)&&id(record.id)&&id(record.kind)&&time(record.at))||!base.briefings.every(object)||!ids(base.achievements))return null;
      if(!Object.values(base.daily).every(record=>object(record)&&typeof record.complete==='boolean'&&id(record.seed)))return null;
      if(!Object.values(base.mastery).every(entry=>object(entry)&&Number.isInteger(entry.seen)&&entry.seen>=0&&Array.isArray(entry.independentDays)&&entry.independentDays.every(day=>typeof day==='string')&&Array.isArray(entry.history)&&entry.history.every(record=>object(record)&&id(record.runId)&&time(record.at))))return null;
      for(const record of base.history){const existingBrief=record.briefing||base.briefings.find(b=>b.runId===record.runId);if(record.kind==='mission'&&existingBrief?.missionId)record.missionId=existingBrief.missionId;if(record.briefing){if(!base.briefings.some(b=>b.runId===record.runId))base.briefings.push({...record.briefing,runId:record.runId,savedAt:record.finishedAt});record.briefingRef=record.runId;delete record.briefing;}}
      base.settings={effects:base.settings.effects===true,ambience:base.settings.ambience===true,motion:['system','reduce'].includes(base.settings.motion)?base.settings.motion:'system',textSize:[100,115,130].includes(base.settings.textSize)?base.settings.textSize:100};
      // Preserve old result history; date-only mastery does not establish the current recall rule.
      for(const key of Object.keys(base.mastery))base.mastery[key]=describeMastery(base.mastery[key]);
      if(!Object.values(base.mastery).some(entry=>entry.recalled))base.achievements=base.achievements.filter(value=>value!=='returned-and-recalled');
      return base;
    }catch(_){return null;}
  }
  function load(storage){
    let raw;try{raw=storage.getItem(KEY);}catch(error){return{book:blank(),status:'unavailable',message:error.message};}
    if(raw===null||raw===undefined)return{book:blank(),status:'new'};
    try{const value=validate(JSON.parse(raw));return value?{book:value,status:'restored'}:{book:blank(),status:'recovery',raw};}catch(error){return{book:blank(),status:'recovery',raw,message:error.message};}
  }
  function needsReview(rows){return rows.some(row=>!row.correct||row.assistance!==undefined&&row.assistance!==0&&row.assistance!=='none'||row.hinted||row.revealed||row.attempts>1);}
  function mergeBooks(local,remote){
    const left=validate(local),right=validate(remote);if(!left||!right)throw new Error('An unreadable notebook cannot be merged');
    const next=copy(left),completed=new Map();
    // Earliest completion wins a duplicated run. Receipts survive the bounded history shelf.
    for(const record of [...right.history,...left.history].sort((a,b)=>a.finishedAt-b.finishedAt))if(!completed.has(record.runId))completed.set(record.runId,record);
    next.receipts={...right.receipts,...left.receipts};for(const runId of completed.keys())next.receipts[runId]=true;
    next.history=[...completed.values()].sort((a,b)=>b.finishedAt-a.finishedAt).slice(0,200);
    next.drafts={...right.drafts,...left.drafts};
    if(right.active&&right.active.id!==left.active?.id)next.drafts[right.active.id]=right.active;
    for(const runId of Object.keys(next.drafts))if(own(next.receipts,runId)||runId===next.active?.id)delete next.drafts[runId];
    if(next.active&&own(next.receipts,next.active.id))next.active=null;
    for(const [key,value] of Object.entries(right.bests))next.bests[key]=Math.max(next.bests[key]||0,value);
    for(const key of new Set([...Object.keys(left.mastery),...Object.keys(right.mastery)])){
      const a=left.mastery[key],b=right.mastery[key],records=new Map();
      for(const row of [...(b?.history||[]),...(a?.history||[])].sort((x,y)=>x.at-y.at))if(!records.has(row.runId))records.set(row.runId,row);
      const history=[...records.values()].sort((x,y)=>x.at-y.at).slice(-40);
      next.mastery[key]=describeMastery({seen:Math.max(a?.seen||0,b?.seen||0,history.length),independentDays:[],history,label:'Seen'});
    }
    const reviews=new Map();
    for(const row of [...right.review,...left.review].sort((a,b)=>a.at-b.at))reviews.set(row.kind+':'+row.id,row);
    for(const record of [...completed.values()].sort((a,b)=>a.finishedAt-b.finishedAt)){
      const rows=(record.results||[]).filter(row=>!row.review);
      for(const itemId of new Set(rows.map(row=>row.id))){const key=record.kind+':'+itemId;if((reviews.get(key)?.at||0)>record.finishedAt)continue;if(needsReview(rows.filter(row=>row.id===itemId)))reviews.set(key,{kind:record.kind,id:itemId,at:record.finishedAt});else reviews.delete(key);}
    }
    next.review=[...reviews.values()].sort((a,b)=>a.at-b.at);
    const briefs=new Map();for(const brief of [...right.briefings,...left.briefings].sort((a,b)=>(a.savedAt||0)-(b.savedAt||0)))if(!briefs.has(brief.runId))briefs.set(brief.runId,brief);
    next.briefings=[...briefs.values()].sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));
    next.daily={...right.daily,...left.daily};for(const [date,record] of Object.entries(right.daily))if(record.complete)next.daily[date]=record;
    next.achievements=[...new Set([...right.achievements,...left.achievements])].filter(value=>value!=='returned-and-recalled');
    if(Object.values(next.mastery).some(entry=>entry.recalled))next.achievements.push('returned-and-recalled');
    next.revision=Math.max(left.revision,right.revision);next.updatedAt=Math.max(left.updatedAt,right.updatedAt);return next;
  }
  function save(storage,book,options={}){
    try{
      let next=validate(copy(book));if(!next)return{ok:false,book,status:'invalid',message:'The current notebook could not be validated. The saved copy was not changed.'};
      if(options.merge!==false){const remote=load(storage);if(remote.status==='recovery')return{ok:false,book,status:'recovery',raw:remote.raw,message:'Another saved notebook could not be read. It has been preserved for export.'};if(remote.status==='unavailable')return{ok:false,book,status:'unavailable',message:remote.message};if(remote.status==='restored')next=mergeBooks(next,remote.book);}
      next.revision+=1;next.updatedAt=Date.now();storage.setItem(KEY,JSON.stringify(next));return{ok:true,book:next};
    }catch(error){return{ok:false,book,message:error.message};}
  }
  function newRun(kind,options={}){const now=options.now??Date.now();if(!id(kind)||!time(now)||options.id!==undefined&&!id(options.id))throw new Error('Invalid run identity');return{...options,id:options.id||kind+'-'+now.toString(36)+'-'+Math.random().toString(36).slice(2,7),kind,gameVersion:VERSION,contentVersion:String(options.contentVersion??'1'),seed:String(options.seed??now),startedAt:now,phase:'active'};}
  function exactSet(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&new Set(a).size===a.length&&a.every(id=>b.includes(id));}
  function gradeStage(stage,answer={}){
    const r=stage.rubric,weight=stage.weight??100,hasStep=Boolean(stage.verification),max=hasStep?100:90;
    if(!Number.isInteger(weight)||weight<=0||weight>100)throw new Error('Invalid stage weight');
    const chosen=Array.isArray(answer.evidenceIds)?answer.evidenceIds:[];
    const verdict=answer.verdict===r.verdict?60:0;
    const evidence=chosen.length<=(r.maxEvidence||2)&&exactSet(chosen,r.decisiveEvidenceIds)?20:0;
    const reason=answer.reasonId===r.reasonId?10:0;
    const verification=hasStep&&answer.verificationAnswer===r.verificationAnswer?10:0;
    const score=Math.round(weight*(verdict+evidence+reason+verification)/max);
    // Largest-remainder allocation makes displayed components sum to the rounded score.
    const parts=Object.entries({verdict,evidence,reason,verification}).map(([key,value],order)=>({key,order,exact:weight*value/max}));
    const breakdown=Object.fromEntries(parts.map(part=>[part.key,Math.floor(part.exact)]));
    let remaining=score-Object.values(breakdown).reduce((sum,value)=>sum+value,0);
    for(const part of parts.slice().sort((a,b)=>(b.exact-Math.floor(b.exact))-(a.exact-Math.floor(a.exact))||a.order-b.order))if(remaining-->0)breakdown[part.key]++;
    return{score,maxScore:weight,verdictCorrect:verdict>0,evidenceCorrect:evidence>0,reasonCorrect:reason>0,verificationCorrect:verification>0,breakdown,expected:r.verdict,confidence:['unsure','fairly sure','very sure'].includes(answer.confidence)?answer.confidence:'unsure'};
  }
  function answerStage(run,stage,answer){
    const next=copy(run);next.answers=next.answers||{};
    if(!id(stage.id))throw new Error('Invalid stage identity');
    if(own(next.answers,stage.id)||next.phase!=='active')return next;
    const submitted=copy(answer);submitted.evidenceIds=Array.isArray(submitted.evidenceIds)?submitted.evidenceIds:[];
    next.answers[stage.id]={answer:submitted,result:gradeStage(stage,submitted)};next.phase='feedback';return next;
  }
  function selectBank(items,count,seed,previous=[]){const old=new Set(previous),unique=items.filter((item,index)=>id(item.id)&&items.findIndex(other=>other.id===item.id)===index);return shuffle(unique.filter(x=>!old.has(x.id)),seed).concat(shuffle(unique.filter(x=>old.has(x.id)),String(seed)+'repeat')).slice(0,Math.max(0,Math.floor(count))).map(x=>x.id);}
  function dailyPlan({now,contentVersion,atlasVersion,quickIds,countryIds}){const date=utcDay(now),seed=[VERSION,contentVersion,atlasVersion,date].join(':');return{date,seed,gameVersion:VERSION,contentVersion,atlasVersion,quickIds:shuffle([...new Set(quickIds)],seed+':facts').slice(0,3),countryIds:shuffle([...new Set(countryIds)],seed+':atlas').slice(0,5),changesAt:new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString()};}
  function updateMastery(entry,result,run,now=Date.now()){
    const next=entry?copy(entry):{seen:0,independentDays:[],history:[],label:'Seen'};
    if(next.history.some(record=>record.runId===run.id))return describeMastery(next);
    if(!time(now))throw new Error('Invalid recall time');
    const assistance=result.assistance===0||result.assistance==='none'?0:result.assistance;
    const helped=assistance!==0||Boolean(result.hinted)||Boolean(result.revealed)||result.attempts>1;
    const record={ruleVersion:2,runId:run.id,day:utcDay(now),at:now,mode:run.mode||result.mode||null,contentVersion:run.contentVersion,correct:result.correct===true,assistance:assistance??null,attempts:result.attempts??null,hinted:Boolean(result.hinted),revealed:Boolean(result.revealed),helped};
    record.independent=eligibleRecall(record);next.seen++;next.history.push(record);next.history=next.history.slice(-40);return describeMastery(next);
  }
  function complete(book,run,result,now=Date.now()){
    const next=copy(book);if(!id(run.id))throw new Error('Invalid run identity');if(own(next.receipts,run.id))return next;
    const record={...copy(result),...(run.missionId?{missionId:run.missionId}:{}),...(run.caseId?{caseId:run.caseId}:{}),runId:run.id,kind:run.kind,mode:result.mode||run.mode||run.kind,seed:run.seed,contentVersion:run.contentVersion,finishedAt:now};
    if(!validScore(record)||!time(now))throw new Error('Invalid result score or time');
    if(own(record,'results')&&(!Array.isArray(record.results)||!record.results.every(row=>object(row)&&id(row.id)&&typeof row.correct==='boolean')))throw new Error('Invalid result items');
    if(record.breakdown&&(!object(record.breakdown)||!Object.values(record.breakdown).every(value=>finite(value)&&value>=0)||Math.abs(Object.values(record.breakdown).reduce((sum,value)=>sum+value,0)-record.score)>1e-8))throw new Error('Result breakdown does not match total');
    next.receipts[run.id]=true;next.history.unshift(record);next.history=next.history.slice(0,200);
    const category=[record.mode,record.contentVersion,record.inputMode||'standard'].join(':');next.bests[category]=Math.max(next.bests[category]||0,record.score);
    const primaryRows=(record.results||[]).filter(row=>!row.review);
    if(run.kind==='atlas')for(const row of primaryRows)next.mastery[row.id]=updateMastery(next.mastery[row.id],row,run,now);
    for(const itemId of new Set(primaryRows.map(row=>row.id))){
      const reviewNeeded=needsReview(primaryRows.filter(row=>row.id===itemId));
      next.review=next.review.filter(row=>!(row.id===itemId&&row.kind===run.kind));if(reviewNeeded)next.review.push({kind:run.kind,id:itemId,at:now});
    }
    if(record.briefing){next.briefings.unshift({...record.briefing,runId:run.id,savedAt:now});record.briefingRef=run.id;delete record.briefing;}
    if(record.score===record.maxScore&&!next.achievements.includes('careful-reader'))next.achievements.push('careful-reader');
    if(Object.values(next.mastery).some(entry=>entry.recalled)&&!next.achievements.includes('returned-and-recalled'))next.achievements.push('returned-and-recalled');
    if(next.briefings.length&&!next.achievements.includes('filed-with-evidence'))next.achievements.push('filed-with-evidence');
    delete next.drafts[run.id];if(next.active?.id===run.id)next.active=null;return next;
  }
  return{VERSION,KEY,SCHEMA,blank,validate,load,save,mergeBooks,newRun,hash,random,shuffle,utcDay,exactSet,gradeStage,answerStage,selectBank,dailyPlan,updateMastery,complete,copy};
});
