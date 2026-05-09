import { getCookie } from './utils.js';

export const API = (function(){
  var base='/api';
  function j(r){
    if(!r.ok){
      return r.json().catch(function(){ return {error:'HTTP '+r.status}; }).then(function(payload){
        throw new Error(payload.error || ('HTTP ' + r.status));
      });
    }
    return r.json();
  }
  function csrf(){ return window.__mtCsrfToken || getCookie('mt_csrf') || ''; }
  function f(m,u,b){
    var o={method:m,credentials:'include',headers:{}};
    if(m !== 'GET' && m !== 'HEAD'){
      o.headers['X-CSRF-Token'] = csrf();
    }
    if(b){o.headers['Content-Type']='application/json';o.body=JSON.stringify(b);}
    return fetch(base+u,o);
  }
  return {
    csrfToken:()=>f('POST','/csrf-token',{}).then(j).then(function(d){ window.__mtCsrfToken = d.csrfToken || getCookie('mt_csrf') || ''; return d; }),
    login:(user,password)=>f('POST','/login',{user,password}).then(j),
    signup:(user,password,email)=>f('POST','/signup',{user,password,email}).then(j),
    bootstrap:()=>f('GET','/bootstrap').then(j),
    logout:()=>f('POST','/logout').then(j),
    changePassword:(old_password,new_password)=>f('POST','/change-password',{old_password,new_password}).then(j),
    getCategories:()=>f('GET','/categories').then(j),
    saveCategories:(c)=>f('POST','/categories',{categories:c}).then(j),
    renameCategory:(type,oldName,newName,category)=>f('POST','/rename-category',{type,old_name:oldName,new_name:newName,category}).then(j),
    getStage:()=>f('GET','/current-month').then(j),
    saveStage:(rows)=>f('POST','/current-month',{transactions:rows}).then(j),
    getPast:()=>f('GET','/past-data').then(j),
    savePast:(rows)=>f('POST','/past-data',{past_data:rows}).then(j),
    saveTransactions:(rows)=>f('POST','/transactions',{transactions:rows}).then(j),
    getSettings:()=>f('GET','/settings').then(j),
    saveSettings:(settings)=>f('POST','/settings',{settings}).then(j),
    importData:(payload)=>f('POST','/import',payload).then(j),
    clearAll:()=>f('POST','/clear-all').then(j),
    deleteAccount:(password)=>f('POST','/account/delete',{password}).then(j),
    exportData:()=>fetch(base+'/export',{method:'GET',credentials:'include'}).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.blob(); }),
    getStatistics:(payload)=>f('POST','/statistics',payload).then(j),
    getSummary:()=>f('GET','/summary').then(j),
    uploadFiles:(files, tag, year, mapping)=>{
      var fd = new FormData();
      (files || []).forEach(function(file){ fd.append('files', file); });
      fd.append('tag', String(tag));
      fd.append('year', String(year));
      if(mapping){ fd.append('mapping', JSON.stringify(mapping)); }
      return fetch(base+'/upload', {method:'POST', credentials:'include', headers:{'X-CSRF-Token':csrf()}, body:fd}).then(j);
    },
    autoCategorize:(rows)=>f('POST','/auto-categorize',{transactions:rows}).then(j),
    statsSummary:(filters)=>f('POST','/statistics/summary',filters).then(j),
    statsCategoryLast3:(filters)=>f('POST','/statistics/category_last3_mean',filters).then(j),
    statsIncomeMeans:(filters)=>f('POST','/statistics/income_means',filters).then(j),
    statsRollup:(filters)=>f('POST','/statistics/rollup',filters).then(j),
  };
})();
