import React from 'react';
import { API } from '../api.js';

export default function ChangePasswordForm({onDone}){
  const [oldPw,setOldPw]=React.useState('');
  const [newPw,setNewPw]=React.useState('');
  const [confirmPw,setConfirmPw]=React.useState('');
  const [msg,setMsg]=React.useState('');
  const [err,setErr]=React.useState('');
  function submit(){
    setMsg(''); setErr('');
    if(!newPw){ setErr('New password cannot be empty.'); return; }
    if(newPw !== confirmPw){ setErr('Passwords do not match.'); return; }
    API.changePassword(oldPw, newPw).then(r=>{
      if(!r.ok){ setErr(r.error || 'Failed to change password.'); return; }
      setMsg('Password changed successfully!'); setOldPw(''); setNewPw(''); setConfirmPw('');
      if(onDone) setTimeout(onDone, 1200);
    }).catch(e=>setErr('Error: '+e.message));
  }
  return (
    <div className="controls" style={{flexDirection:'column', alignItems:'stretch'}}>
      <label>Current Password</label>
      <input type="password" value={oldPw} onChange={e=>setOldPw(e.target.value)} placeholder="Enter current password"/>
      <label style={{marginTop:8}}>New Password</label>
      <input type="password" value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="Enter new password"/>
      <label style={{marginTop:8}}>Confirm New Password</label>
      <input type="password" value={confirmPw} onChange={e=>setConfirmPw(e.target.value)} placeholder="Confirm new password" onKeyDown={e=>{if(e.key==='Enter') submit();}}/>
      {err && <div style={{color:'#dc2626',fontSize:13,marginTop:6,fontWeight:600}}>{err}</div>}
      {msg && <div style={{color:'#16a34a',fontSize:13,marginTop:6,fontWeight:600}}>{msg}</div>}
      <div style={{marginTop:10}}><button className="btn primary" onClick={submit}>Change Password</button></div>
    </div>
  );
}
