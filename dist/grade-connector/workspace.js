(() => {
 'use strict';
 const extension=location.protocol==='chrome-extension:'&&!!globalThis.chrome?.runtime?.id;
 const key='gx-workspaces';
 const fresh=()=>({active:'default',profiles:[{id:'default',name:'My workspace',role:'Student',tasks:[],bells:[],bellDate:'',bellDay:'A'}]});
 async function load(){try{const v=extension?(await chrome.storage.local.get(key))[key]:JSON.parse(localStorage.getItem(key)||'null');return v?.profiles?.length&&v.profiles.some(p=>p.id===v.active)?v:fresh();}catch{return fresh();}}
 async function save(v){if(extension)await chrome.storage.local.set({[key]:v});else localStorage.setItem(key,JSON.stringify(v));}
 async function message(type){if(!extension)return window.XpressSession?XpressSession.message(type):null;const result=await chrome.runtime.sendMessage({type});if(result?.error)throw Error(result.error);return result;}
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 window.GX={extension,load,save,message,escape,localDate,id:()=>crypto.randomUUID(),active:db=>db.profiles.find(p=>p.id===db.active),snapshot:async()=>(await message('gx-state'))?.snapshot||null};
})();
