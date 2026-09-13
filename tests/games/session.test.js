'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const S=require('../../games/session');
const C=require('../../games/content');
const A=require('../../games/atlas');
const D=require('../../games/data/atlas-data');

function storage(value=null){return{value,writes:0,getItem(key){assert.equal(key,S.KEY);return this.value;},setItem(key,next){assert.equal(key,S.KEY);this.value=next;this.writes++;}};}
function run(id='run-a',kind='case',options={}){return S.newRun(kind,{id,now:1000,seed:0,contentVersion:'test-edition',mode:kind==='atlas'?'expedition':'case-files',...options});}
const fullResult={score:100,maxScore:100,correct:1,total:1,results:[{id:'one-frame',correct:true,assistance:0}]};
const independent={id:'USA',correct:true,assistance:0,attempts:1,score:100};
const answer=stage=>({verdict:stage.rubric.verdict,evidenceIds:stage.rubric.decisiveEvidenceIds,reasonId:stage.rubric.reasonId,verificationAnswer:stage.rubric.verificationAnswer,confidence:'unsure'});
const planOptions={now:Date.parse('2026-09-13T00:01:00Z'),contentVersion:'case-edition',atlasVersion:'atlas-edition',quickIds:['q1','q2','q3','q4','q5','q6'],countryIds:['USA','CAN','IDN','MDG','CIV','FRA','AUS']};

test('malformed JSON, empty bytes, and wrong editions remain available for exact export without writes',()=>{
  for(const raw of ['{unfinished','',JSON.stringify({...S.blank(),gameVersion:'old-edition'})]){
    const memory=storage(raw),result=S.load(memory);
    assert.equal(result.status,'recovery');assert.equal(result.raw,raw);assert.equal(memory.value,raw);assert.equal(memory.writes,0);
  }
  assert.equal(S.load(storage()).status,'new');
  assert.equal(S.load({getItem(){throw Error('blocked');}}).status,'unavailable');
});

test('malformed nested containers and answer records enter recovery without discarding the original notebook',()=>{
  const healthy=S.blank();healthy.active=run('case-save','case',{caseId:'archive-frame',answers:{},selection:{evidenceIds:[]}});
  const bad=[b=>b.drafts=null,b=>b.drafts={draft:[]},b=>b.receipts=[],b=>b.history=[null],b=>b.mastery={USA:{history:null}},b=>b.review=[{id:'USA'}],b=>b.daily={today:null},b=>b.active.selection.evidenceIds={},b=>b.active.answers={snapshot:{answer:{evidenceIds:null},result:{score:40,maxScore:40}}},b=>b.active.atlasState=[],b=>b.active.index=-1];
  for(const mutate of bad){const changed=S.copy(healthy);mutate(changed);const raw=JSON.stringify(changed),memory=storage(raw);assert.equal(S.load(memory).status,'recovery',raw);assert.equal(memory.value,raw);assert.equal(memory.writes,0);}
  const poison=JSON.stringify(healthy).replace('"receipts":{}','"receipts":{"__proto__":true}');assert.equal(S.load(storage(poison)).status,'recovery');
  assert.deepEqual(S.validate(healthy),healthy);
});

test('saved first case restores through feedback and awards each stage once for a fixed total',()=>{
  const file=C.getCase('archive-frame');let current=run('case-flow','case',{caseId:file.id,contentVersion:C.version,answers:{},selection:{evidenceIds:[]},stageIndex:0});
  const before=S.copy(current);current=S.answerStage(current,file.stages[0],answer(file.stages[0]));assert.deepEqual(before.answers,{});
  const doubled=S.answerStage(current,file.stages[0],{verdict:'false',evidenceIds:[]});assert.deepEqual(doubled,current);
  assert.deepEqual(S.answerStage(current,file.stages[1],answer(file.stages[1])),current,'cannot answer another stage while still in feedback');
  const memory=storage(),book=S.blank();book.active=current;assert.equal(S.save(memory,book).ok,true);
  current=S.load(memory).book.active;current.phase='active';current.stageIndex=1;current=S.answerStage(current,file.stages[1],answer(file.stages[1]));
  assert.equal(Object.values(current.answers).reduce((sum,item)=>sum+item.result.score,0),100);
  assert.equal(current.phase,'feedback');
});

