import React from 'react';
import dayjs from 'dayjs';
import { API } from '../api.js';
import { fmt2, parseAmount, formatDMY, parseDMYtoISO, asArray, getCookie } from '../utils.js';

export default function TransactionsTab({rows,setRows,categories,onSaved,t,hasPastData,past=[]}){
  const [msg,setMsg]=React.useState(''); const [sortKey,setSortKey]=React.useState('date'); const [sortDir,setSortDir]=React.useState('asc');
  const [q,setQ]=React.useState('');
  // Upload modal state
  const [showUploadModal, setShowUploadModal] = React.useState(false);
  const [pendingFiles, setPendingFiles] = React.useState([]);
  const [uploadTag, setUploadTag] = React.useState(dayjs().month()+1);
  const [uploadYear, setUploadYear] = React.useState(dayjs().year());
  const [uploading, setUploading] = React.useState(false);
  const [uploadStep, setUploadStep] = React.useState('');
  const [uploadReport, setUploadReport] = React.useState([]);
  const [dragging, setDragging] = React.useState(false);
  const [dupModal, setDupModal] = React.useState(null);
  const [useMapping, setUseMapping] = React.useState(false);
  const [manualMap, setManualMap] = React.useState({date:0,name:1,amount:2,debit:3});

  function addManual(){
    const now = dayjs();
    const date_iso = now.format('YYYY-MM-DD');
    const tagVal = (now.month() + 1) + '/' + String(now.year()).slice(-2);
    const r={
      id:'m_'+Date.now(),
      tag: tagVal,
      _tag_manual: false,
      date: date_iso,
      date_iso: date_iso,
      date_str: formatDMY(date_iso),
      year: now.year(),
      month_tag: now.month() + 1,
      name:'', amount:0, debit:0, currency:'ILS', type:'Expense', category:'', subcategory:'', notes:'', vi:false, manual:true
    };
    const next=[r].concat(rows); setRows(next); API.saveStage(next).catch(()=>{});
  }
  function addFiles(filesList){
    const all = Array.from(filesList || []);
    if(!all.length) return;
    const accepted = [];
    const rejected = [];
    all.forEach(f=>{
      const ext = (f.name || '').toLowerCase().split('.').pop();
      const validExt = ['csv','xls','xlsx'].includes(ext);
      const validSize = f.size <= (12 * 1024 * 1024);
      if(validExt && validSize) accepted.push(f);
      else rejected.push(f.name || 'unnamed');
    });
    if(rejected.length){
      alert('Rejected files: ' + rejected.join(', ') + '. Supported: .csv, .xls, .xlsx up to 12MB each.');
    }
    if(accepted.length){
      setPendingFiles(prev=>{
        const next = prev.slice();
        accepted.forEach(file=>{
          const dup = next.some(x=>x.name===file.name && x.size===file.size && x.lastModified===file.lastModified);
          if(!dup) next.push(file);
        });
        return next;
      });
      setShowUploadModal(true);
    }
  }
  function onFileSelect(e){
    addFiles(e.target.files);
    e.target.value='';
  }
  function onDropFiles(e){
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }
  function removeQueuedFile(index){
    setPendingFiles(prev=>prev.filter((_,i)=>i!==index));
  }
  async function doUpload(){
    if(!pendingFiles.length) return;
    var tag=uploadTag, year=uploadYear;
    if(!isFinite(tag)||tag<1||tag>12){ alert('Tag must be 1–12'); return; }
    if(!isFinite(year)||year<2000||year>2100){ alert('Year must be 2000–2100'); return; }
    setUploading(true);
    setUploadStep('Uploading files...');
    try{
      const mappingPayload = useMapping ? {
        date: Number(manualMap.date),
        name: Number(manualMap.name),
        amount: Number(manualMap.amount),
        debit: Number(manualMap.debit)
      } : null;
      const result = await API.uploadFiles(pendingFiles, tag, year, mappingPayload);
      if (!result.ok) { alert(result.error || 'Upload failed'); return; }
      setUploadStep('Parsing and categorizing...');
      const autoed = result.transactions || [];
      setUploadReport(result.files || []);
      setRows(autoed);
      const successCount = (result.files || []).filter(f=>f.ok).length;
      const failCount = (result.files || []).filter(f=>!f.ok).length;
      setMsg('✅ Imported ' + autoed.length + ' rows from ' + successCount + ' file(s)' + (failCount ? (' | ' + failCount + ' failed') : '') + ' | Tag: ' + tag + '/' + String(year).slice(-2));
      await API.saveStage(autoed);
      setUploadStep('Done');
    }catch(err){ alert('Parse failed: '+err.message); }
    finally{
      setUploading(false);
      setShowUploadModal(false);
      setPendingFiles([]);
      setUseMapping(false);
    }
  }
  function doSave(){
    API.saveTransactions(rows)
      .then(()=>API.saveStage([]).catch(()=>{}))
      .then(()=>{ setRows([]); setMsg(''); onSaved(); })
      .catch(err=>alert('Save failed: '+err.message));
  }
  function saveAll(){
    if(!rows.length){ alert('No transactions to save'); return; }
    const needCatRows = rows.filter(r=>!r.category);
    const needSubRows = rows.filter(r=>!r.subcategory);
    if(needCatRows.length){ alert('Please set Category for all rows. ' + needCatRows.length + ' row(s) missing.'); return; }
    if(needSubRows.length){ alert('Please set Sub-category for all rows. ' + needSubRows.length + ' row(s) missing.'); return; }
    const dupes = rows.filter(r =>
      (past||[]).some(p =>
        p.name?.trim().toLowerCase() === r.name?.trim().toLowerCase() &&
        Math.abs((p.amount ?? 0) - (r.amount ?? 0)) < 0.01 &&
        p.date_iso === r.date_iso
      )
    );
    if(dupes.length){ setDupModal({ dupes, proceed: doSave }); return; }
    doSave();
  }
  function patch(id,patch){ const i=rows.findIndex(r=>r.id===id); if(i<0) return; const next=rows.slice(); next[i]=Object.assign({},next[i],patch); setRows(next); API.saveStage(next).catch(()=>{}); }
  function delRow(id){ const next=rows.filter(r=>r.id!==id); setRows(next); API.saveStage(next).catch(()=>{}); }
  function toggleType(id){ const r=rows.find(x=>x.id===id); if(!r) return; patch(id,{type:r.type==='Expense'?'Income':'Expense'}); }
  const allowedCurrencies = (window.settings && window.settings.allowedCurrencies) || ["ILS","USD"];
  function toggleCurrency(id){
    const r=rows.find(x=>x.id===id); if(!r) return;
    const allowed = allowedCurrencies.length ? allowedCurrencies : ["ILS","USD"];
    const cur = r.currency || allowed[0];
    const idx = allowed.indexOf(cur);
    const next = allowed[(idx+1)%allowed.length];
    patch(id,{currency:next});
  }
  function onAmount(id,val){ const r=rows.find(x=>x.id===id); if(!r) return; const amt=parseAmount(val); patch(id,{amount:Math.abs(amt)}); }
  function onDebit(id,val){ const r=rows.find(x=>x.id===id); if(!r) return; const amt=parseAmount(val); patch(id,{debit:Math.abs(amt)}); }
  function onDebitEditChange(id, val){
    patch(id, { debit_edit: val });
  }
  function onDebitEditBlur(id){
    const r = rows.find(x => x.id === id); if (!r) return;
    const raw = (r.debit_edit != null ? r.debit_edit : r.debit);
    const n = parseAmount(raw);
    patch(id, { debit: Math.abs(n||0), debit_edit: undefined });
  }

  const needCat = rows.filter(r=>!r.subcategory).length; const categorized=rows.length-needCat;
  const totalSigned=rows.reduce((a,r)=>a+(r.type==='Income'?-Number(r.debit||0):Number(r.debit||0)),0);
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

  const filtered = React.useMemo(() => {
    const x = (q || '').trim().toLowerCase();
    if (!x) return rows;
    return (rows || []).filter(r => {
      const displayTag = String(r.tag||'').includes('/') ? r.tag : ((r.month_tag||r.tag||'') + '/' + String(r.year||'').slice(-2));
      return [
        r.date, r.name, r.notes, r.category, r.subcategory, displayTag,
        String(r.amount||0), String(r.debit||0)
      ].some(v => String(v == null ? '' : v).toLowerCase().includes(x));
    });
  }, [rows, q]);

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

  async function deleteAllTransactions() {
    if (!rows.length) { alert('No transactions to delete'); return; }
    if (!window.confirm('Are you sure you want to delete all current (last upload) transactions?')) return;
    try {
      await fetch('/api/current-month/reset', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCookie('mt_csrf') || '' } });
      setRows([]);
      setMsg('All current month transactions deleted.');
    } catch (err) {
      alert('Failed to delete: ' + (err.message || err));
    }
  }
  return (
    <React.Fragment>
      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={()=>{ if(!uploading){setShowUploadModal(false);setPendingFiles([]);} }}>
          <div className="modal-card" onClick={e=>e.stopPropagation()}>
            <h3>📁 {t ? t('upload_statement') : 'Upload bank statements'}</h3>
            <div className={'upload-dropzone' + (dragging ? ' dragging' : '')}
              onDragEnter={(e)=>{e.preventDefault(); setDragging(true);}}
              onDragOver={(e)=>{e.preventDefault(); setDragging(true);}}
              onDragLeave={(e)=>{e.preventDefault(); setDragging(false);}}
              onDrop={onDropFiles}
            >
              Drag & drop files here, or choose files
              <div style={{marginTop:8}}>
                <label className="btn btn-xs" aria-label="Choose files to upload">Choose Files
                  <input type="file" multiple accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={onFileSelect}/>
                </label>
              </div>
            </div>
            {!!pendingFiles.length && (
              <ul className="upload-file-list">
                {pendingFiles.map((f, idx)=>(
                  <li key={f.name+'_'+f.size+'_'+idx}>
                    {f.name} ({Math.round(f.size/1024)} KB)
                    <button className="btn btn-xs danger" style={{marginLeft:8}} onClick={()=>removeQueuedFile(idx)} disabled={uploading}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
            <label>Month Tag</label>
            <select value={uploadTag} onChange={e=>setUploadTag(Number(e.target.value))}>
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m=><option key={m} value={m}>{m} - {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]}</option>)}
            </select>
            <label>Year</label>
            <input type="number" value={uploadYear} onChange={e=>setUploadYear(Number(e.target.value))} min="2000" max="2100"/>
            {uploadStep && <div className="muted" style={{marginTop:10}}>{uploadStep}</div>}
            <div className="modal-actions">
              <button className="btn" onClick={()=>{setShowUploadModal(false);setPendingFiles([]);}} disabled={uploading}>Cancel</button>
              <button className="btn primary" onClick={doUpload} disabled={uploading || !pendingFiles.length}>{uploading?'⏳ Uploading…':'✅ Upload'}</button>
            </div>
          </div>
        </div>
      )}
      {dupModal && (
        <div className="modal-overlay" onClick={()=>setDupModal(null)}>
          <div className="modal-card" onClick={e=>e.stopPropagation()}>
            <h3>⚠️ Duplicate Transactions Detected</h3>
            <p style={{margin:'8px 0 4px',fontSize:14,color:'#667085'}}>
              {dupModal.dupes.length} transaction{dupModal.dupes.length>1?'s':''} already exist in your past data with the same name, amount, and date:
            </p>
            <ul style={{margin:'4px 0 16px',paddingLeft:20,fontSize:13,color:'#374151',maxHeight:150,overflowY:'auto'}}>
              {dupModal.dupes.map((r,i)=><li key={i}>{r.name} — {r.date_iso} — {fmt2(r.amount)}</li>)}
            </ul>
            <div className="modal-actions">
              <button className="btn" onClick={()=>setDupModal(null)}>Keep Editing</button>
              <button className="btn danger" onClick={()=>{ setDupModal(null); dupModal.proceed(); }}>Save Anyway</button>
            </div>
          </div>
        </div>
      )}
      {msg && <div className="toast-bar">{msg}</div>}
      {!!uploadReport.length && (
        <div className="panel" style={{marginBottom:10,padding:'10px 12px'}}>
          <div style={{fontWeight:700,marginBottom:6}}>Upload Report</div>
          {uploadReport.map((r,idx)=>(
            <div key={idx} style={{fontSize:13,color:r.ok?'#166534':'#991b1b'}}>
              {r.ok ? '✅' : '⚠️'} {r.file || 'Unnamed file'} {r.ok ? ('(' + r.count + ' rows)') : ('- ' + (r.error || 'Failed'))}
            </div>
          ))}
        </div>
      )}
      {!hasPastData && !rows.length && (
        <div className="onboarding-card">
          <h4>Start Here</h4>
          <div style={{fontSize:13,color:'#475569',marginBottom:8}}>{t ? t('no_transactions') : 'No transactions yet. Upload your first bank statement to get started.'}</div>
          <ol style={{margin:'0 0 0 18px',padding:0}}>
            <li>Create or review categories in the Categories tab.</li>
            <li>Upload one or more statement files.</li>
            <li>Review category/type suggestions and click Save All.</li>
          </ol>
        </div>
      )}
      <div className="kpis">
        <div className="kpi k1">Total Transactions<span className="n">{(rows.length)}</span></div>
        <div className="kpi k2">Total Amount<span className="n">₪{fmt2(totalSigned)}</span></div>
        <div className="kpi k3">Categorized<span className="n">{(categorized)}</span></div>
        <div className="kpi k4">Need Categories<span className="n">{(needCat)}</span></div>
      </div>

      <div style={{display:'flex',justifyContent:'center',marginBottom:14}}>
        <button className="btn btn-upload-cta" onClick={()=>setShowUploadModal(true)} aria-label={t ? t('upload_statement') : 'Upload bank statement'}>
          📁 {t ? t('upload_statement') : 'Upload your bank statement'}
          <span className="tooltip" title={t ? t('privacy_upload') : 'Upload CSV/XLS/XLSX up to 12MB each. Files are parsed and only saved when you click Save All.'}>?</span>
        </button>
      </div>

      <div className="controls" style={{marginBottom:10, justifyContent:'center'}}>
        <div className="left" style={{display:'flex',alignItems:'center',gap:8}}>
          <input className="input-xs" type="text" placeholder="Search by name, amount, notes…" value={q} onChange={(e)=>setQ(e.target.value)}/>
          <button className="btn btn-xs" onClick={()=>setQ('')}>Clear</button>
        </div>
        <div className="right" style={{display:'flex',alignItems:'center',gap:8}}>
          <button className="btn" onClick={addManual}>+ {t ? t('add_manual') : 'Add Manual Row'}</button>
          <button className="btn danger" style={{marginLeft:10}} onClick={deleteAllTransactions}>🗑️ {t ? t('delete_all') : 'Delete All'}</button>
          <button className="btn primary" onClick={saveAll}>💾 {t ? t('save_all') : 'Save All'}</button>
        </div>
      </div>

      <div className="panel" style={{overflowX:'auto'}}>
        <table>
          <thead><tr>
            <th className="nosort">✖</th>
            <th className="w-tag" onClick={()=>setSort('tag')}>Tag <span className="tooltip" title="Tag is month/year (for example 3/26) used for filtering and reporting.">?</span>{sortKey==='tag'?(sortDir==='asc'?' ↑':' ↓'):' ↑↓'}</th>
            <th className="w-date" onClick={()=>setSort('date')}>Date<br/><span style={{fontSize:'11px',fontWeight:600}}>(DD-MM-YYYY)</span>{sortKey==='date'?(sortDir==='asc'?' ↑':' ↓'):' ↑↓'}</th>
            {hdr('Name','name','w-name')}
            {hdr('Transaction Amount','amount','w-amt')}
            {hdr('Debit Amount (ILS)','debit','w-debit')}
            {hdr('Type','type')}
            {hdr('Category','category','w-cat')}
            {hdr('Sub-category','subcategory','w-sub')}
            {hdr('Notes','notes','w-notes')}
            <th className="w-vi" onClick={()=>setSort('vi')}>Vi <span className="tooltip" title="VI = Verify/Investigate. Mark transactions you want to review later.">?</span>{sortKey==='vi'?(sortDir==='asc'?' ↑':' ↓'):' ↑↓'}</th>
          </tr></thead>
          <tbody>
            {view.length? view.map(r=>{
              const id=r.id || (r.tag+'_'+r.date+'_'+r.name);
              const manual=!!r.manual; const currency=r.currency||'ILS';
              const currencySymbols = { ILS: '₪', USD: '$', EUR: '€', GBP: '£' };
              return (
                <tr key={id} className={r.vi?'row-vi':''}>
                  <td style={{width:48}}><button className="btn danger" aria-label={'Delete row ' + (r.name || id)} onClick={()=>delRow(id)}>✖</button></td>

                  <td className="w-tag">
                    {manual
                      ? <input
                          type="text"
                          value={r.tag_edit != null ? r.tag_edit : (String(r.tag||'').includes('/') ? r.tag : ((r.month_tag||r.tag||'') + '/' + String(r.year||'').slice(-2)))}
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
                      : <span className="ro-tag" title="Month/Year">{String(r.tag||'').includes('/') ? r.tag : ((r.month_tag!=null ? r.month_tag : (r.tag!=null ? r.tag : '')) + '/' + String(r.year||'').slice(-2))}</span>}
                  </td>

                  <td className="w-date">
                    {manual ? (
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
                            month_tag: newMonth,
                            year: newYear
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
                    ) : (
                      <input
                        className="locked"
                        readOnly={true}
                        type="text"
                        value={r.date_str || formatDMY(r.date_iso || r.date)}
                      />
                    )}
                  </td>

                  <td className="w-name" style={{textAlign:'center'}}>
                    {manual
                      ? <div className="cell-hscroll"><input className="fit" type="text" value={r.name||''} title={r.name||''} onChange={(e)=>patch(id,{name:e.target.value})}/></div>
                      : <div className="cell-hscroll ro-name" title={r.name||''}>{r.name||''}</div>}
                  </td>

                  <td className="w-amt">
                    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                      <button className="currency-toggle" onClick={()=>toggleCurrency(id)}>{currencySymbols[currency] || currency}</button>
                      {manual
                        ? <input className="num-input" type="text" value={r.amount_edit != null ? r.amount_edit : String(fmt2(r.amount))} onChange={e=>patch(id,{amount_edit:e.target.value})} onBlur={()=>{const amt=parseAmount(r.amount_edit!=null?r.amount_edit:r.amount);patch(id,{amount:Math.abs(amt)||0,amount_edit:undefined});}}/>
                        : <input className={'locked num-input'} readOnly={true} type="text" value={fmt2(r.amount)}/>
                      }
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

                  <td><button className={'type-pill '+(r.type==='Expense'?'type-exp':'type-inc')} onClick={()=>toggleType(id)}>{r.type}</button></td>
                  <td className="w-cat"><select value={r.category||''} onChange={(e)=>patch(id,{category:e.target.value, subcategory:''})}><option value="">— Pick —</option>{Object.keys(categories).map(c=><option key={c} value={c}>{c}</option>)}</select></td>
                  <td className="w-sub"><select value={r.subcategory||''} onChange={(e)=>patch(id,{subcategory:e.target.value})}><option value="">—</option>{((categories[r.category])||[]).map(s=><option key={s} value={s}>{s}</option>)}</select></td>
                  <td className="w-notes" style={{textAlign:'left'}}><input type="text" value={r.notes||''} onChange={(e)=>patch(id,{notes:e.target.value})}/></td>
                  <td className="w-vi"><input type="checkbox" checked={!!r.vi} onChange={(e)=>patch(id,{vi:e.target.checked})}/></td>
                </tr>
              );
            }) : <tr><td colSpan="11" style={{textAlign:'center',color:'#6b7280'}}>No Transactions Yet</td></tr>}
            {view.length > 0 && <tr style={{borderTop:'3px solid #6b46c1',backgroundColor:'#f5f3ff'}}><td></td><td></td><td></td><td style={{fontWeight:800,textAlign:'center',color:'#2c2761'}}>{view.length} rows</td><td></td><td style={{fontWeight:800,textAlign:'center',color:'#2c2761'}}>₪{fmt2(view.reduce((a,r)=>{ const d=Number(r.debit||0); return (r.type==='Income'||r.type==='income') ? a-d : a+d; },0))}</td><td></td><td></td><td></td><td></td><td></td></tr>}
          </tbody>
        </table>
      </div>
    </React.Fragment>
  );
}
