/* Read-only HAC parser. No requests, credentials, raw HTML, or personal contact fields. */
(() => {
 'use strict';
 const clean = value => String(value ?? '').replace(/\s+/g,' ').trim().slice(0,500);
 const text = node => clean(node?.textContent);
 const number = value => {const s=clean(value).replace(/%$/,'').trim();return /^-?\d+(\.\d+)?$/.test(s)&&Number.isFinite(Number(s))?Number(s):null;};
 function parse(doc) {
   const blocks=[...doc.querySelectorAll('.AssignmentClass')];
   if(!blocks.length) return null;
   const courses=blocks.slice(0,100).map((block,index)=>{
     const name=text(block.querySelector('a.sg-header-heading'));
     const header=text(block.querySelector('[id*="lblHdrAverage"]'));
     const averageCells=[...block.querySelectorAll('table[id*="tblAverage"] tr:first-child td')];
     // HAC supplies the official average; do not recompute from rounded assignment scores.
     const percentIndex=averageCells.findIndex(c=>text(c)==='%');
     const detailedAverage=percentIndex>0?number(text(averageCells[percentIndex-1])):null;
     const displayed=header.match(/(-?\d+(?:\.\d+)?)\s*%?$/);
     const average=displayed?number(displayed[1]):detailedAverage;
     const table=block.querySelector('table[id*="dgCourseAssignments"]');
     const headers=table?[...table.rows[0].cells].map(c=>text(c).toLowerCase()):[];
     const required=['assignment','score','total points','date due','category'];
     if(!table||!required.every(h=>headers.includes(h))||!name)throw new Error('HAC table layout has changed. No grades were imported.');
     const cell=(row,label)=>row.cells[headers.indexOf(label)];
     const assignments=[...table.querySelectorAll('tr.sg-asp-table-data-row')].slice(0,2000).map((row,i)=>{
       const scoreText=text(cell(row,'score'));
       const score=number(scoreText),points=number(text(cell(row,'total points')));
       const status=/^(m|missing)$/i.test(scoreText)?'Missing':/^(ex|exc|excused)$/i.test(scoreText)?'Excused':score!==null?'Scored':scoreText?'Code':'Unscored';
       return {id:`c${index}-a${i}`,name:text(cell(row,'assignment')?.querySelector('a')||cell(row,'assignment')),due:text(cell(row,'date due')),assigned:text(cell(row,'date assigned')),category:text(cell(row,'category')),score,scoreText,points,weight:number(text(cell(row,'weight'))),status};
     });
     const categories=[...block.querySelectorAll('table[id*="dgCourseCategories"] tr.sg-asp-table-data-row')].map(row=>{
       const c=[...row.cells].map(text);return {name:c[0],earned:number(c[1]),possible:number(c[2]),percent:number(c[3]),weight:number(c[4]),contribution:number(c[5])};
     });
     return {id:`c${index}`,name,average,gradeLabel:header.replace(/\s+-?\d+(\.\d+)?%?$/,'').trim(),updated:text(block.querySelector('[id*="lblLastUpdDate"]')),assignments,categories};
   });
   const run=doc.querySelector('#plnMain_ddlReportCardRuns')?.selectedOptions[0];
   const cls=doc.querySelector('#plnMain_ddlClasses')?.selectedOptions[0];
   return {schemaVersion:1,period:clean(run?.textContent||'Current view'),periodKey:clean(run?.value||''),scope:clean(cls?.textContent||'Current classes'),courses};
 }
 globalThis.GradeXpressParser={parse,number};
})();
