/* Classroom controller. Static content and local-only drafts; no account required. */
(() => {
  'use strict';
  const content = window.EURO_CLASSROOM_CONTENT;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const plain = value => { const el = document.createElement('div'); el.innerHTML = String(value ?? ''); return el.textContent; };
  const labels = {overview:'Overview',study:'Study guide',practice:'Practice',writing:'Writing lab',exam:'Exam guide',tables:'Reference library',cram:'Quick review',saved:'Saved for review',search:'Search results'};
  const views = {overview:'vOverview',study:'vStudy',practice:'vPractice',writing:'vWriting',exam:'vExam',tables:'vTables',cram:'vCram',saved:'vSaved',search:'vSearch'};
  const legacyStudy = renderStudy;
  const legacyOpenDetail = openDetail;
  const legacyCloseDetail = closeDetail;
  let ready = false;
  let catalog = [];
  let returnFocus = null;
  let writingUnit = 1;
  let practiceUnit = 0;
  let quiz = null;
  let queryTimer;
  const memory = new Map();
  function read(key, fallback) {
    if(memory.has(key))return memory.get(key);
    try { const value = JSON.parse(localStorage.getItem(key)); if(value !== null) return value; } catch (_) { /* Private browser mode or damaged saved state. */ }
    return memory.has(key) ? memory.get(key) : fallback;
  }
  function save(key, value) {
    memory.set(key,value);
    try { localStorage.setItem(key,JSON.stringify(value)); return true; } catch (_) { return false; }
  }
  function unitOptions(selected, all = true) {
    return `${all?'<option value="0">All nine units</option>':''}${content.units.map(u=>`<option value="${u.id}" ${u.id===selected?'selected':''}>Unit ${u.id}: ${esc(u.title)}</option>`).join('')}`;
  }
  function heading(kicker,title,description) {return `<div class="page-heading"><div class="eyebrow">${kicker}</div><h1 class="page-title" tabindex="-1">${title}</h1><p class="page-lead">${description}</p></div>`;}
  function announce(message) { $('liveStatus').textContent = message; }
  function navigate(view, options = {}) {
    if (!ready || !views[view]) return;
    clearTimeout(queryTimer);
    if (view !== 'search') { searchTerm=''; $('si').value=''; $('clearSearch').hidden=true; }
    currentView=view;
    document.querySelectorAll('.view').forEach(el=>el.classList.toggle('on',el.id===views[view]));
    document.querySelectorAll('.nb').forEach(b=>{b.classList.toggle('on',b.dataset.v===view);if(b.dataset.v===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    document.querySelectorAll('.ub').forEach(b=>{b.classList.toggle('on',view==='study' && Number(b.dataset.unit)===currentUnit);b.setAttribute('aria-pressed',String(view==='study'&&Number(b.dataset.unit)===currentUnit));});
    $('viewLabel').textContent=labels[view];
    ({overview:renderOverview,study:renderStudyPage,practice:renderPractice,writing:renderWriting,exam:renderExam,tables:renderTables,cram:renderCram,saved:renderSaved,search:renderSearch})[view]();
    $('main').scrollTop=0;
    if(!options.keepFocus) { const title=$(views[view]).querySelector('h1,h2'); if(title){title.tabIndex=-1;title.focus({preventScroll:true});} }
    if(options.updateURL !== false && view!=='search') {
      const hash = '#'+view+(view==='study'&&currentUnit?'?unit='+currentUnit:'');
      history.replaceState(null,'',hash);
    }
  }
  window.switchView=navigate;
  function selectUnit(id) {currentUnit=id;navigate('study');}
  function renderOverview() {
    $('vOverview').innerHTML=`<div class="welcome-grid"><div><div class="eyebrow">A LITTLE CONTEXT. A BIGGER PICTURE.</div><h1 class="page-title" tabindex="-1">History is connected.<br>Let’s make sense of it.</h1><p class="page-lead">Explore the ideas, conflicts, and people that shaped Europe. Build the evidence. Make your argument.</p><div class="hero-actions"><button class="btn primary" data-action="begin">Explore the course <span aria-hidden="true">→</span></button><button class="btn" data-view="practice">Start a practice session</button></div></div><aside class="session-card"><div class="eyebrow">TODAY’S THINKING ROUTINE</div><h2>Think like a historian.</h2><ol><li><strong>Notice</strong><span>What does the evidence show?</span></li><li><strong>Connect</strong><span>What caused it? What changed?</span></li><li><strong>Argue</strong><span>What claim can you support?</span></li></ol><button class="text-link" data-view="writing">Open the writing lab →</button></aside></div>
      <div class="section-heading"><h2>Your course, one unit at a time.</h2><span>9 units · c. 1450–present</span></div>
      <div class="unit-grid">${content.units.map(u=>`<button class="unit-card" data-unit="${u.id}"><div class="unit-card-top"><span class="unit-number">${String(u.id).padStart(2,'0')}</span><span class="unit-dates">${esc(u.dates)}</span></div><h3>${esc(u.title)}</h3><p>${esc(u.question)}</p><div class="unit-card-bottom"><span>Explore unit ${u.id}</span><span aria-hidden="true">↗</span></div></button>`).join('')}</div>
      <div class="path-strip"><div><span class="eyebrow">01 / UNDERSTAND</span><h3>Start with the context</h3><p>Place events in time and connect ideas across units.</p></div><div><span class="eyebrow">02 / PRACTICE</span><h3>Explain your reasoning</h3><p>Try original questions and learn from every explanation.</p></div><div><span class="eyebrow">03 / APPLY</span><h3>Build an argument</h3><p>Turn specific evidence into a defensible historical claim.</p></div></div>
      <section class="section-card teacher-plan"><div class="section-heading"><h2>Built for the classroom.</h2><span>One possible 20-minute routine</span></div><p>5 minutes: explore a unit with a partner. 8 minutes: answer and discuss the practice questions. 7 minutes: write an evidence-based exit ticket.</p><div class="toolbar"><button class="btn" data-view="writing">Create an exit ticket</button><button class="btn" data-view="cram">Open quick review</button><button class="btn" data-view="exam">See May 2027 exam changes</button></div></section>
      <p class="resource-note">Independent study resource; not affiliated with or endorsed by College Board. Practice questions are original, ungraded learning activities. Drafts and bookmarks are saved only in this browser when storage is available.</p>`;
    $('vOverview').querySelector('[data-action="begin"]').onclick=()=>selectUnit(1);
    bindActions($('vOverview'));
  }
  function bindActions(container) {
    container.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>navigate(b.dataset.view));
    container.querySelectorAll('[data-unit]').forEach(b=>b.onclick=()=>selectUnit(Number(b.dataset.unit)));
    container.querySelectorAll('[data-event]').forEach(b=>b.onclick=()=>openDetail(b.dataset.event));
  }
  function renderStudyPage() {
    if(!currentUnit) {
      legacyStudy();
      $('vStudy').querySelectorAll('.era-hdr').forEach(h=>{h.classList.add('collapsed');h.setAttribute('aria-expanded','false');h.nextElementSibling.classList.add('collapsed');});
      const expand=$('expandPeriods');
      expand.onclick=()=>{const open=expand.textContent.startsWith('Expand');$('vStudy').querySelectorAll('.era-hdr').forEach(h=>{h.classList.toggle('collapsed',!open);h.setAttribute('aria-expanded',String(open));h.nextElementSibling.classList.toggle('collapsed',!open);});expand.textContent=open?'Collapse all periods':'Expand all periods';};
      return;
    }
    const unit=content.units.find(u=>u.id===currentUnit);
    const events=DATA.filter(d=>d.apUnit===currentUnit).sort((a,b)=>a.startYear-b.startYear);
    const topics=CED_GAPS.filter(g=>Number(g.ced.split('.')[0])===currentUnit);
    $('vStudy').innerHTML=heading(`UNIT ${unit.id} / ${esc(unit.dates)}`,esc(unit.title),esc(unit.question))+
      `<section class="section-card unit-focus"><div class="eyebrow">FOCUS YOUR LEARNING</div><ul class="focus-list">${unit.focus.map(f=>`<li>${esc(f)}</li>`).join('')}</ul><div class="toolbar"><button class="btn primary" id="practiceThisUnit">Practice this unit →</button><button class="btn" id="writeThisUnit">Write an exit ticket</button><button class="btn" data-unit="0">Browse all periods</button></div></section><div class="section-heading"><h2>Events & connections</h2><span>${events.length} entries · select one to explore</span></div><p class="resource-note">Core, Supporting, and Extension are editorial study priorities. Some entries provide context outside the unit’s main date range.</p><div class="events-grid">${events.map(d=>`<button class="ec t${d.tier}" data-event="${esc(d.id)}" style="--ec-color:${UC[d.apUnit]}"><span class="ct"><span class="cd">${esc(d.date)}</span><span class="cti">${['','Core','Supporting','Extension'][d.tier]}</span></span><span class="cn">${esc(d.title)}</span><span class="event-summary">${esc(d.whyItMatters)}</span><span class="text-link">Explore evidence →</span></button>`).join('')}</div>${topics.length?`<div class="section-heading"><h2>Ideas to take further</h2><span>${topics.length} study notes</span></div><div class="g2">${topics.map(t=>`<article class="cc"><div class="eyebrow">UNIT ${currentUnit} STUDY NOTE</div><h3 class="cc-title">${t.title}</h3><p class="cc-desc">${t.desc}</p><details><summary>Make a historical connection</summary><p>${t.ap}</p></details></article>`).join('')}</div>`:''}`;
    $('practiceThisUnit').onclick=()=>{practiceUnit=currentUnit;quiz=null;navigate('practice');};
    $('writeThisUnit').onclick=()=>{writingUnit=currentUnit;navigate('writing');};
    bindActions($('vStudy'));
  }
  function renderPractice() {
    if(quiz) {renderQuestion();return;}
    $('vPractice').innerHTML=heading('RETRIEVE / REASON / REFLECT','Practice with a purpose.','Choose a unit, consider the evidence, and explain why an answer fits. No countdown. Space to think.')+`<section class="section-card practice-card"><label for="practiceUnit"><strong>What would you like to review?</strong></label><select id="practiceUnit">${unitOptions(practiceUnit)}</select><p id="practiceCount" class="resource-note"></p><div class="toolbar"><button class="btn primary" id="startPractice">Start practice →</button></div><p class="resource-note">Original questions for learning and discussion. This short set is not a full AP exam or a prediction of an AP score. Progress in the current practice session stays here while you switch tools.</p></section>`;
    const update=()=>{practiceUnit=Number($('practiceUnit').value);const n=content.practice.filter(q=>!practiceUnit||q.unit===practiceUnit).length;$('practiceCount').textContent=`${practiceUnit?n:Math.min(9,n)} questions with explanations · All-unit sessions sample one question from each unit.`;};
    $('practiceUnit').onchange=update;update();
    $('startPractice').onclick=()=>{
      const pool=content.practice.filter(q=>!practiceUnit||q.unit===practiceUnit);
      const questions=practiceUnit?pool:content.units.map(u=>{const choices=pool.filter(q=>q.unit===u.id);return choices[Math.floor(Math.random()*choices.length)];}).filter(Boolean);
      quiz={questions,index:0,answers:[],checked:false,finished:false};renderQuestion();focusQuestion();
    };
  }
  function focusQuestion() {const h=$('vPractice').querySelector('h1');if(h){h.tabIndex=-1;h.focus();}$('main').scrollTop=0;}
  function renderQuestion() {
    if(quiz.finished){renderPracticeSummary();return;}
    const q=quiz.questions[quiz.index];
    const selected=quiz.answers[quiz.index];
    const answered=quiz.checked;
    $('vPractice').innerHTML=`<div class="question-progress"><span>Question ${quiz.index+1} of ${quiz.questions.length}</span><span>Unit ${q.unit} · ${esc(q.skill)}</span></div><progress max="${quiz.questions.length}" value="${quiz.index}" aria-label="Questions completed"></progress><section class="section-card practice-card"><div class="eyebrow">TAKE A MOMENT. FOLLOW THE EVIDENCE.</div><h1 class="question-title" tabindex="-1">${esc(q.stem)}</h1><form id="answerForm"><fieldset ${answered?'disabled':''}><legend class="sr-only">Choose one answer</legend>${q.options.map((option,i)=>`<label class="answer-option ${answered&&i===q.answer?'correct':answered&&selected===i?'incorrect':''}"><input type="radio" name="answer" value="${i}" ${selected===i?'checked':''} required><span class="answer-letter">${'ABCD'[i]}</span><span>${esc(option)}${answered&&i===q.answer?' <strong>— Correct answer</strong>':''}${answered&&selected===i&&i!==q.answer?' <strong>— Your answer</strong>':''}</span></label>`).join('')}</fieldset>${answered?'':`<button class="btn primary" type="submit">Check answer</button>`}</form>${answered?`<div class="feedback ${selected===q.answer?'good':'retry'}" id="answerFeedback" tabindex="-1"><h2>${selected===q.answer?'That’s right. Here’s why.':'Use this as a learning moment.'}</h2><p>${esc(q.explanation)}</p>${q.source?`<a href="${esc(q.source.url)}" target="_blank" rel="noopener">${esc(q.source.label)} ↗</a>`:''}</div><button class="btn primary" id="nextQuestion">${quiz.index===quiz.questions.length-1?'See session review':'Next question →'}</button>`:''}</section><div class="toolbar"><button class="btn" id="endPractice">${quiz.answers.length?'Finish & review this session':'Back to practice setup'}</button></div>`;
    const form=$('answerForm');
    if(!answered) {
      form.onchange=()=>{quiz.answers[quiz.index]=Number(new FormData(form).get('answer'));};
      form.onsubmit=e=>{e.preventDefault();if(quiz.checked)return;const answer=new FormData(form).get('answer');if(answer===null)return;quiz.answers[quiz.index]=Number(answer);quiz.checked=true;renderQuestion();$('answerFeedback').focus();announce('Answer checked. '+(Number(answer)===q.answer?'Correct.':'Review the explanation.'));};
    } else $('nextQuestion').onclick=()=>{if(quiz.index===quiz.questions.length-1){quiz.finished=true;renderPracticeSummary();}else{quiz.index++;quiz.checked=false;renderQuestion();}focusQuestion();};
    $('endPractice').onclick=()=>{if(quiz.answers.length){if(!quiz.checked)quiz.answers.length=quiz.index;quiz.finished=true;renderPracticeSummary();}else{quiz=null;renderPractice();}focusQuestion();};
  }
  function renderPracticeSummary() {
    const completed=quiz.answers.length;
    const correct=quiz.answers.filter((a,i)=>a===quiz.questions[i].answer).length;
    $('vPractice').innerHTML=heading('SESSION REVIEW','Keep the reasoning.','Review the explanation, then name one connection you can now make.')+`<section class="section-card practice-summary"><h2>${correct} of ${completed} checked answers correct</h2><p>${completed} of ${quiz.questions.length} questions completed. This is practice feedback, not an AP score.</p><div class="toolbar"><button class="btn primary" id="newPractice">Start another session</button>${correct<completed?'<button class="btn" id="retryMissed">Retry missed questions</button>':''}<button class="btn" data-view="writing">Apply it in writing</button></div></section><div class="result-list">${quiz.questions.slice(0,completed).map((q,i)=>`<article class="section-card"><div class="eyebrow">UNIT ${q.unit} · ${quiz.answers[i]===q.answer?'CORRECT':'REVISIT'}</div><h2>${esc(q.stem)}</h2><p><strong>Your answer:</strong> ${esc(q.options[quiz.answers[i]])}</p><p><strong>Correct answer:</strong> ${esc(q.options[q.answer])}</p><p>${esc(q.explanation)}</p></article>`).join('')}</div>`;
    $('newPractice').onclick=()=>{quiz=null;renderPractice();focusQuestion();};
    if($('retryMissed'))$('retryMissed').onclick=()=>{const missed=quiz.questions.slice(0,completed).filter((q,i)=>quiz.answers[i]!==q.answer);quiz={questions:missed,index:0,answers:[],checked:false,finished:false};renderQuestion();focusQuestion();};
    bindActions($('vPractice'));
  }
  function renderWriting() {
    const prompt=content.writing.find(p=>p.unit===writingUnit);
    const stored=read('euro-writing-'+writingUnit,'');
    const value=typeof stored==='string'?stored:'';
    $('vWriting').innerHTML=heading('CLAIM / EVIDENCE / EXPLANATION','Make the case.','Use a short writing task for individual practice, partner discussion, or a classroom exit ticket.')+`<div class="toolbar"><label for="writingUnit">Choose a unit</label><select id="writingUnit">${unitOptions(writingUnit,false)}</select></div><div class="writing-layout"><section class="section-card writing-editor"><div class="eyebrow">UNIT ${writingUnit} / ORIGINAL CLASSROOM PROMPT</div><h2>${esc(prompt.prompt)}</h2><p class="resource-note">A short argument exercise; not a complete DBQ or an official AP scoring task.</p><label for="writingResponse"><strong>Your response</strong></label><textarea id="writingResponse" rows="13" maxlength="20000" placeholder="Make a claim. Support it with specific historical evidence. Explain the connection.">${esc(value)}</textarea><div class="print-response" id="printResponse">${esc(value)}</div><div class="writing-meta"><span id="wordCount"></span><span class="save-status" id="draftStatus">Drafts stay in this browser.</span></div><div class="toolbar"><button class="btn" id="downloadWriting">Download response</button><button class="btn" id="printWriting">Print response</button></div></section><aside class="section-card writing-checklist"><div class="eyebrow">BEFORE YOU FINISH</div><h2>Read it like a historian.</h2>${prompt.checklist.map((item,i)=>`<label class="checklist-item"><input type="checkbox" data-check="${i}"><span>${esc(item)}</span></label>`).join('')}<p class="resource-note">Use these questions for self-review or teacher feedback. Your response is not automatically graded or submitted.</p><details><summary>For teachers: discuss & debrief</summary><p>Ask students to underline their claim, circle a specific piece of evidence, and compare explanations with a partner. Invite a counterexample before revising.</p></details></aside></div>`;
    const update=()=>{const text=$('writingResponse').value;$('wordCount').textContent=`${text.trim()?text.trim().split(/\s+/).length:0} words`;$('printResponse').textContent=text;};update();
    $('writingResponse').oninput=()=>{update();const persisted=save('euro-writing-'+writingUnit,$('writingResponse').value);$('draftStatus').textContent=persisted?'Saved on this device.':'Storage unavailable. Download to keep your response.';};
    $('writingUnit').onchange=()=>{writingUnit=Number($('writingUnit').value);renderWriting();};
    $('printWriting').onclick=()=>window.print();
    $('downloadWriting').onclick=()=>{
      const text=`AP European History · Unit ${writingUnit}\n\n${prompt.prompt}\n\n${$('writingResponse').value}\n`;
      const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`ap-euro-unit-${writingUnit}-response.txt`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);announce('Response downloaded.');
    };
  }
  function renderExam() {
    renderExamPrep();
    const notice=document.createElement('section');notice.className='section-card exam-update';
    notice.innerHTML=`<div class="eyebrow">2026–27 SCHOOL YEAR / MAY 2027 EXAM</div><h2>The exam is changing. Prepare for the current format.</h2><p>All three SAQs are required and use sources: a secondary text, a primary text, and a non-text source. The LEQ has one broad required prompt, with flexibility in the historical evidence you select. The DBQ date range expands to 1450–2001.</p><p>Section II is 100 minutes total; 60 minutes for the DBQ (including a 15-minute reading period) and 40 for the LEQ are recommended allocations.</p><p><a href="https://apcentral.collegeboard.org/courses/ap-history-exam-updates" target="_blank" rel="noopener">College Board: AP history exam updates ↗</a> · <a href="https://apcentral.collegeboard.org/courses/ap-european-history/exam" target="_blank" rel="noopener">Official exam and scoring resources ↗</a></p><p class="resource-note">Checked September 2026. Follow your teacher’s instructions and the current official rubric.</p>`;
    $('vExam').prepend(notice);
  }
  function renderSaved() {
    const bookmarks=getBookmarks();const events=DATA.filter(d=>bookmarks.includes(d.id));
    $('vSaved').innerHTML=heading('YOUR EVIDENCE COLLECTION','Save it. Connect it.','Revisit events you bookmarked. Saved items belong to this browser, including on shared classroom devices.')+(events.length?`<div class="saved-list">${events.map(d=>`<article class="section-card"><div class="eyebrow">UNIT ${d.apUnit} · ${esc(d.date)}</div><h2>${esc(d.title)}</h2><p>${esc(d.whyItMatters)}</p><div class="toolbar"><button class="btn" data-event="${esc(d.id)}">Explore evidence</button><button class="btn" data-remove="${esc(d.id)}">Remove bookmark</button></div></article>`).join('')}</div>`:`<div class="empty-state"><span aria-hidden="true">☆</span><h2>Your next connection starts here.</h2><p>Open an event in a unit and select “Bookmark for review.”</p><button class="btn primary" data-unit="1">Explore Unit 1 →</button></div>`);
    bindActions($('vSaved'));
    $('vSaved').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{setBookmarks(getBookmarks().filter(id=>id!==b.dataset.remove));renderSaved();announce('Bookmark removed.');});
  }
  function buildCatalog() {
    const entries=DATA.map(d=>({title:d.title,text:[d.description,d.whyItMatters,...d.causes,...d.effects,...d.category,...d.region,...d.apTheme].join(' '),meta:`Unit ${d.apUnit} · ${d.date} · Event`,event:d.id}));
    const groups=[[KEY_WORKS,'Written work'],[KEY_PAINTINGS,'Artwork'],[KEY_WARS,'Conflict'],[KEY_TREATIES,'Treaty'],[KEY_INNOVATIONS,'Innovation'],[KEY_MUSIC,'Music'],[KEY_POPES,'Religious leader'],[INFLUENTIAL_WOMEN,'Historical figure'],[EXTRA_EVENTS,'Context'],[PERIOD_ANCHORS,'Turning point'],[AP_VOCAB,'Vocabulary'],[CED_GAPS,'Study note'],[ART_MOVEMENTS,'Art movement']];
    for(const [items,label] of groups)for(const item of items)entries.push({title:plain(item.title||item.name||item.term),text:plain(Object.entries(item).filter(([k])=>!['title','name','term','era','ced'].includes(k)).map(([,v])=>typeof v==='object'?JSON.stringify(v):v).join(' ')),meta:label+(item.year?' · '+item.year:'')});
    for(const [country,people] of Object.entries(POLITICAL_LEADERS))for(const p of people)entries.push({title:p.name,text:plain(`${p.role} ${p.note}`),meta:`${country} · ${p.start}–${p.end}`});
    for(const era of INTELLECTUAL_ERAS)for(const p of era.thinkers)entries.push({title:p.name,text:plain(p.idea),meta:'Thinker'});
    return entries;
  }
  function renderSearch() {
    const terms=searchTerm.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    const results=terms.length?catalog.filter(item=>terms.every(term=>(item.title+' '+item.text+' '+item.meta).toLocaleLowerCase().includes(term))):[];
    $('vSearch').innerHTML=heading('SEARCH THE ENTIRE COURSE','Follow an idea.',terms.length?`${results.length} results for “${esc(searchTerm)}”.`:'Search a name, event, date, or concept to begin.')+(results.length?`<div class="result-list">${results.map(r=>`<article class="section-card result-card"><div class="eyebrow">${esc(r.meta)}</div><h2>${esc(r.title)}</h2><p>${esc(r.text.slice(0,600))}${r.text.length>600?'…':''}</p>${r.event?`<button class="btn" data-event="${esc(r.event)}">Explore evidence →</button>`:r.text.length>600?`<details><summary>Read full entry</summary><p>${esc(r.text)}</p></details>`:''}</article>`).join('')}</div>`:terms.length?'<div class="empty-state"><h2>No matching entries yet.</h2><p>Try a surname, a shorter phrase, or a related concept. For example: Luther, sovereignty, or industrialization.</p></div>':'');
    bindActions($('vSearch'));announce(`${results.length} search results.`);
  }
  window.openDetail=function(id){
    if(!$('dp').classList.contains('open'))returnFocus=document.activeElement;
    legacyOpenDetail(id);if(!$('dp').classList.contains('open'))return;
    $('dp').inert=false;$('dp').setAttribute('aria-hidden','false');$('app').inert=true;$('dpB').scrollTop=0;$('dpX').focus();
  };
  window.closeDetail=function(){
    const wasOpen=$('dp').classList.contains('open');legacyCloseDetail();$('dp').inert=true;$('dp').setAttribute('aria-hidden','true');$('app').inert=false;
    if(wasOpen&&returnFocus?.isConnected)returnFocus.focus();
  };
  function parseRoute() {
    const [v,params]=location.hash.slice(1).split('?');const unit=Number(new URLSearchParams(params).get('unit'));
    currentUnit=Number.isInteger(unit)&&unit>=1&&unit<=9?unit:0;
    navigate(views[v]&&v!=='search'?v:'overview',{keepFocus:true,updateURL:false});
  }
  async function initClassroom() {
    if(!content?.units?.length||!content.practice?.length||!content.writing?.length)throw new Error('Course content is unavailable');
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
    try {const response=await fetch('timeline_data.json',{signal:controller.signal});if(!response.ok)throw new Error('Could not load timeline');const data=await response.json();if(!Array.isArray(data)||!data.length||data.some(d=>!d.id||!d.title||!Number.isFinite(d.startYear)||!Number.isInteger(d.apUnit)||!Array.isArray(d.causes)||!Array.isArray(d.effects)))throw new Error('Timeline format is invalid');DATA=data;}finally{clearTimeout(timeout);}
    catalog=buildCatalog();ready=true;
    $('unitNav').innerHTML=`<button class="ub" data-unit="0"><span class="unit-number">↗</span><span class="unit-title">All periods</span></button>${content.units.map(u=>`<button class="ub" data-unit="${u.id}" aria-label="Unit ${u.id}: ${esc(u.title)}"><span class="unit-number">${u.id}</span><span class="unit-title">${esc(u.title)}</span></button>`).join('')}`;
    $('unitNav').querySelectorAll('.ub').forEach(b=>b.onclick=()=>selectUnit(Number(b.dataset.unit)));
    document.querySelectorAll('.nb').forEach(b=>b.onclick=()=>navigate(b.dataset.v));
    $('si').oninput=()=>{clearTimeout(queryTimer);queryTimer=setTimeout(()=>{searchTerm=$('si').value.trim();$('clearSearch').hidden=!searchTerm;navigate(searchTerm?'search':'overview',{keepFocus:true});},160);};
    $('clearSearch').onclick=()=>{navigate('overview',{keepFocus:true});$('si').focus();};
    $('dpX').onclick=closeDetail;$('dbk').onclick=closeDetail;
    $('btnPrint').onclick=()=>window.print();
    $('btnProjector').onclick=()=>{const on=document.body.classList.toggle('projector');$('btnProjector').setAttribute('aria-pressed',String(on));$('btnProjector').textContent=on?'Exit projector':'Projector mode';announce(on?'Projector mode enabled.':'Projector mode disabled.');};
    let theme=read('euro-classroom-theme','light');if(!['light','dark'].includes(theme))theme='light';
    const applyTheme=t=>{document.documentElement.dataset.theme=t;$('btnTheme').textContent=t==='dark'?'Light':'Dark';$('btnTheme').setAttribute('aria-label',`Use ${t==='dark'?'light':'dark'} theme`);};applyTheme(theme);
    $('btnTheme').onclick=()=>{theme=document.documentElement.dataset.theme==='dark'?'light':'dark';applyTheme(theme);save('euro-classroom-theme',theme);};
    document.addEventListener('keydown',e=>{
      if($('dp').classList.contains('open')){
        if(e.key==='Escape'){e.preventDefault();closeDetail();return;}
        if(e.key==='Tab'){const controls=Array.from($('dp').querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')).filter(el=>!el.disabled);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;
      }
      if(e.key==='Escape'&&e.target===$('si')){e.preventDefault();clearTimeout(queryTimer);navigate('overview',{keepFocus:true});$('si').focus();return;}
      if(e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
      if(e.key==='/'&&!e.metaKey&&!e.ctrlKey&&!e.altKey){e.preventDefault();$('si').focus();}
    });
    window.addEventListener('hashchange',()=>{if(views[location.hash.slice(1).split('?')[0]])parseRoute();});
    $('main').addEventListener('click',e=>{const link=e.target.closest('a[href^="#"]');if(!link)return;const target=document.getElementById(link.getAttribute('href').slice(1));if(target){e.preventDefault();target.scrollIntoView({block:'start'});target.tabIndex=-1;target.focus({preventScroll:true});}});
    parseRoute();
  }
  initClassroom().catch(()=>{$('vOverview').innerHTML='<div class="empty-state" role="alert"><h1>We couldn’t load the course.</h1><p>Check your connection and try again. Saved drafts and bookmarks have not been changed.</p><button class="btn primary" id="retryLoad">Try again</button><p><a href="https://apcentral.collegeboard.org/courses/ap-european-history">Open official course resources ↗</a></p></div>';$('retryLoad').onclick=()=>location.reload();});
})();
