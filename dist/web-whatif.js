(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  $('web-whatif').addEventListener('submit',e=>{
    e.preventDefault();const current=Number($('web-current').value),score=Number($('web-score').value),weight=Number($('web-weight').value)/100,target=Number($('web-target').value);
    if(![current,score,target].every(v=>Number.isFinite(v)&&v>=0&&v<=100)||!Number.isFinite(weight)||weight<=0||weight>1)return;
    const projected=current*(1-weight)+score*weight,required=(target-current*(1-weight))/weight;
    $('web-result').textContent=projected.toFixed(2)+'%';
    $('web-result-copy').textContent=`With a ${score}% component worth ${(weight*100).toFixed(2).replace(/\.00$/,'')}% of your final grade, your projected average is ${projected.toFixed(2)}%.`;
    $('web-required').textContent=required>100?`A ${target}% final average would require ${required.toFixed(2)}% on this component, above the 100% maximum in this model.`:required<=0?`Your ${target}% target is already reached even with 0% on this component, under this model.`:`To reach ${target}%, you need at least ${(Math.ceil((required-1e-10)*100)/100).toFixed(2)}% on this component.`;
  });
})();
