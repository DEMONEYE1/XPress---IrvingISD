(() => {
 'use strict';
 let csrf='',state={status:'disconnected',snapshot:null,records:{},authenticated:false},pending=null;
 const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('xpress-auth'):null;
 const emit=()=>document.dispatchEvent(new CustomEvent('xpress-session',{detail:state}));
 function decode(payload){
  csrf=payload.csrf||csrf;
  const next={status:payload.authenticated?'loading':'disconnected',authenticated:!!payload.authenticated,serverAvailable:true,snapshot:null,records:{},recordErrors:{...payload.recordErrors}};
  for(const [kind,record] of Object.entries(payload.documents||{})){
   try{
    const doc=new DOMParser().parseFromString(record.html,'text/html');
    if(kind==='classwork'){next.snapshot=GradeXpressParser.parse(doc);next.importedAt=record.importedAt;}
    else next.records[kind]={...GradeXpressRecords.parse(doc,kind),importedAt:record.importedAt};
   }catch{next.recordErrors[kind]='This HAC table was not recognized. Your official record remains available in HAC.';}
  }
  next.status=next.snapshot?'ready':next.authenticated?'error':'disconnected';
  next.message=next.snapshot?'Connected to HAC through Xpress. Use Refresh to read changes.':next.authenticated?(next.recordErrors.classwork||'Signed in, but no recognized course tables are available. Try Refresh or check official HAC.'):'Sign in below to see your HAC courses and assignments.';
  state=next;emit();return state;
 }
 async function request(path,body){
  const response=await fetch('/api/'+path,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json','X-Xpress-CSRF':csrf}:{},body:body?JSON.stringify(body):undefined});
  let data;try{data=await response.json();}catch{throw Error('The Xpress server is not running here. Open this site through server.py, not a static file or static host.');}
  if(!response.ok){if(response.status===401){state={status:'signed-out',authenticated:false,snapshot:null,records:{},message:data.error};emit();channel?.postMessage('changed');}throw Error(data.error||'Unable to reach the Xpress service.');}
  return decode(data);
 }
 async function get(){
  if(pending)return pending;
  pending=request('session').catch(error=>{state={status:'error',authenticated:false,snapshot:null,records:{},serverAvailable:false,message:error.message};emit();return state;}).finally(()=>pending=null);
  return pending;
 }
 async function login(username,password){await get();const result=await request('login',{username,password});channel?.postMessage('changed');return result;}
 async function refresh(recordsOnly=false){
  let result=await get();if(!result.authenticated)throw Error('Sign in to HAC first.');
  for(const kind of recordsOnly?['schedule','attendance','report-card','transcript']:['classwork','schedule','attendance','report-card','transcript']){
   try{result=await request('record/'+kind,{});}catch(error){
    if(!state.authenticated)throw error;
    await get();
   }
  }
  return result;
 }
 async function logout(){await get();await request('logout',{});channel?.postMessage('changed');return {ok:true};}
 async function message(type){
  if(type==='gx-state')return get();
  if(type==='gx-clear')return logout();
  if(type==='gx-start'){document.dispatchEvent(new Event('xpress-show-login'));return {ok:true};}
  if(type==='gx-refresh-records'){await refresh(true);return {ok:true};}
  return null;
 }
 channel?.addEventListener('message',()=>get());
 window.addEventListener('focus',()=>get());
 window.addEventListener('pageshow',()=>get());
 window.addEventListener('pagehide',()=>{state={status:'disconnected',authenticated:false,snapshot:null,records:{},message:'Refresh to reconnect.'};emit();});
 setInterval(()=>{if(!document.hidden)get();},30000);
 window.XpressSession={get,login,refresh,logout,message,current:()=>state};
})();
