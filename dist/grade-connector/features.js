/* Personal plans persist locally. Imported grades and analysis inputs remain session-only. */
(async()=>{
 'use strict';
 const $=id=>document.getElementById(id),E=GX.escape,page=document.body.dataset.feature;
 let db=await GX.load(),profile=GX.active(db),snapshot=await GX.snapshot(),noticeTimer;
 const say=msg=>{const n=$('feature-notice');n.textContent=msg;n.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>n.hidden=true,6500);};
 const on=(id,event,fn)=>$(id)?.addEventListener(event,e=>{if(event==='submit')e.preventDefault();Promise.resolve().then(()=>fn(e)).catch(error=>say(error.message||'This change could not be saved.'));});
 const persist=async()=>{await GX.save(db);};
 const reschedule=async()=>GX.extension?GX.message('gx-reschedule'):null;
 const num=v=>String(v??'').trim()===''?null:Number(v);
 $('active-profile').textContent=profile.name+' · '+profile.role;
 $('workspace-status').textContent=GX.extension?'Local workspace · '+(snapshot?'HAC classwork connected.':'Connect HAC from the Grade dashboard to import school data.'):'Website workspace · Sign in to Grade Xpress for HAC records. Personal plans stay in this browser.';
 async function permit(){
   if(!GX.extension)throw Error('Install this ZIP as the browser extension first. See Grade dashboard → Connection.');
   // Called directly from a click handler; permission requests require a user gesture.
   return chrome.permissions.request({permissions:['notifications']});
 }
 if(page==='personalization'){
   const appearance=XpressAppearance;
   function controls(){const v=appearance.get();$('appearance-mode').value=v.mode;$('appearance-icon').value=v.icon;$('theme-grid').innerHTML=appearance.palettes.map(p=>`<button class="theme-choice" data-theme="${p[0]}" aria-pressed="${p[0]===v.theme}"><span class="swatch" style="--swatch-bg:${v.mode==='light'?p[6]:p[4]};--swatch-accent:${p[2]}"></span>${p[1]}</button>`).join('');}
   controls();document.addEventListener('gx-appearance',controls);
   async function update(v){$('appearance-storage').textContent='Saved · '+await appearance.save({...appearance.get(),...v});}
   on('theme-grid','click',e=>{const b=e.target.closest('[data-theme]');if(b)return update({theme:b.dataset.theme});});
   on('appearance-mode','change',()=>update({mode:$('appearance-mode').value}));
   on('appearance-icon','change',()=>update({icon:$('appearance-icon').value}));
   on('download-icon','click',()=>appearance.download());
   const profiles=()=>{$('profile-select').innerHTML=db.profiles.map(p=>`<option value="${E(p.id)}">${E(p.name)} · ${E(p.role)}</option>`).join('');$('profile-select').value=db.active;};profiles();
   async function switchTo(id){await GX.message('gx-clear');db.active=id;await persist();location.reload();}
   on('profile-select','change',()=>switchTo($('profile-select').value));
   on('profile-form','submit',async e=>{e.preventDefault();if(db.profiles.length>=10)throw Error('This browser supports up to 10 workspaces.');const name=$('profile-name').value.trim();if(!name)throw Error('Enter a workspace name.');const p={id:GX.id(),name,role:$('profile-role').value,tasks:[],bells:[],bellDate:'',bellDay:'A'};db.profiles.push(p);await switchTo(p.id);});
   try {const available=!!(globalThis.PublicKeyCredential&&await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());$('biometric-status').textContent=available?'This browser reports a device authenticator. It is not connected to HAC or Xpress login.':'A compatible device authenticator is unavailable in this browser context.';}catch{$('biometric-status').textContent='Device authenticator availability could not be checked.';}
 }
 let renderTeacher,renderAnalysis,analysisRows=[];
 if(page==='planner'){
   profile.tasks??=[];
   function renderTasks(){
     const tasks=profile.tasks,today=GX.localDate(),open=tasks.filter(t=>!t.done);
     $('tasks-open').textContent=open.length;$('tasks-today').textContent=open.filter(t=>t.due===today).length;$('tasks-late').textContent=open.filter(t=>t.due<today).length;$('tasks-done').textContent=tasks.length-open.length;
     const filter=$('task-filter').value,visible=tasks.filter(t=>filter==='all'||(filter==='done'?t.done:!t.done)).sort((a,b)=>a.due.localeCompare(b.due));
     $('task-list').innerHTML=visible.map(t=>`<article class="task-row ${t.done?'done':''}"><input type="checkbox" data-done="${E(t.id)}" ${t.done?'checked':''} aria-label="Complete ${E(t.title)}"><div class="task-copy"><h3>${E(t.title)}</h3><small>${E(t.course||'Personal task')}</small><small class="${!t.done&&t.due<today?'overdue':''}">${!t.done&&t.due<today?'Overdue · ':''}${E(t.due)}${t.reminder?' · Reminder '+E(new Date(t.reminder).toLocaleString()):''}</small></div><button class="button tiny" data-edit="${E(t.id)}">Edit</button><button class="button tiny" data-delete="${E(t.id)}" aria-label="Delete ${E(t.title)}">×</button></article>`).join('')||'<p class="empty-inline">A clear page. Add your next task above.</p>';
   }
   function resetTask(){$('task-form').reset();$('task-id').value='';$('save-task').textContent='Add to my plan →';$('cancel-edit').hidden=true;}
   on('task-form','submit',async e=>{
     e.preventDefault();const id=$('task-id').value||GX.id(),existing=profile.tasks.find(t=>t.id===id),reminder=$('task-reminder').value?new Date($('task-reminder').value).getTime():null;
     if(reminder&&reminder<=Date.now()&&reminder!==existing?.reminder)throw Error('Choose a reminder in the future.');
     const task={id,title:$('task-title').value.trim(),course:$('task-course').value.trim(),due:$('task-due').value,reminder,done:existing?.done||false};
     if(!task.title||!task.due)throw Error('Enter a title and due date.');
     if(existing)Object.assign(existing,task);else profile.tasks.push(task);
     await persist();resetTask();renderTasks();const result=await reschedule();say(reminder&&!result?.enabled?'Task saved. Enable browser reminders to schedule its alert.':'Task saved.');
   });
   on('task-filter','change',renderTasks);on('cancel-edit','click',resetTask);
   on('task-list','change',async e=>{const id=e.target.dataset.done;if(!id)return;profile.tasks.find(t=>t.id===id).done=e.target.checked;await persist();await reschedule();renderTasks();});
   on('task-list','click',async e=>{
     const b=e.target.closest('button');if(!b)return;const id=b.dataset.edit||b.dataset.delete,t=profile.tasks.find(t=>t.id===id);if(!t)return;
     if(b.dataset.delete){profile.tasks=profile.tasks.filter(t=>t.id!==id);await persist();await reschedule();renderTasks();if($('task-id').value===id)resetTask();say('Task removed.');return;}
     $('task-id').value=t.id;$('task-title').value=t.title;$('task-course').value=t.course;$('task-due').value=t.due;$('task-reminder').value=t.reminder?GX.localDate(new Date(t.reminder))+'T'+new Date(t.reminder).toTimeString().slice(0,5):'';$('save-task').textContent='Save changes →';$('cancel-edit').hidden=false;$('task-title').focus();
   });
   let teacherItems=[];
   renderTeacher=()=>{
     teacherItems=(snapshot?.courses||[]).flatMap(c=>c.assignments.map(a=>({...a,course:c.name})));
     const q=$('teacher-search').value.toLowerCase();
     $('teacher-list').innerHTML=teacherItems.map((a,i)=>({...a,i})).filter(a=>(a.name+' '+a.course).toLowerCase().includes(q)).map(a=>`<article class="teacher-row"><div><h3>${E(a.name)}</h3><small>${E(a.course)} · ${E(a.due)}</small><small>${E(a.status)}${a.scoreText?' · '+E(a.scoreText):''}</small></div><button class="button tiny" data-plan="${a.i}">+ Plan</button></article>`).join('')||'<p class="empty-inline">No matching imported assignments. Connect HAC to see the selected reporting period.</p>';
   };
   on('teacher-search','input',renderTeacher);
   on('teacher-list','click',e=>{const b=e.target.closest('[data-plan]');if(!b)return;const a=teacherItems[Number(b.dataset.plan)];resetTask();$('task-title').value=a.name;$('task-course').value=a.course;const parsed=new Date(a.due);if(!isNaN(parsed))$('task-due').value=GX.localDate(parsed);$('task-title').focus();say('Review the due date, then add this assignment to your plan.');});
   $('enable-reminders').addEventListener('click',async()=>{try{if(await permit()){const r=await reschedule();$('reminder-state').textContent=`Enabled · ${r.count} future alerts across workspaces`;say('Browser reminders enabled.');}else $('reminder-state').textContent='Permission not granted. Tasks are still saved.';}catch(e){say(e.message);}});
   if(GX.extension){const allowed=await chrome.permissions.contains({permissions:['notifications']});$('reminder-state').textContent=allowed?'Notifications allowed':'Not enabled';}else $('reminder-state').textContent='Scheduled notifications unavailable';
   renderTasks();renderTeacher();
 }
 if(page==='grade-analysis'){
   renderAnalysis=()=>{
     const cs=snapshot?.courses||[],numeric=cs.filter(c=>typeof c.average==='number');
     $('analysis-chart').innerHTML=numeric.map(c=>`<div class="analysis-row"><span>${E(c.name)}</span><span class="bar"><span style="width:${Math.max(0,Math.min(100,c.average))}%"></span></span><strong>${c.average}</strong></div>`).join('')||'<p class="empty-inline">Connect HAC to compare your course averages. You can use the GPA calculator below without connecting.</p>';
     const missing=cs.flatMap(c=>c.assignments).filter(a=>a.status==='Missing').length,lowest=[...numeric].sort((a,b)=>a.average-b.average)[0];
     $('analysis-insights').innerHTML=lowest?`<p><strong>${E(lowest.name)}</strong> has the lowest numeric average in this view (${lowest.average}%). Review its assignment categories before planning a target.</p><p><strong>${missing}</strong> assignments carry an explicit missing code. A blank score is not counted as missing.</p>`:'<p>Insights appear when course averages and assignments are imported.</p>';
   };
   const rowMarkup=(r,i)=>`<tr>${['name','grade','projected','credits','bonus'].map(k=>`<td><input aria-label="${k} for course ${i+1}" data-row="${i}" data-col="${k}" ${k==='name'?'maxlength="180"':'type="number" step="0.01" min="0"'+(['grade','projected'].includes(k)?' max="100"':'')} value="${E(r[k]??'')}"></td>`).join('')}<td><button class="button tiny" data-remove="${i}" aria-label="Remove course ${i+1}">×</button></td></tr>`;
   function totals(){
     try{const thresholds=['a','b','c','d'].map(k=>num($('analysis-'+k).value));const r=GradeXpressMath.gpa(analysisRows.map(r=>({...r,include:true,grade:num(r.grade),projected:num(r.projected),credits:num(r.credits),bonus:num(r.bonus)})),thresholds,true);
       for(const [id,k] of [['unweighted','current'],['weighted','weighted'],['projected','projected'],['projected-weighted','projectedWeighted']])$('analysis-'+id).textContent=r[k]===null?'—':r[k].toFixed(2);
       $('analysis-credits').textContent=`${r.count} courses · ${r.credits.toFixed(2)} credits`;$('analysis-error').textContent='';
     }catch(e){for(const k of ['unweighted','weighted','projected','projected-weighted'])$('analysis-'+k).textContent='—';$('analysis-error').textContent=e.message;$('analysis-credits').textContent='Check your inputs.';}
   }
   const rows=()=>{$('analysis-rows').innerHTML=analysisRows.map(rowMarkup).join('');totals();};
   on('analysis-add','click',()=>{analysisRows.push({name:'',grade:'',projected:'',credits:.5,bonus:0});rows();});
   on('analysis-rows','input',e=>{const {row,col}=e.target.dataset;if(col){analysisRows[Number(row)][col]=e.target.value;totals();}});
   on('analysis-rows','click',e=>{const b=e.target.closest('[data-remove]');if(b){analysisRows.splice(Number(b.dataset.remove),1);rows();}});
   for(const k of ['a','b','c','d'])on('analysis-'+k,'input',totals);
   on('analysis-seed','click',()=>{if(!snapshot?.courses?.length)throw Error('Connect HAC first, or add your courses manually.');analysisRows=snapshot.courses.filter(c=>c.average!==null).map(c=>({name:c.name,grade:c.average,projected:'',credits:.5,bonus:0}));rows();say('Averages copied. Verify credits and course bonuses before using the estimate.');});
   on('analysis-transcript','click',async()=>{
     const transcript=(await GX.message('gx-state'))?.records?.transcript;if(!transcript)throw Error('Import your transcript first from School records.');
     const result=[];
     for(const table of transcript.tables){const h=table.headers,credit=h.indexOf('Credit'),name=h.indexOf('Description');if(credit<0||name<0)continue;
       for(const row of table.rows){const credits=num(row[credit]),final=num(row[h.indexOf('FINAL')]),semesters=['SEM1','SEM2'].map(k=>num(row[h.indexOf(k)])).filter(n=>Number.isFinite(n)&&n>=0&&n<=100),grade=Number.isFinite(final)?final:semesters.length?semesters.reduce((a,b)=>a+b,0)/semesters.length:null;
         if(credits>0&&Number.isFinite(grade)&&grade>=0&&grade<=100)result.push({name:row[name]+' · '+table.title,grade,credits,bonus:0,projected:''});
       }
     }
     if(!result.length)throw Error('No positive-credit courses with numeric grades were available. Enter transcript values manually.');
     analysisRows=result;rows();say(`${result.length} transcript rows copied. Review credits, eligibility, and bonuses.`);
   });
   on('transcript-csv','change',async()=>{
     const file=$('transcript-csv').files[0];if(!file)return;if(file.size>1000000)throw Error('Use a CSV smaller than 1 MB.');
     const parsed=parseCSV(await file.text());if(parsed.length<2)throw Error('The CSV has no courses.');
     const header=parsed.shift().map(v=>v.trim().toLowerCase());if(header.join(',')!=='course,grade,credits,bonus')throw Error('Use the template columns: course,grade,credits,bonus.');
     const imported=parsed.filter(r=>r.some(v=>v.trim())).map((r,i)=>{if(r.length!==4||!r[0].trim()||r.slice(1).some(v=>!v.trim()||!/^\d+(\.\d+)?$/.test(v.trim())))throw Error('Invalid fields on CSV row '+(i+2));return {name:r[0].slice(0,180),grade:Number(r[1]),credits:Number(r[2]),bonus:Number(r[3]),projected:''};});
     if(!imported.length||imported.length>500)throw Error('Import between 1 and 500 courses.');
     GradeXpressMath.gpa(imported.map(r=>({...r,include:true,projected:null})),[90,80,70,60]);analysisRows=imported;rows();say(`${imported.length} courses imported into this page’s calculator.`);
   });
   window.GXAnalysis={clear(){analysisRows=[];rows();},parseCSV};
   renderAnalysis();rows();
 }
 if(page==='school-day'){
   profile.bells??=[];$('bell-date').value=profile.bellDate||GX.localDate();$('bell-day').value=profile.bellDay||'A';
   const minutes=t=>{const [h,m]=t.split(':').map(Number);return h*60+m;};
   function tick(){
     const sim=$('clock-select').value==='simulation',now=new Date(),time=sim?$('simulation-time').value:now.toTimeString().slice(0,5),minute=minutes(time),day=$('bell-day').value;
     const bells=profile.bells.filter(b=>b.days.includes(day)).sort((a,b)=>a.start.localeCompare(b.start)),current=bells.find(b=>minutes(b.start)<=minute&&minute<minutes(b.end)),next=bells.find(b=>minutes(b.start)>minute);
     $('bell-clock').textContent=time||'—';$('clock-mode').textContent=sim?'SIMULATED TIME':'LIVE CLOCK';$('simulation-field').hidden=!sim;
     $('bell-current').textContent=current?current.name:'Between periods';
     $('bell-next').textContent=current?`${minutes(current.end)-minute} minutes until this period ends.${next?' Next: '+next.name+' at '+next.start:''}`:next?`Next: ${next.name} at ${next.start} · ${minutes(next.start)-minute} minutes away.`:'No more periods on this day’s custom schedule.';
     for(const row of $('bell-list').children)row.classList.toggle('current',row.dataset.bell===current?.id);
   }
   function render(){
     $('bell-list').innerHTML=[...profile.bells].filter(b=>b.days.includes($('bell-day').value)).sort((a,b)=>a.start.localeCompare(b.start)).map(b=>`<article class="bell-row" data-bell="${E(b.id)}"><span class="tag">${E(b.start)}<br>${E(b.end)}</span><div><h3>${E(b.name)}</h3><small>${E(b.days==='AB'?'A + B':b.days)} day · ${E(b.room||'No room added')}</small>${b.email?`<a class="text-link" href="mailto:${E(encodeURIComponent(b.email))}">Email teacher ↗</a>`:''}</div><button class="button tiny" data-edit-bell="${E(b.id)}">Edit</button><button class="button tiny" data-delete-bell="${E(b.id)}" aria-label="Delete ${E(b.name)}">×</button></article>`).join('')||'<p class="empty-inline">No periods yet for this day. Add your campus times above.</p>';tick();
     $('bell-alert-status').textContent=profile.bellAlerts?`Saved alert plan: ${profile.bellAlerts.date} · ${profile.bellAlerts.day} day.`:'No period alert plan is saved.';
   }
   function reset(){$('bell-form').reset();$('bell-id').value='';$('save-bell').textContent='Add period →';$('cancel-bell-edit').hidden=true;}
   on('bell-form','submit',async e=>{e.preventDefault();const b={id:$('bell-id').value||GX.id(),name:$('bell-name').value.trim(),days:$('bell-days').value,start:$('bell-start').value,end:$('bell-end').value,email:$('bell-email').value.trim(),room:$('bell-room').value.trim()};
     if(!b.name||!b.start||!b.end||b.end<=b.start)throw Error('Enter a name and an end time after the start.');
     if(profile.bells.some(o=>o.id!==b.id&&[...b.days].some(d=>o.days.includes(d))&&b.start<o.end&&b.end>o.start))throw Error('This overlaps another period on the same day. Adjust its times.');
     const existing=profile.bells.find(o=>o.id===b.id);if(existing)Object.assign(existing,b);else profile.bells.push(b);
     await persist();await reschedule();reset();render();say('Period saved.');});
   on('cancel-bell-edit','click',reset);
   on('bell-list','click',async e=>{const button=e.target.closest('button');if(!button)return;const id=button.dataset.editBell||button.dataset.deleteBell,b=profile.bells.find(b=>b.id===id);if(!b)return;if(button.dataset.deleteBell){profile.bells=profile.bells.filter(b=>b.id!==id);await persist();await reschedule();render();return;}for(const k of ['id','name','days','start','end','email','room'])$('bell-'+k).value=b[k];$('save-bell').textContent='Save period →';$('cancel-bell-edit').hidden=false;$('bell-name').focus();});
   on('bell-day','change',async()=>{profile.bellDay=$('bell-day').value;await persist();render();});on('clock-select','change',tick);on('simulation-time','input',tick);
   $('schedule-alerts').addEventListener('click',async()=>{try{if(!await permit())throw Error('Notifications were not enabled.');const date=$('bell-date').value,day=$('bell-day').value;if(!date||date<GX.localDate())throw Error('Choose today or a future date.');if(!profile.bells.some(b=>b.days.includes(day)&&new Date(date+'T'+b.start).getTime()>Date.now()))throw Error('There are no future periods for this date and day.');profile.bellDate=date;profile.bellAlerts={date,day};await persist();const r=await reschedule();render();say(`Alerts scheduled. ${r.count} future alerts across workspaces.`);}catch(e){say(e.message);}});
   on('cancel-alerts','click',async()=>{profile.bellAlerts=null;await persist();await reschedule();render();say('Period alerts canceled.');});
   render();setInterval(tick,1000);
 }
 if(page==='records'){
   profile.attendance??={};$('attendance-month').value=GX.localDate().slice(0,7);$('attendance-date').value=GX.localDate();
   function render(){
     const [year,month]=$('attendance-month').value.split('-').map(Number);if(!year||!month)return;
     const first=new Date(year,month-1,1).getDay(),days=new Date(year,month,0).getDate();
     let html=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(s=>`<span class="weekday">${s}</span>`).join('')+'<span></span>'.repeat(first);
     for(let day=1;day<=days;day++){const date=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,v=profile.attendance[date];html+=`<div class="day ${v?'has-note':''}">${day}${v?`<small>${E(v.type)}</small><small>${E(v.note)}</small>`:''}</div>`;}
     $('attendance-calendar').innerHTML=html;
   }
   on('attendance-month','change',render);
   on('attendance-form','submit',async e=>{e.preventDefault();const date=$('attendance-date').value;if(!date)throw Error('Choose a date.');if($('attendance-type').value)profile.attendance[date]={type:$('attendance-type').value,note:$('attendance-note').value.trim()};else delete profile.attendance[date];await persist();$('attendance-month').value=date.slice(0,7);render();say('Personal attendance note saved.');});
   let objectURL;
   on('record-file','change',()=>{if(objectURL)URL.revokeObjectURL(objectURL);$('record-open').hidden=true;const f=$('record-file').files[0];if(!f)return;if(!f.name.toLowerCase().endsWith('.pdf')||f.size>30000000)throw Error('Choose a PDF smaller than 30 MB.');objectURL=URL.createObjectURL(f);$('record-open').href=objectURL;$('record-open').hidden=false;$('record-name').textContent=f.name;});
   render();
 }
 document.addEventListener('xpress-session',e=>{const next=e.detail.snapshot||null,changed=JSON.stringify(next)!==JSON.stringify(snapshot);snapshot=next;renderTeacher?.();renderAnalysis?.();if(changed)window.GXAnalysis?.clear();});
 if(GX.extension)chrome.storage.onChanged.addListener(async(changes,area)=>{
   if(area==='session'&&changes['gx-session']){const next=changes['gx-session'].newValue?.snapshot||null,changed=JSON.stringify(next)!==JSON.stringify(snapshot);snapshot=next;renderTeacher?.();renderAnalysis?.();if(changed)window.GXAnalysis?.clear();}
   if(area==='local'&&changes['gx-workspaces']?.newValue?.active!==undefined&&changes['gx-workspaces'].newValue.active!==db.active)location.reload();
 });
 function parseCSV(text){
   const rows=[];let row=[],value='',quoted=false;
   text=text.replace(/^\uFEFF/,'');
   for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(value);value='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);rows.push(row);row=[];value='';}else value+=c;}
   if(quoted)throw Error('CSV has an unclosed quote.');if(value||row.length){row.push(value);rows.push(row);}return rows;
 }
})().catch(error=>{const s=document.getElementById('workspace-status');if(s)s.textContent='Workspace could not load: '+error.message;});