test('score components always add to total, including partial weighted stages and no verification step',()=>{
  const source=C.getCase('archive-frame').stages[0];
  for(const weight of [1,7,33,40,60,100])for(const verification of [true,false])for(let mask=0;mask<16;mask++){
    const stage={...source,weight,verification:verification?source.verification:null},a=answer(stage);
    if(mask&1)a.verdict='wrong';if(mask&2)a.evidenceIds=[];if(mask&4)a.reasonId='wrong';if(mask&8)a.verificationAnswer='wrong';
    const graded=S.gradeStage(stage,a);
    assert.equal(Object.values(graded.breakdown).reduce((sum,value)=>sum+value,0),graded.score);
    assert.ok(graded.score>=0&&graded.score<=weight);
    for(const confidence of ['unsure','fairly sure','very sure','invented-confidence'])assert.equal(S.gradeStage(stage,{...a,confidence}).score,graded.score);
  }
  const perfect=S.gradeStage({...source,verification:null,weight:100},answer(source));assert.equal(perfect.score,100);assert.equal(perfect.breakdown.verification,0);
  assert.equal(S.gradeStage(source,{...answer(source),evidenceIds:[...source.rubric.decisiveEvidenceIds,...source.rubric.decisiveEvidenceIds]}).evidenceCorrect,false);
});

test('completion receipts remain exactly once across reload and do not erase another active run',()=>{
  const memory=storage(),original=run(),other=run('other-run','mission');let book=S.blank();book.active=other;book.drafts[original.id]=original;
  book=S.complete(book,original,fullResult,2000);assert.equal(book.history.length,1);assert.equal(book.active.id,other.id);assert.equal(book.drafts[original.id],undefined);
  const once=S.save(memory,book);assert.equal(once.ok,true);book=S.load(memory).book;
  const again=S.complete(book,original,{...fullResult,score:0},9000);assert.deepEqual(again,book);assert.equal(again.history[0].score,100);
  assert.deepEqual(again.achievements,['careful-reader']);
  for(const result of [{score:0,maxScore:0},{score:NaN,maxScore:100},{score:101,maxScore:100},{...fullResult,results:null},{...fullResult,breakdown:{verdict:90}}])assert.throws(()=>S.complete(S.blank(),run(),result,2000));
  assert.throws(()=>S.complete(S.blank(),{...run(),id:'__proto__'},fullResult));
});

test('case review preserves an earlier missed snapshot even when a later snapshot is correct',()=>{
  const result={...fullResult,score:60,results:[{id:'archive-frame',correct:false,assistance:0},{id:'archive-frame',correct:true,assistance:0}]};
  let book=S.complete(S.blank(),run(),result,2000);assert.equal(book.review.length,1);
  book=S.complete(book,run('retry'),{...fullResult,results:[{id:'archive-frame',correct:true,assistance:0}]},3000);assert.equal(book.review.length,0);
});

test('independent recall requires first attempts in distinct sessions of the same mode separated by 24 hours',()=>{
  const midnight=Date.parse('2026-09-13T23:59:30Z'),first=run('first','atlas');
  let entry=S.updateMastery(null,independent,first,midnight);assert.equal(entry.label,'Found independently');
  entry=S.updateMastery(entry,independent,run('seconds-later','atlas'),midnight+60000);assert.equal(entry.recalled,false);assert.equal(entry.independentDays.length,2);
  const cross=S.updateMastery(entry,independent,run('different-mode','atlas',{mode:'typing'}),midnight+86400000);assert.equal(cross.recalled,false);
  const tooSoon=S.updateMastery(entry,independent,run('too-soon','atlas'),midnight+86399999);assert.equal(tooSoon.recalled,false);
  const recalled=S.updateMastery(entry,independent,run('next-day','atlas'),midnight+86400000);assert.equal(recalled.recalled,true);assert.equal(recalled.label,'Recalled independently');
  assert.deepEqual(S.updateMastery(recalled,independent,first,midnight+172800000),recalled);
  for(const changes of [{assistance:1},{assistance:3},{attempts:2},{attempts:0},{attempts:undefined},{assistance:undefined},{hinted:true},{revealed:true},{correct:false}]){
    const changed=S.updateMastery(entry,{...independent,...changes},run('assisted','atlas'),midnight+86400000);assert.equal(changed.recalled,false,JSON.stringify(changes));
  }
});

