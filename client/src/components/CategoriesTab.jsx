import React from 'react';
import { Tag } from 'lucide-react';
import { API } from '../api.js';
import CategoryCard from './CategoryCard.jsx';

export default function CategoriesTab({user, categories, onSaved, onRenameApplied}){
  const [cats,setCats]=React.useState(categories||{});
  const [q,setQ]=React.useState(''); const [newCat,setNewCat]=React.useState('');
  React.useEffect(()=>setCats(categories||{}),[categories]);
  const names=React.useMemo(()=>Object.keys(cats).sort((a,b)=>a.localeCompare(b)),[cats]);
  const totalCats=names.length, totalSubs=names.reduce((a,c)=>a+(cats[c]?cats[c].length:0),0), avgPer=totalCats?totalSubs/totalCats:0;
  function persist(next){ setCats(next); API.saveCategories(next).catch(()=>{}); onSaved && onSaved(next); }
  function refresh(){ API.getCategories().then(s=>{ setCats(s||{}); onSaved && onSaved(s||{}); }); }
  function addCategory(){ const name=newCat.trim(); if(!name) return; if(cats[name]){alert('Category exists'); return;} persist(Object.assign({},cats,{[name]:[]})); setNewCat(''); }
  function deleteCategory(c){ if(!confirm('Delete category "'+c+'"?')) return; const n=Object.assign({},cats); delete n[c]; persist(n); }
  function addSub(c,s){ if(!s.trim()) return; const arr=(cats[c]||[]).slice(); if(arr.indexOf(s)!==-1){alert('Sub exists'); return;} arr.push(s); persist(Object.assign({},cats,{[c]:arr})); }
  function delSub(c,s){ persist(Object.assign({},cats,{[c]:(cats[c]||[]).filter(x=>x!==s)})); }
  function renameCategory(oldName,newName){
    if(cats[newName]){alert('Category "'+newName+'" already exists');return;}
    API.renameCategory('category',oldName,newName,null)
      .then(res=>{
        if(!res.ok){alert(res.error||'Rename failed');return;}
        const next={}; Object.keys(cats).forEach(k=>{next[k===oldName?newName:k]=cats[k];});
        persist(next);
        onRenameApplied&&onRenameApplied('category',oldName,newName,null);
      })
      .catch(e=>alert('Rename failed: '+e.message));
  }
  function renameSub(catName,oldSub,newSub){
    const subs=cats[catName]||[];
    if(subs.includes(newSub)){alert('Subcategory "'+newSub+'" already exists');return;}
    API.renameCategory('subcategory',oldSub,newSub,catName)
      .then(res=>{
        if(!res.ok){alert(res.error||'Rename failed');return;}
        persist(Object.assign({},cats,{[catName]:subs.map(s=>s===oldSub?newSub:s)}));
        onRenameApplied&&onRenameApplied('subcategory',oldSub,newSub,catName);
      })
      .catch(e=>alert('Rename failed: '+e.message));
  }
  const filtered=React.useMemo(()=>{ const x=q.trim().toLowerCase(); if(!x) return names; return names.filter(c=>c.toLowerCase().includes(x) || (cats[c]||[]).some(s=>String(s).toLowerCase().includes(x))); },[q,names,cats]);
  return (
    <React.Fragment>
      <div className="section-title"><Tag size={20}/>Category Management for {user}</div>
      <div className="kpis">
        <div className="kpi k1">Categories<span className="n">{(totalCats)}</span></div>
        <div className="kpi k2">Subcategories<span className="n">{(totalSubs)}</span></div>
        <div className="kpi k3">Avg per Category<span className="n">{(avgPer.toFixed(1))}</span></div>
      </div>
      <div className="panel" style={{marginBottom:12}}>
        <div className="toolbar" style={{gridTemplateColumns:'1fr auto'}}>
          <div className="left"><input className="input-xs" type="text" placeholder="Search categories & subcategories" value={q} onChange={(e)=>setQ(e.target.value)}/></div>
          <div className="right"><input className="input-xs" type="text" placeholder="New category name…" value={newCat} onChange={(e)=>setNewCat(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter') addCategory();}}/><button className="btn btn-xs primary" onClick={addCategory}>+ Add Category</button></div>
        </div>
      </div>
      <div className="cat-grid">
        {filtered.length===0 && <div className="panel" style={{gridColumn:'1 / -1'}}>No categories match your search.</div>}
        {filtered.map(c=><CategoryCard key={c} cat={c} subs={cats[c]||[]} onDeleteCat={deleteCategory} onAddSub={addSub} onDeleteSub={delSub} onRenameCat={renameCategory} onRenameSub={renameSub} searchQuery={q}/>)}
      </div>
    </React.Fragment>
  );
}
