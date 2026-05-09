import React from 'react';
import { Pencil } from 'lucide-react';

export default function CategoryCard({cat, subs, onDeleteCat, onAddSub, onDeleteSub, onRenameCat, onRenameSub, searchQuery}){
  const [subInput,setSubInput]=React.useState('');
  const [editingCat,setEditingCat]=React.useState(false);
  const [catInput,setCatInput]=React.useState('');
  const [editingSub,setEditingSub]=React.useState(null);
  const [subRenInput,setSubRenInput]=React.useState('');
  function add(){ if(subInput.trim()){ onAddSub(cat, subInput.trim()); setSubInput(''); } }
  function commitCatRename(){ const v=catInput.trim(); if(!v||v===cat){setEditingCat(false);return;} onRenameCat&&onRenameCat(cat,v); setEditingCat(false); }
  function commitSubRename(oldSub){ const v=subRenInput.trim(); if(!v||v===oldSub){setEditingSub(null);return;} onRenameSub&&onRenameSub(cat,oldSub,v); setEditingSub(null); }
  const sq = (searchQuery||'').trim().toLowerCase();
  const catMatch = sq && cat.toLowerCase().includes(sq);
  const subMatch = (s) => sq && String(s).toLowerCase().includes(sq);
  return (
    <div className={'cat-card' + (catMatch ? ' search-highlight' : '')} dir="auto">
      <div className="cat-head">
        {editingCat
          ? <span style={{display:'flex',alignItems:'center',gap:6}}>
              <input className="input-xs" style={{minWidth:0,width:140,fontWeight:800,fontSize:16}} value={catInput} autoFocus
                onChange={e=>setCatInput(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter')commitCatRename();if(e.key==='Escape')setEditingCat(false);}}/>
              <button className="btn btn-xs primary" onClick={commitCatRename}>✓</button>
              <button className="btn btn-xs" onClick={()=>setEditingCat(false)}>✕</button>
            </span>
          : <React.Fragment><div className="cat-name" dir="auto" onDoubleClick={()=>{setCatInput(cat);setEditingCat(true);}} title="Double-click to rename" style={{cursor:'pointer'}}>{cat}</div>
              <button className="btn btn-xs" style={{fontSize:12,padding:'2px 6px',display:'inline-flex',alignItems:'center',gap:3}} title="Rename category" onClick={()=>{setCatInput(cat);setEditingCat(true);}}><Pencil size={11}/>Rename</button></React.Fragment>
        }
        <span className="badge">{(subs||[]).length} subcategories</span>
        <div style={{flex:1}}></div>
        <button className="btn btn-xs danger" onClick={()=>onDeleteCat(cat)}>Delete</button>
      </div>
      <div>
        <div>{(!subs || subs.length===0) && <div className="muted">No subcategories yet.</div>}
          {(subs||[]).map(s=>(
            <span className={'chip' + (subMatch(s) ? ' search-highlight' : '')} key={s} dir="auto">
              {editingSub===s
                ? <React.Fragment><input className="input-xs" style={{minWidth:0,width:100,fontSize:13,padding:'2px 4px'}} value={subRenInput} autoFocus
                      onChange={e=>setSubRenInput(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter')commitSubRename(s);if(e.key==='Escape')setEditingSub(null);}}/>
                    <a href="#" onClick={e=>{e.preventDefault();commitSubRename(s);}} title="Save">✓</a>
                    <a href="#" onClick={e=>{e.preventDefault();setEditingSub(null);}} title="Cancel">✕</a></React.Fragment>
                : <React.Fragment><span onDoubleClick={()=>{setEditingSub(s);setSubRenInput(s);}} title="Double-click to rename" style={{cursor:'pointer'}}>{s}</span>
                    <a href="#" onClick={e=>{e.preventDefault();setEditingSub(s);setSubRenInput(s);}} title="Rename" style={{marginRight:2,display:'inline-flex',alignItems:'center'}}><Pencil size={10}/></a>
                    <a href="#" onClick={(e)=>{e.preventDefault(); onDeleteSub(cat,s);}} title="Remove">×</a></React.Fragment>
              }
            </span>
          ))}
        </div>
        <div className="controls" style={{marginTop:8}}>
          <input className="input-xs" type="text" placeholder={'Add subcategory to '+cat} value={subInput} onChange={(e)=>setSubInput(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter') add();}}/>
          <button className="btn btn-xs" onClick={add}>+ Add</button>
        </div>
      </div>
    </div>
  );
}