test('Atlas summary compatibility: daily wrapper uses actual mode and unscored reviews cannot upgrade mastery',()=>{
  let state=A.create(D,{targets:['USA'],mode:'expedition',sessionId:'atlas-first',now:1000});
  state=A.answer(D,state,{type:'guess',value:'USA'});state=A.next(state);const result=A.summary(state);
  let book=S.complete(S.blank(),run('daily-a','atlas'),{...result,mode:'daily-dispatch'},1000);assert.equal(book.mastery.USA.label,'Found independently');assert.equal(book.mastery.USA.history[0].mode,'expedition');
  book=S.complete(book,run('normal-b','atlas'),result,86401000);assert.equal(book.mastery.USA.recalled,true);
  assert.ok(book.achievements.includes('returned-and-recalled'));
  const reveal={...result,score:0,results:[{...independent,correct:false,assistance:3,attempts:0,score:0}],reviewResults:[independent]};
  const helped=S.complete(S.blank(),run('review-run','atlas'),reveal,1000);assert.equal(helped.mastery.USA.label,'Found with help');assert.equal(helped.mastery.USA.history.length,1);assert.equal(helped.review.length,1);
});

test('legacy date-only mastery preserves history but cannot substantiate the new recall rule',()=>{
  const book=S.blank();book.mastery.USA={seen:2,independentDays:['2026-09-13','2026-09-14'],history:[{runId:'old-a',at:1000,independent:true,helped:false},{runId:'old-b',at:61000,independent:true,helped:false}],label:'Recalled on another day'};book.achievements=['returned-and-recalled'];
  const restored=S.validate(book);assert.deepEqual(restored.mastery.USA.history,book.mastery.USA.history);assert.equal(restored.mastery.USA.recalled,false);assert.equal(restored.achievements.length,0);assert.equal(book.mastery.USA.label,'Recalled on another day');
});

test('daily plan is deterministic, edition-bound, unique, UTC-based and remains locked through reload',()=>{
  const plan=S.dailyPlan(planOptions);assert.deepEqual(S.dailyPlan({...planOptions,now:Date.parse('2026-09-13T23:59:59.999Z')}),plan);
  assert.equal(plan.changesAt,'2026-09-14T00:00:00.000Z');assert.equal(plan.quickIds.length,3);assert.equal(new Set(plan.countryIds).size,5);
  assert.notEqual(S.dailyPlan({...planOptions,now:Date.parse(plan.changesAt)}).seed,plan.seed);
  assert.notEqual(S.dailyPlan({...planOptions,contentVersion:'new-edition'}).seed,plan.seed);
  assert.notEqual(S.dailyPlan({...planOptions,atlasVersion:'new-map'}).seed,plan.seed);
  const book=S.blank();book.active=run('daily-locked','quick',{mode:'daily',dailyPlan:plan,seed:plan.seed,ids:plan.quickIds});const memory=storage();assert.equal(S.save(memory,book).ok,true);assert.deepEqual(S.load(memory).book.active.dailyPlan,plan);
  const malformed=S.copy(book);malformed.active.dailyPlan.date='2026-02-31';assert.equal(S.validate(malformed),null);
  assert.equal(run().seed,'0');assert.equal(run('zero','case',{now:0}).startedAt,0);
  const items=Array.from({length:10},(_,i)=>({id:'item-'+i}));const selected=S.selectBank(items,5,'shared',['item-0','item-1']);assert.deepEqual(selected,S.selectBank(items,5,'shared',['item-0','item-1']));assert.ok(!selected.includes('item-0')&&!selected.includes('item-1'));
  assert.equal(new Set(S.selectBank(items.concat(items),20,'shared')).size,10);
});

test('two tabs merge completed history, receipts, mastery and separate unfinished work without mutating inputs',()=>{
  const memory=storage(),atlasRun=run('tab-a','atlas'),caseRun=run('tab-b');let a=S.blank(),b=S.blank();
  a=S.complete(a,atlasRun,{...fullResult,results:[independent]},1000);a.active=run('unfinished-a','mission');
  const savedA=S.save(memory,a);assert.equal(savedA.ok,true);
  b=S.complete(b,caseRun,fullResult,2000);b.active=run('unfinished-b','case');const original=S.copy(b);
  const savedB=S.save(memory,b);assert.equal(savedB.ok,true);assert.deepEqual(b,original);assert.equal(savedB.book.history.length,2);assert.equal(Object.keys(savedB.book.receipts).length,2);assert.equal(savedB.book.active.id,'unfinished-b');assert.equal(savedB.book.drafts['unfinished-a'].kind,'mission');assert.equal(savedB.book.mastery.USA.label,'Found independently');
  const fresh=S.save(memory,savedA.book);assert.equal(fresh.book.history.length,2);assert.equal(fresh.book.active.id,'unfinished-a');assert.ok(fresh.book.drafts['unfinished-b']);assert.ok(fresh.book.revision>savedB.book.revision);
  const duplicate=S.complete(fresh.book,caseRun,{...fullResult,score:0},3000);assert.equal(duplicate.history.length,2);
});

