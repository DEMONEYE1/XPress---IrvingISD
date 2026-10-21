(() => {
 'use strict';
 const $=id=>document.getElementById(id),panel=$('web-login'),form=$('hac-login');
 if(!form)return;
 let busy=false,wasAuthenticated=false;
 const show=()=>{panel.hidden=false;$('hac-user').focus();panel.scrollIntoView({behavior:'smooth',block:'center'});};
 document.addEventListener('xpress-show-login',show);
 document.addEventListener('xpress-session',event=>{
  const state=event.detail;
  panel.hidden=state.authenticated;
  $('refresh-hac').disabled=!state.authenticated||busy;
  $('signout-hac').hidden=!state.authenticated;
  $('connect').hidden=state.authenticated;
  if(!state.authenticated){if(wasAuthenticated)$('hac-pass').value='';if(state.serverAvailable===false)$('login-status').textContent=state.message;}
  wasAuthenticated=state.authenticated;
 });
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  busy=true;$('login-submit').disabled=true;$('login-status').textContent='Signing in securely with HAC…';
  try{
   const user=$('hac-user').value.trim(),password=$('hac-pass').value;
   const result=await XpressSession.login(user,password);$('hac-pass').value='';
   if(result.authenticated){$('hac-user').value='';$('login-status').textContent='';panel.hidden=true;await XpressSession.refresh(true);}
  }catch(error){$('hac-pass').value='';$('login-status').textContent=error.message;}
  finally{busy=false;$('login-submit').disabled=false;$('refresh-hac').disabled=!XpressSession.current().authenticated;}
 });
 $('refresh-hac').addEventListener('click',async()=>{
  if(busy)return;busy=true;$('refresh-hac').disabled=true;
  try{await XpressSession.refresh();}catch(error){$('login-status').textContent=error.message;}
  finally{busy=false;$('refresh-hac').disabled=!XpressSession.current().authenticated;}
 });
 $('signout-hac').addEventListener('click',async()=>{try{await XpressSession.logout();$('login-status').textContent='Signed out of Xpress. Imported records have been cleared.';}catch(error){$('login-status').textContent=error.message;}});
 XpressSession.get();
})();
