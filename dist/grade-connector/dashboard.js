(() => {
 'use strict';
 const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=n=>typeof n==='number'&&Number.isFinite(n)?n.toFixed(2).replace(/\.00$/,''):'—';
 const connector=true; const send=message=>XpressSession.message(message.type);
 let state={status:'disconnected',snapshot:null},courses=[],assignments=[],timer,lastScenario=null,manualId=0;
 const labels={disconnected:'Not connected','sign-in':'Complete HAC sign-in',loading:'Importing classwork',ready:'Imported from HAC',error:'Import needs attention','signed-out':'Signed out'};
 const notify=text=>{$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(timer);timer=setTimeout(()=>$('#toast').hidden=true,4000);};
 function view(name){
   $$('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==name);
   $$('[data-view]').forEach(b=>{const active=b.dataset.view===name;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 }
 $$('[data-view]').forEach(b=>b.addEventListener('click',()=>view(b.dataset.view)));
 function render(){
   courses=state.snapshot?.courses||[];assignments=courses.flatMap(c=>c.assignments.map(a=>({...a,course:c.name,courseId:c.id})));
   $('#connection-status').textContent=labels[state.status]||'Not connected';
   $('#connection-message').textContent=state.message||(connector?'Choose Sign in & import to load your grades.':'Install the browser connector once to enable automatic imports.');
   $('.connection-strip').classList.toggle('ready',state.status==='ready');
   $('#import-time').textContent=state.snapshot&&state.importedAt?'Last read '+new Date(state.importedAt).toLocaleString():'';
   $('#course-count').textContent=courses.length||'—';
   const averages=courses.filter(c=>typeof c.average==='number'&&Number.isFinite(c.average)).map(c=>c.average);
   $('#overall-average').textContent=averages.length?fmt(averages.reduce((s,n)=>s+n,0)/averages.length)+'%':'—';
   $('#unscored-count').textContent=courses.length?assignments.filter(a=>a.status==='Unscored').length:'—';
   $('#period').textContent=state.snapshot?.period||'—';
   $('#scope').textContent=state.snapshot?`${state.snapshot.scope} · ${state.snapshot.periodKey}`:'Waiting for your classwork';
   const prev=$('#assignment-course').value;
   $('#assignment-course').innerHTML='<option value="">All courses</option>'+courses.map(c=>`<option value="${escape(c.id)}">${escape(c.name)}</option>`).join('');
   if(courses.some(c=>c.id===prev))$('#assignment-course').value=prev;
   $('#plan-course').innerHTML='<option value="">Choose an imported course</option>'+courses.filter(c=>typeof c.average==='number').map(c=>`<option value="${escape(c.id)}">${escape(c.name)} · ${fmt(c.average)}%</option>`).join('');
   clearScenario();updatePlanMode();resetGpa();
   // Any active course dialog is closed when a new snapshot replaces it.
   $('#course-dialog').close();renderCourses();renderAssignments();
 }
 function renderCourses(){
   const list=[...courses],sort=$('#course-sort').value;
   if(sort==='name')list.sort((a,b)=>a.name.localeCompare(b.name));
   if(sort==='low'||sort==='high')list.sort((a,b)=>a.average===null?1:b.average===null?-1:sort==='low'?a.average-b.average:b.average-a.average);
   $('#course-grid').innerHTML=list.map((c,i)=>`<button class="course-card" data-course="${escape(c.id)}" aria-label="Open ${escape(c.name)} details"><div class="course-top"><span class="course-icon">${String(i+1).padStart(2,'0')}</span><span class="grade-value ${c.average!==null&&c.average<80?'low':''}">${fmt(c.average)}${c.average!==null?'<small>%</small>':''}</span></div><h3>${escape(c.name)}</h3><p>${escape(c.gradeLabel||'HAC course average')}</p><div class="grade-bar" aria-hidden="true"><span style="width:${Math.min(100,Math.max(0,c.average||0))}%"></span></div><div class="card-foot"><span>${c.assignments.length} assignments · ${c.assignments.filter(a=>a.status==='Unscored').length} unscored</span><span>Details ↗</span></div></button>`).join('');
   $('#courses-empty').hidden=!!courses.length;
 }
 function dueSort(value){const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);return m?Number(m[3])*10000+Number(m[1])*100+Number(m[2]):null;}
 function renderAssignments(){
   const q=$('#assignment-search').value.trim().toLowerCase(),course=$('#assignment-course').value,status=$('#assignment-status').value;
   const rows=assignments.filter(a=>(!course||a.courseId===course)&&(!status||a.status===status)&&(!q||`${a.name} ${a.category} ${a.course}`.toLowerCase().includes(q)));
   const sort=$('#assignment-sort').value;
   rows.sort((a,b)=>{if(sort==='name')return a.name.localeCompare(b.name);const x=dueSort(a.due),y=dueSort(b.due);return x===null?1:y===null?-1:sort==='due-asc'?x-y:y-x;});
   $('#assignment-count').textContent=`${rows.length} of ${assignments.length} assignments`;
   $('#assignment-rows').innerHTML=rows.map(a=>`<tr><td>${escape(a.name)}<small>${escape(a.course)}</small></td><td>${escape(a.category)}</td><td>${escape(a.due||'—')}</td><td>${a.score===null?escape(a.scoreText||'—'):fmt(a.score)}${a.points===null?'':' / '+fmt(a.points)}</td><td><span class="tag ${a.status==='Missing'?'warning':''}">${escape(a.status)}</span></td></tr>`).join('');
   $('#assignment-empty').hidden=!!rows.length;
 }
 $('#assignment-filters').addEventListener('submit',e=>e.preventDefault());
 $('#assignment-filters').addEventListener('input',renderAssignments);$('#assignment-filters').addEventListener('change',renderAssignments);
 $('#course-sort').addEventListener('change',renderCourses);
 $('#course-grid').addEventListener('click',e=>{
   const b=e.target.closest('[data-course]');if(!b)return;const c=courses.find(c=>c.id===b.dataset.course);if(!c)return;
   $('#course-details').innerHTML=`<h2>${escape(c.name)}</h2><div class="grade-value">${fmt(c.average)}${c.average===null?'':'<small>%</small>'}</div><p>${escape(c.gradeLabel)} · ${escape(c.updated)}</p><h3>HAC category summary</h3><div class="category-grid">${c.categories.map(cat=>`<div class="category-tile">${escape(cat.name)}<strong>${fmt(cat.percent)}${cat.percent===null?'':'%'}</strong><small>${fmt(cat.earned)} / ${fmt(cat.possible)} points · category weight ${fmt(cat.weight)}${cat.weight===null?'':'%'}</small></div>`).join('')||'<p>No category summary was provided by HAC.</p>'}</div><p>Category values are copied from HAC. Unscored, exempt, weighted, or dropped work can make a simple assignment average differ.</p><button class="button" id="see-course-assignments">View all ${c.assignments.length} assignments →</button>`;
   $('#see-course-assignments').addEventListener('click',()=>{$('#course-dialog').close();$('#assignment-course').value=c.id;renderAssignments();view('assignments');});
   $('#course-dialog').showModal();
 });
 $('#close-dialog').addEventListener('click',()=>$('#course-dialog').close());
 $('#course-dialog').addEventListener('click',e=>{if(e.target===$('#course-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
 function clearScenario(){lastScenario=null;$('#plan-result').textContent='—';$('#plan-explanation').textContent='Choose a course and a hypothetical score to see the result.';$('#target-result').textContent='';$('#use-scenario-gpa').disabled=true;}
 function updateCategories(){
   const course=courses.find(c=>c.id===$('#plan-course').value);
   $('#plan-category').innerHTML='<option value="">Choose a category</option>'+(course?.categories||[]).map((c,i)=>`<option value="${i}">${escape(c.name)} · ${fmt(c.weight)}% weight</option>`).join('');
   clearScenario();
 }
 function updatePlanMode(){
   const mode=$('#plan-mode').value==='assignment';
   $('#component-inputs').hidden=mode;$('#category-inputs').hidden=!mode;
   $$('#component-inputs input').forEach(el=>el.disabled=mode);$$('#category-inputs input,#category-inputs select').forEach(el=>el.disabled=!mode);
   $('#plan-assumption').textContent=mode?'Adds one hypothetical assignment to the selected HAC category using its imported points and active category weights. Existing scores stay unchanged.':'Component mode treats the current course average as the remaining share. It does not simulate individual HAC assignments.';
   updateCategories();
 }
 $('#plan-mode').addEventListener('change',updatePlanMode);$('#plan-course').addEventListener('change',updateCategories);
 $('#planner').addEventListener('input',clearScenario);
 $('#planner').addEventListener('submit',e=>{
   e.preventDefault();if(!e.currentTarget.reportValidity())return;
   const course=courses.find(c=>c.id===$('#plan-course').value);if(!course)return;
   const target=Number($('#plan-target').value),mode=$('#plan-mode').value;
   try {
     const result=mode==='assignment'?GradeXpressMath.assignment(course.categories,Number($('#plan-category').value),Number($('#plan-earned').value),Number($('#plan-possible').value),Number($('#plan-multiplier').value),target):GradeXpressMath.component(course.average,Number($('#plan-score').value),Number($('#plan-weight').value),target);
     $('#plan-result').textContent=fmt(result.projected)+'%';
     $('#plan-explanation').textContent=mode==='assignment'?`${course.name}: hypothetical category average ${fmt(result.categoryPercent)}%. Course result uses active HAC category weights. It may differ from teacher rounding or overrides.`:`${course.name}: current ${fmt(course.average)}% with a new ${$('#plan-weight').value}% component. This is a scenario, not an official grade.`;
     $('#target-result').textContent=result.needed<=0?`A zero score would still meet your ${fmt(target)}% target in this model.`:result.needed>result.maximum?`To reach ${fmt(target)}%, you would need ${fmt(result.needed)}${result.unit}—above the normal maximum of ${fmt(result.maximum)}${result.unit}.`:`To reach ${fmt(target)}%, aim for at least ${(Math.ceil(result.needed*100)/100).toFixed(2)}${result.unit}.`;
     lastScenario={id:course.id,projected:result.projected};$('#use-scenario-gpa').disabled=result.projected<0||result.projected>100;
   }catch(error){clearScenario();$('#plan-explanation').textContent=error.message;}
 });
 function rowMarkup(row){return `<tr data-gpa-id="${escape(row.id)}"><td><input type="checkbox" data-gpa="include" aria-label="Include course" ${row.include?'checked':''}></td><td><input data-gpa="name" aria-label="Course name" value="${escape(row.name)}" maxlength="100"></td><td><input data-gpa="grade" aria-label="Current grade" type="number" min="0" max="100" step="0.01" value="${row.grade??''}"></td><td><input data-gpa="projected" aria-label="What-if grade" type="number" min="0" max="100" step="0.01" value="${row.projected??''}" placeholder="Same"></td><td><input data-gpa="credits" aria-label="Course credits" type="number" min="0.01" step="0.01" value="${row.credits}"></td><td><input data-gpa="bonus" aria-label="Bonus grade points" type="number" min="0" step="0.01" value="${row.bonus}"></td><td><button class="remove-course" type="button" aria-label="Remove course">✕</button></td></tr>`;}
 function resetGpa(){
   $('#gpa-rows').innerHTML=courses.map(c=>rowMarkup({id:c.id,name:c.name,include:c.average!==null,grade:c.average,projected:null,credits:.5,bonus:0})).join('');calculateGpa();
 }
 function calculateGpa(){
   const ids=['gpa-current','gpa-weighted','gpa-projected','gpa-projected-weighted'];
   try{
     const numeric=el=>el.value.trim()===''?null:Number(el.value);
     const rows=$$('#gpa-rows tr').map(tr=>({include:tr.querySelector('[data-gpa=include]').checked,grade:numeric(tr.querySelector('[data-gpa=grade]')),projected:numeric(tr.querySelector('[data-gpa=projected]')),credits:numeric(tr.querySelector('[data-gpa=credits]')),bonus:numeric(tr.querySelector('[data-gpa=bonus]'))}));
     const result=GradeXpressMath.gpa(rows,['a','b','c','d'].map(k=>numeric($('#gpa-'+k))),$('#gpa-bonus-pass').checked);
     [result.current,result.weighted,result.projected,result.projectedWeighted].forEach((v,i)=>$('#'+ids[i]).textContent=v===null?'—':v.toFixed(3));
     $('#gpa-error').textContent='';$('#gpa-credits').textContent=`${result.count} included courses · ${fmt(result.credits)} credits`;
   }catch(error){ids.forEach(id=>$('#'+id).textContent='—');$('#gpa-error').textContent=error.message;$('#gpa-credits').textContent='Correct the highlighted plan values to calculate.';}
 }
 $('#gpa-form').addEventListener('submit',e=>e.preventDefault());$('#gpa-form').addEventListener('input',calculateGpa);$('#gpa-form').addEventListener('change',calculateGpa);
 $('#gpa-add').addEventListener('click',()=>{$('#gpa-rows').insertAdjacentHTML('beforeend',rowMarkup({id:'manual'+(++manualId),name:'New course',include:true,grade:null,projected:null,credits:.5,bonus:0}));calculateGpa();});
 $('#gpa-reset').addEventListener('click',resetGpa);
 $('#gpa-rows').addEventListener('click',e=>{if(e.target.closest('.remove-course')){e.target.closest('tr').remove();calculateGpa();}});
 $('#use-scenario-gpa').addEventListener('click',()=>{if(!lastScenario)return;let row=$$('#gpa-rows tr').find(r=>r.dataset.gpaId===lastScenario.id);if(!row){const c=courses.find(c=>c.id===lastScenario.id);$('#gpa-rows').insertAdjacentHTML('beforeend',rowMarkup({id:c.id,name:c.name,include:true,grade:c.average,projected:null,credits:.5,bonus:0}));row=$$('#gpa-rows tr').find(r=>r.dataset.gpaId===c.id);}row.querySelector('[data-gpa=projected]').value=lastScenario.projected.toFixed(2);row.querySelector('[data-gpa=include]').checked=true;calculateGpa();view('gpa');});
 $('#connect').addEventListener('click',async()=>{
   if(!connector){$('#setup').hidden=false;$('#setup').scrollIntoView({behavior:'smooth',block:'start'});return;}
   $('#connect').disabled=true;
   try {const result=await send({type:'gx-start'});if(!result?.ok)throw Error();} catch {notify('The sign-in panel could not open. Refresh this page.');}
   finally{$('#connect').disabled=false;}
 });
 $('#disconnect').addEventListener('click',async()=>{
   if(connector){await send({type:'gx-clear'});notify('Signed out. Imported records cleared.');}
 });
 async function refresh(){try{state=await send({type:'gx-state'})||{status:'error',message:'Could not reach the connector.',snapshot:null};render();}catch{state={status:'error',message:'Refresh this page to reconnect.',snapshot:null};render();}}
 document.addEventListener('xpress-session',e=>{const next=e.detail;if(JSON.stringify(next)!==JSON.stringify(state)){state=next;render();}});refresh();
})();
