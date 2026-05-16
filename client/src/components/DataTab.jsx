import React from 'react';
import dayjs from 'dayjs';
import { API } from '../api.js';
import { fmt2, parseAmount, formatDMY, parseDMYtoISO } from '../utils.js';

export default function DataTab({past,categories,onSaved,initialFilter,onDirtyChange}){
  const [rows,setRows]=React.useState(Array.isArray(past)?past.slice():[]);
  const [q,setQ]=React.useState(''); const [viOnly,setViOnly]=React.useState(false); const [sortKey,setSortKey]=React.useState('date'); const [sortDir,setSortDir]=React.useState('asc'); const [saving,setSaving]=React.useState(false);
  const [savedSnapshot,setSavedSnapshot]=React.useState(JSON.stringify(Array.isArray(past)?past:[]));
  const [showSaveConfirm, setShowSaveConfirm] = React.useState(false);
  React.useEffect(()=>{ const s=Array.isArray(past)?past.slice():[]; setRows(s); setSavedSnapshot(JSON.stringify(s)); },[JSON.stringify(past||[])]);
  const isDirty = React.useMemo(()=> JSON.stringify(rows) !== savedSnapshot, [rows, savedSnapshot]);
  React.useEffect(()=>{ if(onDirtyChange) onDirtyChange(isDirty); },[isDirty]);

  function getChangesSummary() {
    const origRows = JSON.parse(savedSnapshot);
    const origMap = {}; origRows.forEach(r => { if(r.id) origMap[r.id] = r; });
    const curMap = {}; rows.forEach(r => { if(r.id) curMap[r.id] = r; });
    const changes = [];
    origRows.forEach(r => { if(r.id && !curMap[r.id]) changes.push('Deleted: ' + (r.name || r.id)); });
    rows.forEach(r => { if(r.id && !origMap[r.id]) changes.push('Added: ' + (r.name || r.id)); });
    const fields = ['tag','month_tag','date','name','amount','debit','type','category','subcategory','notes','vi','currency','year'];
    rows.forEach(r => {
      if(!r.id || !origMap[r.id]) return;
      const orig = origMap[r.id];
      const diffs = [];
      fields.forEach(f => {
        const ov = orig[f] == null ? '' : String(orig[f]);
        const nv = r[f] == null ? '' : String(r[f]);
        if(ov !== nv) diffs.push(f + ': "' + ov + '" → "' + nv + '"');
      });
      if(diffs.length) changes.push('Modified "' + (r.name||r.id) + '": ' + diffs.join(', '));
    });
    return changes;
  }

  const totalTx=rows.length; const catCount=Object.keys(categories||{}).length;
  const activeMonths=(function(list){var s={}; list.forEach(r=>{var t=String(r.tag||r.month_tag||''); if(t&&t!=='0') s[t]=1;}); return Object.keys(s).length;})(rows);
  const tags = React.useMemo(() => rows.map(r => String(r.tag||'')).filter(Boolean), [rows]);
  const defaultTagYear = React.useMemo(() => {
    let bestYear = 0, bestTag = 0;
    (rows || []).forEach(r => {
      let y = Number(r.year || 0);
      let t = Number(r.month_tag || 0);
      const tagStr = String(r.tag || '');
      const sl = tagStr.indexOf('/');
      if (sl >= 0) {
        t = Number(tagStr.substring(0, sl)) || 0;
        const yyStr = tagStr.substring(sl + 1);
        y = yyStr.length <= 2 ? (Number(yyStr) || 0) + 2000 : (Number(yyStr) || 0);
      }
      if (y > bestYear || (y === bestYear && t > bestTag)) { bestYear = y; bestTag = t; }
    });
    return bestTag && bestYear ? bestTag + '/' + String(bestYear).slice(-2) : '';
  }, [rows]);
  const [filterCol, setFilterCol] = React.useState(initialFilter ? initialFilter.col : (tags.length ? 'tag' : ''));
  const [filterVal, setFilterVal] = React.useState(initialFilter ? initialFilter.val : (defaultTagYear || ''));
  const [filter2Col, setFilter2Col] = React.useState(initialFilter ? (initialFilter.col2 || '') : '');
  const [filter2Val, setFilter2Val] = React.useState(initialFilter ? (initialFilter.val2 || '') : '');
  const [filter3Col, setFilter3Col] = React.useState(initialFilter ? (initialFilter.col3 || '') : '');
  const [filter3Val, setFilter3Val] = React.useState(initialFilter ? (initialFilter.val3 || '') : '');
  React.useEffect(() => {
    if (initialFilter && initialFilter.col && initialFilter.val) {
      setFilterCol(initialFilter.col);
      setFilterVal(initialFilter.val);
      setFilter2Col(initialFilter.col2 || '');
      setFilter2Val(initialFilter.val2 || '');
      setFilter3Col(initialFilter.col3 || '');
      setFilter3Val(initialFilter.val3 || '');
    }
  }, [initialFilter && initialFilter.col, initialFilter && initialFilter.val, initialFilter && initialFilter.col2, initialFilter && initialFilter.val2, initialFilter && initialFilter.col3, initialFilter && initialFilter.val3]);
  React.useEffect(() => {
    if (initialFilter) return;
    if (defaultTagYear && (!filterCol || filterCol === 'tag') && (!filterVal || filterVal !== defaultTagYear)) {
      setFilterCol('tag');
      setFilterVal(defaultTagYear);
    }
  }, [defaultTagYear]);
  function patch(id,p){ const i=rows.findIndex(r=>r.id===id); if(i<0) return; const n=rows.slice(); n[i]=Object.assign({},n[i],p); setRows(n); }
  function delRow(id){ setRows(rows.filter(r=>r.id!==id)); }
  function toggleType(id){ const r=rows.find(x=>x.id===id); if(!r) return; patch(id,{type:r.type==='Expense'?'Income':'Expense'}); }
  const allowedCurrencies = (window.settings && window.settings.allowedCurrencies) || ["ILS","USD"];
  function toggleCurrency(id) {
    const r = rows.find(x => x.id === id); if (!r) return;
    const allowed = allowedCurrencies.length ? allowedCurrencies : ["ILS","USD"];
    const cur = r.currency || allowed[0];
    const idx = allowed.indexOf(cur);
    const next = allowed[(idx+1)%allowed.length];
    patch(id, { currency: next });
  }
  function onAmountEditChange(id, val){ patch(id, { amount_edit: val }); }
  function onAmountEditBlur(id){
    const r = rows.find(x => x.id === id); if (!r) return;
    const raw = (r.amount_edit != null ? r.amount_edit : r.amount);
    const n = parseAmount(raw);
    patch(id, { amount: Math.abs(n||0), amount_edit: undefined });
  }
  function onDebitEditChange(id, val){ patch(id, { debit_edit: val }); }
  function onDebitEditBlur(id){
    const r = rows.find(x => x.id === id); if (!r) return;
    const raw = (r.debit_edit != null ? r.debit_edit : r.debit);
    const n = parseAmount(raw);
    patch(id, { debit: Math.abs(n||0), debit_edit: undefined });
  }
  const categoryOptions = React.useMemo(() => {
    const fromData = Array.from(new Set(rows.map(r => r.category).filter(Boolean))).sort();
    const fromCategories = Object.keys(categories || {}).sort();
    return Array.from(new Set([...fromData, ...fromCategories]));
  }, [rows, categories]);

  const subcategoryOptions = React.useMemo(() => {
    const fromData = Array.from(new Set(rows.map(r => r.subcategory).filter(Boolean))).sort();
    const fromCategories = Object.values(categories || {}).flat().filter(Boolean);
    return Array.from(new Set([...fromData, ...fromCategories]));
  }, [rows, categories]);

  function save(){
    if(isDirty) { setShowSaveConfirm(true); return; }
  }
  function doSave() {
    setShowSaveConfirm(false);
    setSaving(true); API.savePast(rows).then(()=>{ setSaving(false); setSavedSnapshot(JSON.stringify(rows)); onSaved && onSaved(rows); alert('Past data updated.'); }).catch(e=>{ setSaving(false); alert('Save failed: '+e.message); });
  }
  function setSort(k){ if(sortKey===k) setSortDir(sortDir==='asc'?'desc':'asc'); else { setSortKey(k); setSortDir('asc'); } }
  function v(r,k){
    switch(k){
      case 'tag':{ const t=String(r.tag||''); const sl=t.indexOf('/'); if(sl>=0){const mm=Number(t.substring(0,sl)||0),yy=Number(t.substring(sl+1)||0); return (yy<100?yy+2000:yy)*100+mm;} return Number(r.year||0)*100+Number(r.month_tag||r.tag||0); }
      case 'date': { var ds=String(r.date||r.date_iso||'1900-01-01'); var dm=ds.match(/^(\d{2})-(\d{2})-(\d{4})$/); return dm ? new Date(dm[3]+'-'+dm[2]+'-'+dm[1]) : new Date(ds); }
      case 'name':return String(r.name||'').toLowerCase();
      case 'amount':return Number(r.amount||0);
      case 'debit':return Number(r.debit||0);
      case 'type':return String(r.type||'');
      case 'category':return String(r.category||'').toLowerCase();
      case 'subcategory':return String(r.subcategory||'').toLowerCase();
      case 'notes':return String(r.notes||'').toLowerCase();
      case 'vi':return r.vi?0:1;
      default:return '';
    }
  }
  function getDisplayTag(r) {
    if (String(r.tag||'').includes('/')) return String(r.tag);
    return (r.month_tag||r.tag||'') + '/' + String(r.year||'').slice(-2);
  }
  const filtered = React.useMemo(() => {
    const x = (q || '').trim().toLowerCase();
    return (rows || []).filter(r => {
      const displayTag = getDisplayTag(r);
      const matchText = !x || [
        r.date, r.name, r.notes, r.category, r.subcategory, displayTag,
        String(r.amount||0), String(r.debit||0)
      ].some(v => String(v == null ? '' : v).toLowerCase().includes(x));

      function matchFilter(col, val, row) {
        if (!col || !val.trim()) return true;
        const v = String(val).toLowerCase().trim();
        switch (col) {
          case 'tag': {
            const rowDisplayTag = String(row.tag||'').includes('/') ? String(row.tag) : ((row.month_tag||row.tag||'') + '/' + String(row.year||'').slice(-2));
            const slash = v.indexOf('/');
            if (slash >= 0) {
              const filterTag = v.substring(0, slash).trim();
              const filterYear = v.substring(slash + 1).trim();
              const rowSlash = rowDisplayTag.indexOf('/');
              const rowTagPart = rowSlash >= 0 ? rowDisplayTag.substring(0, rowSlash) : rowDisplayTag;
              const rowYearPart = rowSlash >= 0 ? rowDisplayTag.substring(rowSlash + 1) : '';
              const tagMatch = !filterTag || rowTagPart === filterTag;
              const yearMatch = !filterYear || rowYearPart === filterYear || String(row.year||'').endsWith(filterYear);
              return tagMatch && yearMatch;
            }
            return rowDisplayTag.toLowerCase().includes(v);
          }
          case 'name': return String(row.name == null ? '' : row.name).toLowerCase().includes(v);
          case 'category': return String(row.category == null ? '' : row.category).toLowerCase().includes(v);
          case 'subcategory': return String(row.subcategory == null ? '' : row.subcategory).toLowerCase().trim() === v;
          default: return true;
        }
      }
      const matchCol = matchFilter(filterCol, filterVal, r);
      const matchCol2 = matchFilter(filter2Col, filter2Val, r);
      const matchCol3 = matchFilter(filter3Col, filter3Val, r);
      const matchVi = !viOnly || !!r.vi;
      return matchText && matchCol && matchCol2 && matchCol3 && matchVi;
    });
  }, [rows, q, viOnly, filterCol, filterVal, filter2Col, filter2Val, filter3Col, filter3Val]);
  const view=React.useMemo(()=>{
    const a=filtered.slice();
    a.sort((x,y)=>{
      const vx=v(x,sortKey), vy=v(y,sortKey);
      let c;
      if (sortKey === 'date') {
        c = (vx.getTime()||0) - (vy.getTime()||0);
      } else if (typeof vx==='number'&&typeof vy==='number') {
        c = vx - vy;
      } else {
        c = vx < vy ? -1 : vx > vy ? 1 : 0;
      }
      return sortDir==='asc'?c:-c;
    });
    return a;
  },[filtered,sortKey,sortDir]);
  function hdr(lbl,key,cls){ const ar=sortKey===key?(sortDir==='asc'?' ↑':' ↓'):' ↑↓'; return <th className={cls||''} onClick={()=>setSort(key)}>{lbl}{ar}</th>; }
  return (
    <React.Fragment>
      {showSaveConfirm && (
        <div className="modal-overlay" style={{alignItems:'flex-start',paddingTop:'5vh'}} onClick={()=>setShowSaveConfirm(false)}>
          <div className="modal-card" onClick={e=>e.stopPropagation()} style={{maxHeight:'80vh',overflow:'auto'}}>
            <h3>💾 Confirm Save Changes</h3>
            <p style={{margin:'4px 0 12px',fontSize:13,color:'#667085'}}>The following changes will be saved:</p>
            <div style={{maxHeight:'50vh',overflowY:'auto',background:'#f9fafb',borderRadius:10,padding:12,fontSize:13,lineHeight:'1.8'}}>
              {getChangesSummary().length ? getChangesSummary().map((c,i) => <div key={i} style={{borderBottom:'1px solid #e5e7eb',padding:'4px 0'}} dir="auto">{c}</div>) : <div className="muted">No changes detected.</div>}
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={()=>setShowSaveConfirm(false)}>Cancel</button>
              <button className="btn primary" onClick={doSave}>✅ Save</button>
            </div>
          </div>
        </div>
      )}
      <div className="section-title">📊 Transaction Data</div>
      <div className="kpis">
        <div className="kpi k1">Total Transactions<span className="n">{(totalTx)}</span></div>
        <div className="kpi k3">Categories<span className="n">{(catCount)}</span></div>
        <div className="kpi k1">Active Months<span className="n">{(activeMonths)}</span></div>
      </div>
      <div className="panel" style={{marginBottom:12}}>
        {/* Row 1: search + vi toggle + save */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <input className="input-xs" type="text" placeholder="Search by name, amount, notes…" value={q} onChange={(e)=>setQ(e.target.value)} style={{minWidth:220,height:'40px'}}/>
            <button className="btn btn-xs" onClick={()=>setQ('')} style={{height:'40px'}}>Clear</button>
            <button
              onClick={()=>setViOnly(v=>!v)}
              style={{
                height:'40px', padding:'0 14px', borderRadius:20, border:'2px solid',
                cursor:'pointer', fontWeight:700, fontSize:13, whiteSpace:'nowrap',
                transition:'all 0.15s',
                borderColor: viOnly ? '#6b46c1' : '#d1d5db',
                background: viOnly ? '#6b46c1' : '#fff',
                color: viOnly ? '#fff' : '#6b7280',
                boxShadow: viOnly ? '0 0 0 3px rgba(107,70,193,0.18)' : 'none',
              }}>
              {viOnly ? '★ VI Only' : '☆ VI Only'}
            </button>
          </div>
          <button className="btn btn-xs primary" onClick={save} disabled={saving} style={{height:'40px'}}>{saving?'Saving…':'💾 Save Changes'}</button>
        </div>
        {/* Row 2: column filters */}
        <div style={{display:'flex',alignItems:'flex-end',gap:16,flexWrap:'wrap'}}>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            <label style={{fontWeight:600,fontSize:12,color:'#374151',marginLeft:2}}>Primary</label>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <select className="input-xs" style={{minWidth:130,height:'40px'}} value={filterCol} onChange={e=>setFilterCol(e.target.value)}>
                <option value="">Filter by…</option>
                <option value="tag">Tag (month/year)</option>
                <option value="name">Name</option>
                <option value="category">Category</option>
                <option value="subcategory">Sub-category</option>
              </select>
              {(filterCol === 'category' || filterCol === 'subcategory') ? (
                <React.Fragment>
                  <select className="input-xs" style={{minWidth:120,height:'40px'}} value={filterVal} onChange={e=>setFilterVal(e.target.value)} disabled={!filterCol}>
                    <option value="">All {filterCol}s</option>
                    {(filterCol === 'category' ? categoryOptions : subcategoryOptions).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  <span style={{fontSize:'12px',color:'#9ca3af'}}>or</span>
                  <input className="input-xs" style={{minWidth:80,height:'40px'}} type="text" placeholder="Type…" value={filterVal} onChange={e=>setFilterVal(e.target.value)} disabled={!filterCol}/>
                </React.Fragment>
              ) : (
                <input className="input-xs" style={{minWidth:120,height:'40px'}} type="text" placeholder={filterCol === 'tag' ? 'e.g. 2/26' : 'Value'} value={filterVal} onChange={e=>setFilterVal(e.target.value)} disabled={!filterCol}/>
              )}
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            <label style={{fontWeight:600,fontSize:12,color:'#374151',marginLeft:2}}>Secondary</label>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <select className="input-xs" style={{minWidth:130,height:'40px'}} value={filter2Col} onChange={e=>setFilter2Col(e.target.value)} disabled={!filterCol}>
                <option value="">(optional)…</option>
                <option value="tag">Tag (month/year)</option>
                <option value="name">Name</option>
                <option value="category">Category</option>
                <option value="subcategory">Sub-category</option>
              </select>
              {(filter2Col === 'category' || filter2Col === 'subcategory') ? (
                <React.Fragment>
                  <select className="input-xs" style={{minWidth:120,height:'40px'}} value={filter2Val} onChange={e=>setFilter2Val(e.target.value)} disabled={!filter2Col || !filterCol}>
                    <option value="">All {filter2Col}s</option>
                    {(filter2Col === 'category' ? categoryOptions : subcategoryOptions).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  <span style={{fontSize:'12px',color:'#9ca3af'}}>or</span>
                  <input className="input-xs" style={{minWidth:80,height:'40px'}} type="text" placeholder="Type…" value={filter2Val} onChange={e=>setFilter2Val(e.target.value)} disabled={!filter2Col || !filterCol}/>
                </React.Fragment>
              ) : (
                <input className="input-xs" style={{minWidth:120,height:'40px'}} type="text" placeholder={filter2Col === 'tag' ? 'e.g. 2/26' : 'Second value'} value={filter2Val} onChange={e=>setFilter2Val(e.target.value)} disabled={!filter2Col || !filterCol}/>
              )}
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            <label style={{fontWeight:600,fontSize:12,color:'#374151',marginLeft:2}}>Tertiary</label>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <select className="input-xs" style={{minWidth:130,height:'40px'}} value={filter3Col} onChange={e=>setFilter3Col(e.target.value)} disabled={!filter2Col}>
                <option value="">(optional)…</option>
                <option value="tag">Tag (month/year)</option>
                <option value="name">Name</option>
                <option value="category">Category</option>
                <option value="subcategory">Sub-category</option>
              </select>
              {(filter3Col === 'category' || filter3Col === 'subcategory') ? (
                <React.Fragment>
                  <select className="input-xs" style={{minWidth:120,height:'40px'}} value={filter3Val} onChange={e=>setFilter3Val(e.target.value)} disabled={!filter3Col || !filter2Col}>
                    <option value="">All {filter3Col}s</option>
                    {(filter3Col === 'category' ? categoryOptions : subcategoryOptions).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  <span style={{fontSize:'12px',color:'#9ca3af'}}>or</span>
                  <input className="input-xs" style={{minWidth:80,height:'40px'}} type="text" placeholder="Type…" value={filter3Val} onChange={e=>setFilter3Val(e.target.value)} disabled={!filter3Col || !filter2Col}/>
                </React.Fragment>
              ) : (
                <input className="input-xs" style={{minWidth:120,height:'40px'}} type="text" placeholder={filter3Col === 'tag' ? 'e.g. 2/26' : 'Third value'} value={filter3Val} onChange={e=>setFilter3Val(e.target.value)} disabled={!filter3Col || !filter2Col}/>
              )}
            </div>
          </div>
          {(filterCol||filterVal||filter2Col||filter2Val||filter3Col||filter3Val) && (
            <button className="btn btn-xs" style={{height:'40px',alignSelf:'flex-end'}}
              onClick={() => { setFilterCol(''); setFilterVal(''); setFilter2Col(''); setFilter2Val(''); setFilter3Col(''); setFilter3Val(''); }}>
              Reset
            </button>
          )}
        </div>
      </div>
      <div className="panel">
        <table>
          <thead><tr>
            <th className="nosort">✖</th>
            {hdr('Tag','tag','w-tag')}
            <th className="w-date" onClick={()=>setSort('date')}>Date<br/><span style={{fontSize:'11px',fontWeight:600}}>(DD-MM-YYYY)</span>{sortKey==='date'?(sortDir==='asc'?' ↑':' ↓'):' ↑↓'}</th>
            {hdr('Name','name','w-name')}
            {hdr('Transaction Amount','amount','w-amt')}
            {hdr('Debit Amount (ILS)','debit','w-debit')}
            {hdr('Type','type')}
            {hdr('Category','category','w-cat')}
            {hdr('Sub-category','subcategory','w-sub')}
            {hdr('Notes','notes','w-notes')}
            {hdr('Vi','vi')}
          </tr></thead>
          <tbody>
            {view.length? view.map((r,i)=>{
              const id=r.id||('p_'+i+'_'+(r.tag||'')+'_'+(r.date||'')+'_'+(r.name||'')); const currency=r.currency||'ILS';
              return (
                <tr key={id} className={r.vi?'row-vi':''}>
                  <td style={{width:48}}><button className="btn danger" onClick={()=>delRow(id)}>✖</button></td>
                  <td className="w-tag">
                    <input
                      type="text"
                      value={r.tag_edit != null ? r.tag_edit : (String(r.tag||'').includes('/') ? r.tag : ((r.month_tag!=null ? r.month_tag : (r.tag!=null ? r.tag : '')) + '/' + String(r.year||'').slice(-2)))}
                      onChange={(e)=>{
                        const v = e.target.value.replace(/[^0-9\/]/g, '');
                        patch(id,{tag_edit: v});
                      }}
                      onBlur={(e)=>{
                        const val = (r.tag_edit != null ? r.tag_edit : '').trim();
                        const tagMatch = val.match(/^0*(\d{1,2})\/(\d{2})$/);
                        if(tagMatch){
                          const mm=Number(tagMatch[1]), yy=Number(tagMatch[2])+2000;
                          if(mm>=1 && mm<=12){
                            const normalized = mm + '/' + tagMatch[2];
                            patch(id,{tag:normalized, month_tag:mm, year:yy, tag_edit:undefined, _tag_manual:true});
                          } else {
                            patch(id,{tag_edit:undefined});
                          }
                        } else {
                          patch(id,{tag_edit:undefined});
                        }
                      }}
                      placeholder="e.g. 2/26"
                      title="Month/Year (M/YY e.g. 2/26)"
                      style={{width:70,textAlign:'center'}}
                    />
                  </td>
                  <td className="w-date">
                    <input
                      type="text"
                      placeholder="DD-MM-YYYY"
                      value={r.date_str || formatDMY(r.date_iso || r.date)}
                      onChange={(e)=>{
                        const dmyValue = e.target.value.replace(/[^0-9\-]/g, '');
                        const isoValue = parseDMYtoISO(dmyValue);
                        const d = dayjs(isoValue);
                        const newMonth = d.isValid() ? d.month() + 1 : (r.month_tag || Number(String(r.tag||'').split('/')[0]) || 1);
                        const newYear = d.isValid() ? d.year() : (r.year || dayjs().year());
                        const updates = {
                          date: isoValue,
                          date_iso: isoValue,
                          date_str: dmyValue,
                          year: newYear,
                          month_tag: newMonth
                        };
                        if(!r._tag_manual){
                          updates.tag = newMonth + '/' + String(newYear).slice(-2);
                        }
                        patch(id, updates);
                      }}
                      onBlur={(e)=>{
                        const val = (r.date_str || '').trim();
                        if(val && !/^\d{2}-\d{2}-\d{4}$/.test(val)){
                          const d = dayjs(parseDMYtoISO(val));
                          if(d.isValid()){
                            patch(id, {date_str: d.format('DD-MM-YYYY'), date: d.format('YYYY-MM-DD'), date_iso: d.format('YYYY-MM-DD')});
                          }
                        }
                      }}
                    />
                  </td>
                  <td className="w-name" style={{textAlign:'center'}}>
                    <div className="cell-hscroll"><input className="fit" type="text" value={r.name||''} title={r.name||''} onChange={(e)=>patch(id,{name:e.target.value})}/></div>
                  </td>
                  <td className="w-amt">
                    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                      {(() => {
                        const currencySymbols = { ILS: '₪', USD: '$', EUR: '€', GBP: '£' };
                        return <button className="currency-toggle" onClick={()=>toggleCurrency(id)}>{currencySymbols[currency] || currency}</button>;
                      })()}
                      <input
                        className="num-input"
                        type="text"
                        value={(r.amount_edit != null ? r.amount_edit : String(fmt2(r.amount)))}
                        onChange={(e)=>onAmountEditChange(id, e.target.value)}
                        onBlur={()=>onAmountEditBlur(id)}
                      />
                    </div>
                  </td>
                  <td className="w-debit">
                    <input
                      className="num-input"
                      type="text"
                      value={(r.debit_edit != null ? r.debit_edit : String(fmt2(r.debit)))}
                      onChange={(e)=>onDebitEditChange(id, e.target.value)}
                      onBlur={()=>onDebitEditBlur(id)}
                    />
                  </td>
                  <td><button className={'type-pill '+(r.type==='Expense'?'type-exp':'type-inc')} onClick={()=>toggleType(id)}>{r.type||'Expense'}</button></td>
                  <td className="w-cat"><select value={r.category||''} onChange={(e)=>patch(id,{category:e.target.value, subcategory:''})}><option value="">— Select —</option>{Object.keys(categories||{}).sort((a,b)=>a.localeCompare(b)).map(c=><option key={c} value={c}>{c}</option>)}</select></td>
                  <td className="w-sub"><select value={r.subcategory||''} onChange={(e)=>patch(id,{subcategory:e.target.value})}><option value="">— Select —</option>{((categories||{})[r.category]||[]).slice().sort((a,b)=>a.localeCompare(b)).map(s=><option key={s} value={s}>{s}</option>)}</select></td>
                  <td className="w-notes" style={{textAlign:'left'}}><input type="text" value={r.notes||''} onChange={(e)=>patch(id,{notes:e.target.value})}/></td>
                  <td><input type="checkbox" checked={!!r.vi} onChange={(e)=>patch(id,{vi:e.target.checked})}/></td>
                </tr>
              );
            }) : <tr><td colSpan="11" style={{textAlign:'center',color:'#6b7280'}}>No saved data yet.</td></tr>}
            {view.length > 0 && <tr style={{borderTop:'3px solid #6b46c1',backgroundColor:'#f5f3ff'}}><td></td><td></td><td></td><td style={{fontWeight:800,textAlign:'center',color:'#2c2761'}}>{view.length} rows</td><td></td><td style={{fontWeight:800,textAlign:'center',color:'#2c2761'}}>₪{fmt2(view.reduce((a,r)=>{ const d=Number(r.debit||0); return (r.type==='Income'||r.type==='income') ? a-d : a+d; },0))}</td><td></td><td></td><td></td><td></td><td></td></tr>}
          </tbody>
        </table>
      </div>
    </React.Fragment>
  );
}
