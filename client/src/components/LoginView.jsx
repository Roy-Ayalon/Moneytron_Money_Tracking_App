import React from 'react';
import { LogIn, UserPlus, AlertTriangle, Wallet } from 'lucide-react';

export default function LoginView({onLogin, onSignup, t}){
  const nameRef=React.useRef(null);
  const pwRef=React.useRef(null);
  const [err,setErr]=React.useState('');
  const [mode,setMode]=React.useState('login');
  const [signupName,setSignupName]=React.useState('');
  const [signupPw,setSignupPw]=React.useState('');
  const [signupPw2,setSignupPw2]=React.useState('');
  const [signupEmail,setSignupEmail]=React.useState('');
  const [signupMsg,setSignupMsg]=React.useState('');
  function doLogin(){
    var n=(nameRef.current&&nameRef.current.value||'').trim(); if(!n) return;
    var pw=(pwRef.current&&pwRef.current.value||'');
    setErr('');
    onLogin(n, pw);
  }
  function doSignup(){
    setErr(''); setSignupMsg('');
    if(!signupName.trim()){ setErr('Username is required.'); return; }
    if(!signupPw){ setErr('Password is required.'); return; }
    if(signupPw !== signupPw2){ setErr('Passwords do not match.'); return; }
    if(!signupEmail.trim()){ setErr('Email is required.'); return; }
    onSignup(signupName.trim(), signupPw, signupEmail.trim());
  }
  // Expose setErr so parent can show errors
  React.useEffect(()=>{ window._loginSetErr = setErr; window._signupSetMsg = setSignupMsg; return ()=>{ delete window._loginSetErr; delete window._signupSetMsg; }; },[]);
  return (
    <div className="wrap" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'80vh'}}>
      <h1 className="title">{t ? t('app_title') : 'MoneyTron - Multi-User Money Tracker'}</h1>
      {mode === 'login' ? (
        <div className="login-card">
          <div className="login-brand-mark"><Wallet size={30} color="#fff" strokeWidth={2}/></div>
          <h2><LogIn size={22}/>{t ? t('welcome') : 'Welcome'}</h2>
          <div className="login-sub">Sign in to manage your finances</div>
          <input ref={nameRef} type="text" placeholder="Enter your name (e.g., Yoav)" onKeyDown={(e)=>{if(e.key==='Enter' && pwRef.current) pwRef.current.focus();}}/>
          <input ref={pwRef} type="password" placeholder="Password" style={{marginTop:8}} onKeyDown={(e)=>{if(e.key==='Enter') doLogin();}}/>
          {err && <div className="login-error"><AlertTriangle size={14}/>{err}</div>}
          <button className="pill" onClick={doLogin}>{t ? t('login') : 'Login'}</button>
          <div style={{marginTop:14,fontSize:13,color:'#667085'}}>
            Don't have an account?{' '}
            <button className="login-switch-link" onClick={()=>{setMode('signup');setErr('');}}>{t ? t('signup') : 'Sign Up'}</button>
          </div>
        </div>
      ) : (
        <div className="login-card">
          <div className="login-brand-mark"><Wallet size={30} color="#fff" strokeWidth={2}/></div>
          <h2><UserPlus size={22}/>Create Account</h2>
          <div className="login-sub">Sign up to start tracking your finances</div>
          <label>Username</label>
          <input type="text" placeholder="Choose a username" value={signupName} onChange={e=>setSignupName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') document.getElementById('signup-pw').focus();}}/>
          <label>Password</label>
          <input id="signup-pw" type="password" placeholder="Create a password" value={signupPw} onChange={e=>setSignupPw(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') document.getElementById('signup-pw2').focus();}}/>
          <label>Confirm Password</label>
          <input id="signup-pw2" type="password" placeholder="Repeat your password" value={signupPw2} onChange={e=>setSignupPw2(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') document.getElementById('signup-email').focus();}}/>
          <label>Email</label>
          <input id="signup-email" type="email" placeholder="your@email.com" value={signupEmail} onChange={e=>setSignupEmail(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') doSignup();}}/>
          {err && <div className="login-error"><AlertTriangle size={14}/>{err}</div>}
          {signupMsg && <div style={{color:'#16a34a',fontSize:13,marginTop:6,fontWeight:600}}>{signupMsg}</div>}
          <button className="pill" onClick={doSignup}>{t ? t('signup') : 'Sign Up'}</button>
          <div style={{marginTop:10,fontSize:12,color:'#475569',lineHeight:1.4}}>{t ? t('privacy_signup') : 'Your data is private and tied to your account only.'}</div>
          <div style={{marginTop:14,fontSize:13,color:'#667085'}}>
            Already have an account?{' '}
            <button className="login-switch-link" onClick={()=>{setMode('login');setErr('');setSignupMsg('');}}>{t ? t('login') : 'Login'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
