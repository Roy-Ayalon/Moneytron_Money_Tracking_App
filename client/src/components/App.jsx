import React from 'react';
import { Wallet, BarChart2, TrendingUp, Table2, Tag, BookOpen, Lock, AlertTriangle } from 'lucide-react';
import { API } from '../api.js';
import { makeTranslator, asArray, asCategories, getCookie } from '../utils.js';
import LoginView from './LoginView.jsx';
import TransactionsTab from './TransactionsTab.jsx';
import DataTab from './DataTab.jsx';
import SummaryTab from './SummaryTab.jsx';
import StatisticsTab from './StatisticsTab.jsx';
import CategoriesTab from './CategoriesTab.jsx';
import TutorialTab from './TutorialTab.jsx';
import ChangePasswordForm from './ChangePasswordForm.jsx';

export default function App(){
  const [user,setUser]=React.useState(null);
  const [tab,setTab]=React.useState('transactions');
  const [categories,setCategories]=React.useState({});
  const [past,setPast]=React.useState([]);
  const [stage,setStage]=React.useState([]);
  const [settings,setSettings]=React.useState({dateFormat:'YYYY-MM-DD', currency:'ILS'});
  const [dataFilter, setDataFilter]=React.useState(null);
  const t = React.useMemo(()=>makeTranslator('en'), []);

  function reload(){
    return API.bootstrap().then(d=>{
      setUser(d.user||''); setCategories(asCategories(d.categories)); setPast(asArray(d.past_data)); setStage(asArray(d.current_month));
    }).then(()=> API.getSettings().then(s=>{
      setSettings(s);
      window.settings = s;
    }).catch(()=>{}));
  }
  React.useEffect(()=>{
    API.csrfToken().catch(()=>{}).then(()=>reload().catch(()=>{}));
  },[]);

  const [dataChangesRef] = React.useState({current: false});
  const [dataDirty, setDataDirty] = React.useState(false);
  const [pendingTab, setPendingTab] = React.useState(null);
  const [pendingFilter, setPendingFilter] = React.useState(null);
  const [showUnsavedModal, setShowUnsavedModal] = React.useState(false);
  const [showChangePwModal, setShowChangePwModal] = React.useState(false);

  function doLogin(name, password){
    API.login(name, password).then(r=>{
      if(!r.ok){
        if(window._loginSetErr) window._loginSetErr(r.error || 'Login failed');
        return;
      }
      window.__mtCsrfToken = r.csrfToken || getCookie('mt_csrf') || '';
      setUser(name); setTab('transactions'); return reload();
    }).catch(err=>{
      if(window._loginSetErr) window._loginSetErr('Login failed: '+err.message);
    });
  }
  function doSignup(name, password, email){
    API.signup(name, password, email).then(r=>{
      if(!r.ok){
        if(window._loginSetErr) window._loginSetErr(r.error || 'Sign up failed');
        return;
      }
      window.__mtCsrfToken = r.csrfToken || getCookie('mt_csrf') || '';
      setUser(name); setTab('transactions'); return reload();
    }).catch(err=>{
      if(window._loginSetErr) window._loginSetErr('Sign up failed: '+err.message);
    });
  }

  if(!user) return <LoginView onLogin={doLogin} onSignup={doSignup} t={t}/>;

  function handleDataDirty(dirty) { dataChangesRef.current = dirty; setDataDirty(dirty); }

  function trySetTab(id, filter) {
    if (tab === 'data' && dataChangesRef.current) {
      setPendingTab(id); setPendingFilter(filter || null); setShowUnsavedModal(true); return;
    }
    if (tab === 'transactions' && stage.length) { API.saveStage(stage).catch(()=>{}); }
    setDataFilter(filter || null); setTab(id);
  }
  function confirmDiscardChanges() {
    setShowUnsavedModal(false); dataChangesRef.current = false; setDataDirty(false);
    if (pendingTab) { setDataFilter(pendingFilter); setTab(pendingTab); setPendingTab(null); setPendingFilter(null); }
  }
  function cancelTabSwitch() { setShowUnsavedModal(false); setPendingTab(null); setPendingFilter(null); }

  function tabBtn(id,label,icon){ return <button className={'tab'+(tab===id?' active':'')} onClick={()=>trySetTab(id)}>{icon}{label}</button>; }
  function onSavedTx(){ setStage([]); reload().then(()=> trySetTab('summary')); }
  function handleCategoryRenamed(type, oldName, newName, parentCat){
    function patchRow(row){
      if(!row) return row;
      if(type==='category' && row.category===oldName) return Object.assign({},row,{category:newName});
      if(type==='subcategory' && row.category===parentCat && row.subcategory===oldName) return Object.assign({},row,{subcategory:newName});
      return row;
    }
    setPast(function(prev){ return prev.map(patchRow); });
    setStage(function(prev){ return prev.map(patchRow); });
  }
  function navigateToData(filter){ trySetTab('data', filter); }
  return (
    <div className="wrap">
      <h1 className="title">{t('app_title')}</h1>
      {showUnsavedModal && (
        <div className="modal-overlay" onClick={cancelTabSwitch}>
          <div className="modal-card" onClick={e=>e.stopPropagation()}>
            <h3><AlertTriangle size={20}/>Unsaved Changes</h3>
            <p style={{margin:'8px 0 16px',fontSize:14,color:'#667085'}}>You have unsaved changes in the Data tab. Do you want to discard them?</p>
            <div className="modal-actions">
              <button className="btn" onClick={cancelTabSwitch}>Cancel (Stay)</button>
              <button className="btn danger" onClick={confirmDiscardChanges}>Discard & Switch</button>
            </div>
          </div>
        </div>
      )}
      <div className="frame">
        <div className="topbar">
          <div className="pill welcome">{t('welcome')}, {user}!</div>
          <button className="ghost btn" onClick={()=>setShowChangePwModal(true)} style={{display:'inline-flex',alignItems:'center',gap:6}}><Lock size={14}/>Change Password</button>
          <button className="ghost btn" onClick={()=>{ API.logout().then(()=>setUser(null)); }}>Switch User</button>
        </div>
        {showChangePwModal && (
          <div className="modal-overlay" onClick={()=>setShowChangePwModal(false)}>
            <div className="modal-card" onClick={e=>e.stopPropagation()}>
              <h3><Lock size={20}/>Change Password</h3>
              <ChangePasswordForm onDone={()=>setShowChangePwModal(false)}/>
            </div>
          </div>
        )}
        <div className="tabs">
          {tabBtn('transactions',t('tabs_transactions'),<Wallet size={16} strokeWidth={2.5}/>)}
          {tabBtn('summary',t('tabs_summary'),<BarChart2 size={16} strokeWidth={2.5}/>)}
          {tabBtn('statistics',t('tabs_statistics'),<TrendingUp size={16} strokeWidth={2.5}/>)}
          {tabBtn('data',t('tabs_data'),<Table2 size={16} strokeWidth={2.5}/>)}
          {tabBtn('categories',t('tabs_categories'),<Tag size={16} strokeWidth={2.5}/>)}
          {tabBtn('tutorial',t('tabs_tutorial'),<BookOpen size={16} strokeWidth={2.5}/>)}
        </div>
        {tab==='transactions' && <TransactionsTab rows={stage} setRows={setStage} categories={categories} onSaved={onSavedTx} t={t} hasPastData={!!past.length} past={past}/>}
        {tab==='data' && <DataTab key={dataFilter ? JSON.stringify(dataFilter) : 'default'} past={past} categories={categories} onSaved={(rows)=>{ dataChangesRef.current=false; setDataDirty(false); reload(); }} initialFilter={dataFilter} onDirtyChange={handleDataDirty}/>}
        {tab==='summary' && <SummaryTab past={past} active={tab==='summary'} onNavigateToData={navigateToData}/>}
        {tab==='categories' && <CategoriesTab user={user} categories={categories} onSaved={setCategories} onRenameApplied={handleCategoryRenamed}/>}
        {tab==='statistics' && <StatisticsTab past={past} categories={categories}/>}
        {tab==='tutorial' && <TutorialTab/>}
      </div>
    </div>
  );
}