test('merge respects first completion, terminal receipts, latest review outcomes and independent recall across tabs',()=>{
  const same=run('same-run','atlas');let left=S.complete(S.blank(),same,{...fullResult,results:[independent]},1000),right=S.complete(S.blank(),same,{...fullResult,score:0,results:[{...independent,correct:false}]},2000);
  right.active=same;right.drafts[same.id]=same;
  const first=S.mergeBooks(left,right);assert.equal(first.history.length,1);assert.equal(first.history[0].score,100);assert.equal(first.active,null);assert.equal(first.drafts[same.id],undefined);
  left=S.complete(S.blank(),run('left','atlas'),{...fullResult,results:[independent]},1000);
  right=S.complete(S.blank(),run('right','atlas'),{...fullResult,results:[independent]},86401000);
  assert.equal(S.mergeBooks(left,right).mastery.USA.recalled,true);
  const miss=S.complete(S.blank(),run('miss'),{...fullResult,score:0,results:[{id:'one-frame',correct:false}]},1000),fix=S.complete(S.blank(),run('fixed'),fullResult,2000);
  assert.equal(S.mergeBooks(miss,fix).review.length,0);
});

test('save refuses to overwrite corrupted external state, handles quota and supports explicit replacement',()=>{
  const memory=storage('{corrupted-in-other-tab'),book=S.blank(),failed=S.save(memory,book);
  assert.equal(failed.ok,false);assert.equal(failed.status,'recovery');assert.equal(failed.raw,memory.value);assert.equal(memory.writes,0);
  const replaced=S.save(memory,book,{merge:false});assert.equal(replaced.ok,true);assert.equal(S.load(memory).status,'restored');
  const quota={getItem(){return null;},setItem(){throw Error('quota exceeded');}},full=S.save(quota,book);assert.equal(full.ok,false);assert.equal(full.book,book);assert.match(full.message,/quota/);
  const old=S.complete(S.blank(),run(),fullResult,1000),stored=storage(JSON.stringify(old));assert.equal(S.save(stored,S.blank(),{merge:false}).book.history.length,0);
});

test('browser UMD exposes the same standalone state and merge contract',()=>{const context={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../../games/session'),'utf8'),context);assert.equal(context.window.NoteworthyGameState.VERSION,S.VERSION);assert.equal(typeof context.window.NoteworthyGameState.mergeBooks,'function');assert.equal(context.window.NoteworthyGameState.blank().history.length,0);});

test('briefings are stored once with reversible legacy recovery and retain campaign identity',()=>{
 const run=S.newRun('mission',{id:'dedup-mission',missionId:'waterline-briefing',contentVersion:'test',now:1000});
 const brief={missionId:'waterline-briefing',title:'A bounded record',mapSvg:'<svg></svg>',sourceDocuments:[{id:'document',body:'preserve me'}]};
 const completed=S.complete(S.blank(),run,{score:100,maxScore:100,mode:'integrated-investigation',breakdown:{conclusion:40,spatial:20,experiment:20,uncertainty:20},briefing:brief},2000);
 assert.equal(completed.history[0].missionId,'waterline-briefing');assert.equal(completed.history[0].briefingRef,run.id);assert.equal(completed.history[0].briefing,undefined);assert.deepEqual(completed.briefings[0].sourceDocuments,brief.sourceDocuments);
 const legacy=S.copy(completed);legacy.history[0].briefing=brief;delete legacy.history[0].briefingRef;delete legacy.history[0].missionId;legacy.briefings=[];
 const restored=S.validate(legacy);assert.equal(restored.briefings.length,1);assert.equal(restored.history[0].missionId,'waterline-briefing');assert.equal(restored.history[0].briefing,undefined);assert.deepEqual(legacy.history[0].briefing,brief);
});
