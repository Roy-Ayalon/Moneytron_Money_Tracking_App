import React from 'react';
import { Settings, Database, Sliders, User, Lock, Info, Download, Upload, Trash2, AlertTriangle } from 'lucide-react';
import dayjs from 'dayjs';
import { API } from '../api.js';
import ChangePasswordForm from './ChangePasswordForm.jsx';

export default function SettingsTab({ user, past, categories, stage, settings, onReload }){
  const [dateFormat, setDateFormat] = React.useState(settings.dateFormat || 'YYYY-MM-DD');
  const [currency, setCurrency] = React.useState(settings.currency || 'ILS');
  const [allowedCurrencies, setAllowedCurrencies] = React.useState(settings.allowedCurrencies || ["ILS","USD"]);
  const allCurrencies = ["ILS","USD","EUR","GBP"];
  React.useEffect(()=>{
    setDateFormat(settings.dateFormat||'YYYY-MM-DD');
    setCurrency(settings.currency||'ILS');
    setAllowedCurrencies(settings.allowedCurrencies||["ILS","USD"]);
  },[settings.dateFormat,settings.currency,settings.allowedCurrencies]);

  function toggleAllowedCurrency(cur) {
    setAllowedCurrencies(prev => prev.includes(cur) ? prev.filter(c=>c!==cur) : [...prev, cur]);
  }

  function savePrefs(){
    API.saveSettings({dateFormat,currency,allowedCurrencies}).then(()=>{
      alert('Preferences saved.');
      if (typeof onReload === 'function') onReload();
    });
  }
  function exportAll(){
    const payload={ user, categories, past_data: past, current_month:stage, settings:{dateFormat,currency,allowedCurrencies,theme:settings.theme||'light'} };
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`moneytron_${user}_export.json`; a.click(); URL.revokeObjectURL(a.href);
  }
  function onImport(e){
    const f=e.target.files&&e.target.files[0]; if(!f) return;
    const reader=new FileReader(); reader.onload=function(){ try{ const data=JSON.parse(reader.result); API.importData({categories:data.categories,past_data:data.past_data,current_month:data.current_month,settings:data.settings}).then(()=>{ alert('Imported successfully.'); onReload&&onReload(); }); }catch(err){ alert('Invalid file: '+err.message);} };
    reader.readAsText(f,'utf-8'); e.target.value='';
  }
  function clearAll(){ if(!confirm('Clear ALL data for this user? This cannot be undone.')) return; API.clearAll().then(()=>{ alert('All user data cleared.'); onReload&&onReload(); }); }

  const monthsSet={}; let lastTxVar=null, totalSpending=0;
  (past||[]).forEach(r=>{ const d=Number(r.debit||0); if(String(r.type||'').toLowerCase()!=='income') totalSpending+=d; const m=Number(r.tag||0); if(m>0) monthsSet[m]=1; if(r.date){ if(!lastTxVar || dayjs(r.date).isAfter(dayjs(lastTxVar.date))) lastTxVar=r; }});
  const avgMonthly=Object.keys(monthsSet).length? totalSpending/Object.keys(monthsSet).length : 0;
  const lastTxLabel=lastTxVar ? `${lastTxVar.date} - ${lastTxVar.name}` : 'No transactions yet';

  return (
    <div className="panel">
      <div className="section-title"><Settings size={20}/>Settings &amp; Profile for {user}</div>
      <div className="thin-underline"></div>
      <div className="section-sub">Manage your account, data, and application preferences.</div>

      <div className="grid-2">
        <div className="panel">
          <div className="section-title"><Database size={18}/>Data Management</div>
          <div className="dm-grid">
            <div className="dm-left">
              <button className="btn" onClick={exportAll} style={{display:'inline-flex',alignItems:'center',gap:6}}><Download size={14}/>Export All Data</button>
              <label className="btn" style={{display:'inline-flex',alignItems:'center',gap:6,cursor:'pointer'}}><Upload size={14}/>Import Data<input type="file" accept="application/json,.json" style={{display:'none'}} onChange={onImport}/></label>
            </div>
            <div className="dm-right">
              <button className="btn danger" onClick={clearAll} style={{display:'inline-flex',alignItems:'center',gap:6}}><Trash2 size={14}/>Clear All Data</button>
              <div className="danger-caption"><AlertTriangle size={14}/>This action cannot be undone.</div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="section-title"><Sliders size={18}/>Preferences</div>
          <div className="controls" style={{flexDirection:'column', alignItems:'stretch'}}>
            <label>Date Format</label>
            <select value={dateFormat} onChange={(e)=>setDateFormat(e.target.value)}>
              <option value="YYYY-MM-DD">YYYY-MM-DD ({dayjs().format('YYYY-MM-DD')})</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY ({dayjs().format('DD/MM/YYYY')})</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY ({dayjs().format('MM/DD/YYYY')})</option>
            </select>
            <label style={{marginTop:8}}>Default Currency</label>
            <select value={currency} onChange={(e)=>setCurrency(e.target.value)}>
              {allCurrencies.map(cur=>(<option key={cur} value={cur}>{cur}</option>))}
            </select>
            <label style={{marginTop:8}}>Allowed Currencies for Toggling</label>
            <div style={{display:'flex',gap:8,marginTop:4,marginBottom:8}}>
              {allCurrencies.map(cur=>(
                <button key={cur} className={"currency-toggle"+(allowedCurrencies.includes(cur)?" active":"")} type="button" onClick={()=>toggleAllowedCurrency(cur)} style={{fontWeight:allowedCurrencies.includes(cur)?800:400,background:allowedCurrencies.includes(cur)?'#d1fae5':'#eef2ff'}}>{cur}</button>
              ))}
            </div>
            <div style={{fontSize:12,color:'#888',marginBottom:8}}>Only selected currencies will be available for toggling in transactions/data tabs.</div>
            <div style={{marginTop:10}}><button className="btn primary" onClick={savePrefs}>Save Preferences</button></div>
          </div>
        </div>

        <div className="panel">
          <div className="section-title"><User size={18}/>Account Info</div>
          <div className="controls" style={{flexDirection:'column', alignItems:'flex-start'}}>
            <div><strong>Username:</strong> {user}</div>
            <div><strong>Avg Monthly Spending:</strong> ₪{avgMonthly.toFixed(0)}</div>
            <div><strong>Last Transaction:</strong> {lastTxLabel}</div>
            <div><strong>Data Storage:</strong> User-specific files</div>
          </div>
        </div>

        <div className="panel">
          <div className="section-title"><Lock size={18}/>Change Password</div>
          <ChangePasswordForm/>
        </div>

        <div className="panel">
          <div className="section-title"><Info size={18}/>App Information</div>
          <ul style={{marginTop:6}}>
            <li>MoneyTron Multi-User v4.0</li>
            <li>Multi-user support</li>
            <li>Personal categories</li>
            <li>Monthly workflow</li>
            <li>Data visualization</li>
            <li>Export/Import capabilities</li>
            <li>Privacy: All data stored securely on your server.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
