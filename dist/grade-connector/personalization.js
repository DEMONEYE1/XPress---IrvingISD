/* Only appearance preferences are cookies. School records are never cookies. */
(() => {
  'use strict';
  const palettes=[
    ['graphite','Graphite','#d8ff68','#536700','#101110','#181b17','#f4f5ef','#ffffff'],
    ['ocean','Ocean','#80caff','#075e98','#0d141c','#162330','#eef6fc','#ffffff'],
    ['violet','Violet','#c3a6ff','#6940aa','#15111e','#211b2e','#f6f1fc','#ffffff'],
    ['rose','Rose','#ffabc6','#a12b54','#1c1117','#2b1b24','#fff2f6','#ffffff'],
    ['ember','Ember','#ffba87','#944209','#1a130f','#2a2019','#fff6ed','#ffffff'],
    ['mint','Mint','#85e4bf','#176b50','#0e1915','#172820','#eef9f3','#ffffff'],
    ['ice','Ice','#94e9ed','#116c75','#0d171a','#16262b','#eefafa','#ffffff'],
    ['gold','Gold','#efd38b','#785b0a','#18160f','#29261b','#fbf8ed','#ffffff'],
    ['slate','Slate','#b2c3df','#425f8b','#11151d','#1d2430','#f0f3f8','#ffffff'],
    ['mono','Mono','#eeeeee','#333333','#111111','#1c1c1c','#f3f3f3','#ffffff']
  ];
  const key='gx-appearance', isExtension=location.protocol==='chrome-extension:'&&!!globalThis.chrome?.runtime?.id;
  let current={theme:'graphite',mode:'dark',icon:'xpress'};
  function normalize(v){return {theme:palettes.some(p=>p[0]===v?.theme)?v.theme:'graphite',mode:['dark','light','system'].includes(v?.mode)?v.mode:'dark',icon:['xpress','orbit','book','bolt'].includes(v?.icon)?v.icon:'xpress'};}
  try {const cookie=document.cookie.split('; ').find(s=>s.startsWith(key+'='));current=normalize(JSON.parse(cookie?decodeURIComponent(cookie.split('=').slice(1).join('=')):localStorage.getItem(key)||'{}'));}catch{}
  function apply(value) {
    current=normalize(value);
    const p=palettes.find(p=>p[0]===current.theme), light=current.mode==='light'||current.mode==='system'&&matchMedia('(prefers-color-scheme: light)').matches;
    const root=document.documentElement;
    root.dataset.mode=light?'light':'dark';root.dataset.theme=p[0];root.style.colorScheme=light?'light':'dark';
    const vars={bg:light?p[6]:p[4],panel:light?p[7]:p[5],raised:light?p[6]:p[5],text:light?'#1d242b':'#f2f4f8',muted:light?'#515e69':'#a8b2c0',line:light?'#c5ccd3':'#39424c',accent:light?p[3]:p[2],lime:light?p[3]:p[2],'accent-ink':light?'#ffffff':'#11151a'};
    Object.entries(vars).forEach(([k,v])=>root.style.setProperty('--'+k,v));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',vars.bg);
    if(document.readyState!=='loading')icon(vars);
    document.dispatchEvent(new CustomEvent('gx-appearance',{detail:current}));
  }
  function icon(vars){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const c=canvas.getContext('2d');c.fillStyle=vars?.bg||getComputedStyle(document.documentElement).getPropertyValue('--bg');c.fillRect(0,0,128,128);
    c.strokeStyle=c.fillStyle=vars?.accent||getComputedStyle(document.documentElement).getPropertyValue('--accent');c.lineWidth=9;c.lineCap='round';
    if(current.icon==='xpress'){c.font='bold 88px Arial';c.fillText('X',34,95);}
    if(current.icon==='orbit'){c.beginPath();c.ellipse(64,64,42,24,-.65,0,Math.PI*2);c.stroke();c.beginPath();c.arc(64,64,9,0,Math.PI*2);c.fill();}
    if(current.icon==='book'){c.strokeRect(29,29,70,72);c.beginPath();c.moveTo(64,30);c.lineTo(64,101);c.stroke();}
    if(current.icon==='bolt'){c.beginPath();c.moveTo(73,19);c.lineTo(34,70);c.lineTo(59,70);c.lineTo(50,110);c.lineTo(96,53);c.lineTo(70,53);c.closePath();c.fill();}
    let link=document.querySelector('link[rel="icon"]');if(!link){link=document.createElement('link');link.rel='icon';document.head.append(link);}link.type='image/png';link.href=canvas.toDataURL();
    if(isExtension)chrome.action.setIcon({imageData:c.getImageData(0,0,128,128)}).catch(()=>{});
  }
  async function save(v){
    apply(v);let method='Memory only';
    try {localStorage.setItem(key,JSON.stringify(current));method='Browser storage';}catch{}
    try {document.cookie=key+'='+encodeURIComponent(JSON.stringify(current))+'; Max-Age=31536000; Path=/; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');if(document.cookie.includes(key+'='))method='Cookie · 1 year';}catch{}
    if(isExtension){await chrome.storage.local.set({[key]:current});method='Extension storage';}
    return method;
  }
  apply(current);
  document.addEventListener('DOMContentLoaded',()=>icon());
  matchMedia('(prefers-color-scheme: light)').addEventListener('change',()=>apply(current));
  if(isExtension){chrome.storage.local.get(key).then(v=>{if(v[key])apply(v[key]);});chrome.storage.onChanged.addListener((v,area)=>{if(area==='local'&&v[key]?.newValue)apply(v[key].newValue);});}
  window.XpressAppearance={palettes,get:()=>({...current}),save,download(){const link=document.createElement('a');link.download='Xpress-'+current.icon+'.png';link.href=document.querySelector('link[rel="icon"]').href;link.click();}};
})();
