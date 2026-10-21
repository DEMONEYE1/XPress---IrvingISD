/* Read-only adapters for the verified Irving HAC legacy tables. */
(()=>{
 'use strict';
 const text=e=>(e?.textContent||'').replace(/\s+/g,' ').trim().slice(0,500);
 function table(el,required){
   if(!el)throw Error('The expected HAC table is unavailable.');
   const rows=Array.from(el.rows),headers=Array.from(rows[0]?.cells||[]).map(text);
   if(!required.every(h=>headers.includes(h)))throw Error('HAC column labels changed.');
   return {headers,rows:rows.slice(1).filter(r=>r.cells.length===headers.length).slice(0,500).map(r=>Array.from(r.cells).map(text))};
 }
 function parse(doc,kind){
   if(kind==='schedule'){
     const el=doc.querySelector('#plnMain_dgSchedule2'),data=table(el,['Course','Description','Periods','Teacher','Days']);
     const rows=Array.from(el.rows).slice(1).filter(r=>r.cells.length===data.headers.length);
     data.emails=rows.map(r=>{const href=r.cells[data.headers.indexOf('Teacher')]?.querySelector('a[href^="mailto:"]')?.getAttribute('href')||'';const address=href.slice(7).split('?')[0];return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)?address.slice(0,200):'';});
     return {kind,tables:[{title:'HAC class schedule',...data}]};
   }
   if(kind==='report-card')return {kind,tables:[{title:'HAC report-card view',...table(doc.querySelector('#plnMain_dgReportCard'),['Course','Description','Att.Credit','Ern. Credit'])}]};
   if(kind==='transcript'){
     const els=Array.from(doc.querySelectorAll('table[id*="rpTranscriptGroup_dgCourses_"]'));
     if(!els.length)throw Error('No transcript course tables are available.');
     const tables=els.map(el=>{const suffix=el.id.split('_').pop(),year=text(doc.querySelector('[id$="lblYearValue_'+suffix+'"]'));return {title:year||'Transcript course group',...table(el,['Course','Description','Credit'])};});
     const gpa=doc.querySelector('table[id$="tblCumGPAInfo"]');if(gpa)tables.push({title:'GPA and rank reported by HAC',...table(gpa,['GPA Type','GPA','Rank'])});
     return {kind,tables};
   }
   if(kind==='attendance'){
     const el=doc.querySelector('#plnMain_cldAttendance');if(!el)throw Error('The attendance calendar is unavailable.');
     const month=text(el.querySelector('.sg-asp-calendar-header tr')?.cells[1]);if(!/^[A-Za-z]+ \d{4}$/.test(month))throw Error('Calendar month was not recognized.');
     const days=Array.from(el.rows).filter(r=>r.cells.length===7).flatMap(r=>Array.from(r.cells)).map(cell=>{
       const day=Number(text(cell));if(!Number.isInteger(day)||day<1||day>31)return null;
       const labels=Array.from(cell.querySelectorAll('[aria-label]')).map(e=>e.getAttribute('aria-label').replace(new RegExp('^'+day+',?\\s*'),'').slice(0,1500)).filter(Boolean);
       return {day,detail:labels.join(' · ')||'No attendance code shown'};
     }).filter(Boolean);
     return {kind,month,days,tables:[]};
   }
   throw Error('Unsupported school record.');
 }
 globalThis.GradeXpressRecords={parse};
})();
