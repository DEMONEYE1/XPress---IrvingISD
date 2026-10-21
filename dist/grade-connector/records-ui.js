(async()=>{
 'use strict';
 const target=document.getElementById('imported-record');if(!target)return;
 const E=GX.escape,kind=({'attendance':'attendance','transcript':'transcript','report-cards':'report-card','school-day':'schedule'})[document.body.dataset.feature];
 let state=await GX.message('gx-state');
 function render(){
   const record=state?.records?.[kind],status=document.getElementById('record-sync-status');
   status.textContent=state?.recordSync?'Importing school records through the linked HAC tab…':record?'Imported '+new Date(record.importedAt).toLocaleString()+(record.month?' · '+record.month:''):state?.recordErrors?.[kind]||'No record imported yet. Connect HAC from Grade dashboard, then return here.';
   if(!record){target.innerHTML='<div class="empty"><h3>Your records belong here.</h3><p>Sign in through Grade Xpress to import them from the official HAC pages.</p></div>';return;}
   if(kind==='attendance'){
     const date=new Date('1 '+record.month),first=date.getDay();
     target.innerHTML=`<h2>${E(record.month)}</h2><div class="calendar">`+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<span class="weekday">${d}</span>`).join('')+'<span></span>'.repeat(Number.isFinite(first)?first:0)+record.days.map(d=>`<div class="day ${d.detail!=='No attendance code shown'?'has-note':''}"><strong>${d.day}</strong><small>${E(d.detail)}</small></div>`).join('')+'</div><p>No code shown does not certify perfect attendance. HAC labels can describe individual periods, school closures, or attendance codes. This version displays the default HAC attendance month. Use official HAC to browse other months.</p>';return;
   }
   target.innerHTML=record.tables.map(t=>{
     let rows=t.rows.map((cells,index)=>({cells,index}));
     if(kind==='schedule'){
       const day=document.getElementById('imported-day').value,q=document.getElementById('imported-schedule-search').value.toLowerCase(),d=t.headers.indexOf('Days');
       rows=rows.filter(r=>(!day||r.cells[d]?.split(/[,\s]+/).includes(day))&&r.cells.join(' ').toLowerCase().includes(q));
     }
     return `<h3>${E(t.title)}</h3><div class="table-scroll"><table><thead><tr>${t.headers.map(h=>`<th>${E(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.cells.map((v,i)=>{const email=t.headers[i]==='Teacher'?t.emails?.[r.index]:'';return `<td>${E(v||'—')}${email&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)?`<small><a class="text-link" href="mailto:${E(encodeURIComponent(email))}">Email teacher ↗</a></small>`:''}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div>${rows.length?'':'<p>No rows in this view.</p>'}`;
   }).join('');
 }
 document.querySelectorAll('[data-refresh-records]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;try{await GX.message('gx-refresh-records');state=await GX.message('gx-state');render();}catch(e){document.getElementById('record-sync-status').textContent=e.message;}finally{b.disabled=false;}}));
 document.getElementById('imported-day')?.addEventListener('change',render);document.getElementById('imported-schedule-search')?.addEventListener('input',render);
 document.addEventListener('xpress-session',e=>{state=e.detail;render();});
 if(GX.extension)chrome.storage.onChanged.addListener((changes,area)=>{if(area==='session'&&changes['gx-session']){state=changes['gx-session'].newValue;render();}});
 render();
})().catch(e=>{const s=document.getElementById('record-sync-status');if(s)s.textContent='Unable to read records: '+e.message;});
