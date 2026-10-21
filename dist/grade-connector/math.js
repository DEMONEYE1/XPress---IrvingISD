/* Pure planning calculations. Never writes back to HAC. */
(() => {
 'use strict';
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 function component(current,score,weight,target){
   if(![current,score,weight,target].every(finite)||weight<=0||weight>100)throw Error('Enter valid scores and a component weight above 0 and at most 100.');
   const w=weight/100;
   return {projected:current*(1-w)+score*w,needed:(target-current*(1-w))/w,maximum:100,unit:'%'};
 }
 function assignment(categories,index,earned,possible,multiplier,target){
   if(![earned,possible,multiplier,target].every(finite)||earned<0||possible<=0||multiplier<=0)throw Error('Use nonnegative earned points and positive possible points and multiplier.');
   const chosen=categories[index];
   if(!chosen||![chosen.earned,chosen.possible,chosen.weight].every(finite)||chosen.weight<=0||chosen.possible<0)throw Error('This category has no usable HAC totals or weight.');
   if(categories.some(c=>c.weight>0&&c.possible>0&&!finite(c.earned)))throw Error('A category is missing totals. Check the HAC view before estimating.');
   const active=categories.filter((c,i)=>i===index||(finite(c.earned)&&finite(c.possible)&&finite(c.weight)&&c.possible>0&&c.weight>0));
   const totalWeight=active.reduce((sum,c)=>sum+c.weight,0);
   const other=active.filter(c=>c!==chosen).reduce((sum,c)=>sum+(c.earned/c.possible)*100*c.weight,0);
   const newPossible=chosen.possible+possible*multiplier;
   const newPercent=(chosen.earned+earned*multiplier)/newPossible*100;
   const projected=(other+newPercent*chosen.weight)/totalWeight;
   const requiredPercent=(target*totalWeight-other)/chosen.weight;
   const needed=(requiredPercent/100*newPossible-chosen.earned)/multiplier;
   return {projected,needed,maximum:possible,unit:' points',categoryPercent:newPercent};
 }
 function gpa(rows,thresholds,bonusPassingOnly=true){
   if(thresholds.length!==4||!thresholds.every(finite)||thresholds[0]>100||thresholds[3]<0||thresholds.some((n,i)=>i&&n>=thresholds[i-1]))throw Error('Scale minimums must descend: A > B > C > D, between 0 and 100.');
   const points=grade=>{const i=thresholds.findIndex(t=>grade>=t);return i<0?0:4-i;};
   let credits=0,current=0,weighted=0,projected=0,projectedWeighted=0,count=0;
   for(const row of rows.filter(r=>r.include)){
     const prediction=row.projected===null?row.grade:row.projected;
     if(![row.grade,prediction,row.credits,row.bonus].every(finite)||row.grade<0||row.grade>100||prediction<0||prediction>100||row.credits<=0||row.bonus<0)throw Error('Each included course needs grades from 0–100, positive credits, and a nonnegative bonus.');
     const p=points(row.grade),q=points(prediction);credits+=row.credits;count++;
     current+=p*row.credits;projected+=q*row.credits;
     weighted+=(p+(!bonusPassingOnly||p>0?row.bonus:0))*row.credits;
     projectedWeighted+=(q+(!bonusPassingOnly||q>0?row.bonus:0))*row.credits;
   }
   return {credits,count,current:credits?current/credits:null,weighted:credits?weighted/credits:null,projected:credits?projected/credits:null,projectedWeighted:credits?projectedWeighted/credits:null};
 }
 globalThis.GradeXpressMath={component,assignment,gpa};
})();
