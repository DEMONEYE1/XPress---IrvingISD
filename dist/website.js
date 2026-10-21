(() => {
  'use strict';
  const $=id=>document.getElementById(id), E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const data=window.XpressIndex||[];
  const savedIds=()=>{try{const value=JSON.parse(localStorage.getItem('irving-xpress-saved-v2')||'[]');return Array.isArray(value)?value:[];}catch{return [];}};
  const matching=(query,type)=>{const terms=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);return data.filter(item=>(!type||item.type===type)&&terms.every(t=>(item.title+' '+item.description+' '+(item.keywords||'')).toLocaleLowerCase().includes(t))).sort((a,b)=>{const exact=v=>v.title.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim())?0:1;return exact(a)-exact(b)||a.title.localeCompare(b.title);});};
  if($('site-search')){
    const params=new URLSearchParams(location.search),search=$('site-search'),filter=$('search-kind');
    search.value=params.get('q')||'';
    if([...filter.options].some(o=>o.value===params.get('type')))filter.value=params.get('type');
    function render(){
      const results=matching(search.value,filter.value);
      $('search-count').textContent=results.length+' '+(results.length===1?'result':'results')+(search.value?' for “'+search.value+'”':' across Xpress');
      $('search-results').innerHTML=results.map(r=>`<a class="web-result" href="${E(r.url)}"><span class="eyebrow">${E(r.type)}</span><h2>${E(r.title)} <span aria-hidden="true">↗</span></h2><p>${E(r.description)}</p></a>`).join('')||'<p class="empty">No matches. Try a school name, a subject, or a tool such as GPA.</p>';
      const next=new URL(location.href);next.search='';if(search.value)next.searchParams.set('q',search.value);if(filter.value)next.searchParams.set('type',filter.value);history.replaceState(null,'',next);
    }
    search.addEventListener('input',render);filter.addEventListener('change',render);
    $('search-form').addEventListener('submit',e=>{e.preventDefault();render();});
    $('reset-search').addEventListener('click',()=>{search.value='';filter.value='';render();search.focus();});render();
  }
  if(!$('my-campus'))return;
  const schools=data.filter(r=>r.type==='School'),select=$('my-campus');
  select.innerHTML='<option value="">Choose your campus or program</option>'+schools.map(s=>`<option value="${E(s.id)}">${E(s.title)}</option>`).join('');
  const say=message=>{$('my-status').textContent=message;};
  let schoolId='';try{schoolId=localStorage.getItem('xpress-campus')||'';}catch{say('Browser storage is unavailable. Your campus selection will last for this page.');}
  select.value=schools.some(s=>s.id===schoolId)?schoolId:'';
  function campus(){
    const item=schools.find(s=>s.id===select.value);
    $('campus-summary').innerHTML=item?`<h3 class="web-campus-name">${E(item.title)}</h3><div class="web-meta"><span>${E(item.category)}</span><span>${E(item.phone)}</span></div><p>${E(item.address)}</p><div class="actions"><a class="btn primary" href="${E(item.url)}">Campus profile →</a><a class="btn" href="${E(item.official)}" target="_blank" rel="noopener noreferrer">Official website ↗</a></div>`:'<div class="web-empty">Choose a school for quick access to its profile, contacts, and pathways.</div>';
  }
  select.addEventListener('change',()=>{campus();try{localStorage.setItem('xpress-campus',select.value);say(select.value?'Campus saved on this browser.':'Campus preference cleared.');}catch{say('Campus selected for this page. Browser storage is unavailable.');}});campus();
  $('today-date').textContent=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'}).format(new Date());
  async function render(){
    const db=await GX.load(),profile=GX.active(db),today=GX.localDate();
    $('workspace-name').textContent=profile.name;
    const tasks=(profile.tasks||[]).filter(t=>!t.done).sort((a,b)=>a.due.localeCompare(b.due)),due=tasks.filter(t=>t.due<=today);
    const saved=data.filter(r=>r.type==='Scholarship'&&savedIds().includes(r.id));
    $('due-count').textContent=due.length;$('open-count').textContent=tasks.length;$('saved-total').textContent=saved.length;
    $('my-tasks').innerHTML=tasks.slice(0,5).map(t=>`<li><a href="planner.html"><strong>${E(t.title)}</strong><small>${E(t.course||'Personal task')} · ${t.due<today?'Overdue · ':t.due===today?'Due today · ':''}${E(t.due)}</small></a></li>`).join('')||'<li class="web-empty">No open homework yet. Add your first task below.</li>';
    $('my-scholarships').innerHTML=saved.slice(0,4).map(s=>`<li><a href="${E(s.url)}"><strong>${E(s.title)}</strong><small>${E(s.amount)} · ${E(s.status)}</small></a></li>`).join('')||'<li class="web-empty">Build your shortlist by saving awards in the scholarship database.</li>';
  }
  $('quick-task').addEventListener('submit',async e=>{
    e.preventDefault();const title=$('quick-title').value.trim(),due=$('quick-due').value;
    if(!title||!due)return;
    const button=$('quick-submit');button.disabled=true;
    try{
      const db=await GX.load(),profile=GX.active(db);profile.tasks??=[];
      profile.tasks.push({id:GX.id(),title,course:$('quick-course').value.trim(),due,done:false,reminder:null});await GX.save(db);
      $('quick-task').reset();await render();say('Task added to '+profile.name+'. Open the planner to edit it or mark it complete.');
    }catch{say('The task could not be saved. Check that browser storage is enabled.');}finally{button.disabled=false;}
  });
  window.addEventListener('storage',()=>{render().catch(()=>say('Unable to refresh your workspace.'));});
  window.addEventListener('pageshow',()=>{render().catch(()=>say('Unable to load your workspace.'));});
  render().catch(()=>say('Unable to load your workspace. Personal tools are available through the links below.'));
})();
