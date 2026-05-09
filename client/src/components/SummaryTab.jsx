import React from 'react';
import { Calendar, BarChart2, TrendingUp, Search, PieChart, Layers } from 'lucide-react';
import { Chart } from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { API } from '../api.js';
import { fmt2 } from '../utils.js';

Chart.register(ChartDataLabels);

export default function SummaryTab({past, active, onNavigateToData}){
  const [err,setErr]=React.useState(''); const [selectedMonth,setSelectedMonth]=React.useState(''); const [subPieCat,setSubPieCat]=React.useState(''); const [expanded,setExpanded]=React.useState({});
  const [monthRangeStart, setMonthRangeStart] = React.useState(-1);
  const mRef=React.useRef(null), nRef=React.useRef(null), catRef=React.useRef(null), subRef=React.useRef(null);
  const mChart=React.useRef(null), nChart=React.useRef(null), catPie=React.useRef(null), subPie=React.useRef(null);
  const [agg, setAgg] = React.useState({months: [], mcdAll: {}, monthNet: {}, outTotals: []});
  React.useEffect(()=>{
    API.getSummary().then(data => {
      setAgg({
        months: data.months || [],
        mcdAll: data.mcdAll || {},
        monthNet: data.monthNet || {},
        outTotals: data.outTotals || [],
      });
    }).catch(e => setErr('Failed to load summary: ' + e.message));
  }, [past]);
  const months=agg.months, monthCategoryDataAll=agg.mcdAll, monthNet=agg.monthNet, outTotals=agg.outTotals;

  const maxDisplayMonths = 6;
  const totalMonths = months.length;
  const displayMonths = React.useMemo(() => {
    if (totalMonths <= maxDisplayMonths) return months;
    const effectiveStart = monthRangeStart < 0 ? Math.max(0, totalMonths - maxDisplayMonths) : monthRangeStart;
    const startIdx = Math.max(0, Math.min(effectiveStart, totalMonths - maxDisplayMonths));
    return months.slice(startIdx, startIdx + maxDisplayMonths);
  }, [months, monthRangeStart, totalMonths]);

  const prevTotalMonthsRef = React.useRef(totalMonths);
  const hasInitialized = React.useRef(false);
  React.useEffect(() => {
    const prevTotal = prevTotalMonthsRef.current;
    if (!hasInitialized.current && totalMonths > 0) {
      hasInitialized.current = true;
      setMonthRangeStart(totalMonths > maxDisplayMonths ? totalMonths - maxDisplayMonths : 0);
    } else if (totalMonths > maxDisplayMonths && totalMonths > prevTotal) {
      setMonthRangeStart(totalMonths - maxDisplayMonths);
    }
    prevTotalMonthsRef.current = totalMonths;
  }, [totalMonths]);

  function handlePrevious() {
    const newStart = monthRangeStart - 1;
    setMonthRangeStart(newStart < 0 ? Math.max(0, totalMonths - maxDisplayMonths) : newStart);
  }
  function handleNext() {
    const newStart = monthRangeStart + 1;
    const maxStart = Math.max(0, totalMonths - maxDisplayMonths);
    setMonthRangeStart(newStart > maxStart ? 0 : newStart);
  }

  React.useEffect(()=>{ try{ if(!months.length){ setSelectedMonth(''); setSubPieCat(''); return; } var def=selectedMonth&&months.includes(selectedMonth)?selectedMonth:months[months.length-1]; setSelectedMonth(def); var cats=Object.keys(monthCategoryDataAll[def]||{}); setSubPieCat(prev=> (prev && cats.includes(prev))?prev:(cats[0]||'')); }catch(e){ setErr('Init error: '+e.message);} },[months.join(','), JSON.stringify(monthCategoryDataAll)]);

  React.useEffect(()=>{ try{
    if(!active) return;
    [mChart,nChart,catPie,subPie].forEach(R=>{ if(R.current && typeof R.current.destroy==='function'){ try{R.current.destroy();}catch(_){ } R.current=null; }});
    if(!months.length) return;
    const common={responsive:true, maintainAspectRatio:false};
    const chartMaxMonths = 12;
    const chartMonths = months.length > chartMaxMonths ? months.slice(-chartMaxMonths) : months;
    const chartOutTotals = months.length > chartMaxMonths ? outTotals.slice(-chartMaxMonths) : outTotals;
    if(mRef.current){
      const ctx=mRef.current.getContext('2d');
      mChart.current=new Chart(ctx,{
        type:'bar',
        data:{labels:chartMonths,datasets:[{label:'Monthly Outcome (₪)',data:chartOutTotals}]},
        options:Object.assign({},common,{
          plugins:{
            legend:{display:false},
            datalabels:{
              formatter:(v)=>Math.round(v).toLocaleString(),
              anchor:'end',align:'top',clamp:true
            }
          },
          scales:{y:{beginAtZero:true}}
        })
      });
    }
    if(nRef.current){
      const ctx=nRef.current.getContext('2d');
      const nvals=chartMonths.map(m=>(monthNet[m]&&monthNet[m].net)||0);
      nChart.current=new Chart(ctx,{
        type:'bar',
        data:{labels:chartMonths,datasets:[{label:'Net (₪)',data:nvals}]},
        options:Object.assign({},common,{
          plugins:{
            legend:{display:false},
            datalabels:{
              formatter:(v)=>Math.round(v).toLocaleString(),
              anchor:'end',align:'top',clamp:true
            }
          }
        })
      });
    }
    const piePlugins={legend:{position:'right'}, datalabels:{display:false}};
    function pieTooltipCallback(context) {
      const label = context.label || '';
      const value = context.parsed || 0;
      const dataArr = context.chart.data.datasets[0].data;
      const total = dataArr.reduce((a,b)=>a+b,0);
      const percent = total ? (value/total*100) : 0;
      return [label + ': ' + fmt2(value), fmt2(percent) + '%'];
    }
    const pieOptionsWithPct = Object.assign({}, common, {
      plugins: Object.assign({}, piePlugins, {
        tooltip: { callbacks: { label: pieTooltipCallback } }
      })
    });
    if(selectedMonth && catRef.current){
      const ctx=catRef.current.getContext('2d');
      const mcd=monthCategoryDataAll[selectedMonth]||{};
      const labels=Object.keys(mcd).filter(k=>(mcd[k].type||'Expense')==='Expense');
      const data=labels.map(k=>mcd[k].total);
      catPie.current=new Chart(ctx,{type:'pie',data:{labels,datasets:[{data}]},options:pieOptionsWithPct});
    }
    if(selectedMonth && subPieCat && subRef.current){
      const ctx=subRef.current.getContext('2d');
      const mcd=monthCategoryDataAll[selectedMonth]||{};
      if (mcd[subPieCat] && (mcd[subPieCat].type||'Expense')==='Expense') {
        const subs=(mcd[subPieCat]&&mcd[subPieCat].subcategories)||{};
        const labels=Object.keys(subs);
        const data=labels.map(k=>{ const subData = subs[k]; return typeof subData === 'number' ? subData : subData.total; });
        subPie.current=new Chart(ctx,{type:'pie',data:{labels,datasets:[{data}]},options:pieOptionsWithPct});
      } else {
        subPie.current=new Chart(ctx,{type:'pie',data:{labels:[],datasets:[{data:[]}]},options:pieOptionsWithPct});
      }
    }
  }catch(e){ setErr('Chart error: '+e.message); } },[active, months.join(','), selectedMonth, subPieCat, JSON.stringify(monthCategoryDataAll), JSON.stringify(monthNet)]);

  if(!(past||[]).length) return <div className="panel"><div>No data available. Upload data first.</div></div>;
  const monthCats=Object.keys(monthCategoryDataAll[selectedMonth]||{}).sort((a,b)=>a.localeCompare(b));
  React.useEffect(()=>{ if(!selectedMonth) return; if(!monthCats.length){ setSubPieCat(''); return; } if(!subPieCat || !monthCats.includes(subPieCat)) setSubPieCat(monthCats[0]); },[selectedMonth, monthCats.join(',')]);

  return (
    <div className="panel">
      {err && <div className="panel" style={{background:'#fff7ed',border:'1px solid #fcd19c',color:'#92400e'}}>⚠️ {err}</div>}
      <div className="section-title"><Calendar size={20}/>Comparison Across Months</div>
      {totalMonths > maxDisplayMonths && (
        <div className="controls" style={{marginBottom:10}}>
          <button className="btn btn-xs" onClick={handlePrevious}>← Previous</button>
          <span className="muted" style={{margin: '0 12px'}}>
            Showing months {displayMonths[0]} to {displayMonths[displayMonths.length-1]}
            ({displayMonths.length} of {totalMonths} total)
          </span>
          <button className="btn btn-xs" onClick={handleNext}>Next →</button>
          <button className="btn btn-xs" onClick={() => setMonthRangeStart(totalMonths - Math.min(maxDisplayMonths, totalMonths))} style={{marginLeft: 8}}>Latest</button>
        </div>
      )}
      <div style={{overflowX:'auto'}}>
        <table>
          <thead><tr><th>Category</th>{displayMonths.map(m=><th key={'h'+m}>{m}</th>)}</tr></thead>
          <tbody>
            {(function(){
              const allCats=(function(){
                var s={};
                displayMonths.forEach(mm=>{ if (monthCategoryDataAll[mm]) { Object.keys(monthCategoryDataAll[mm]).forEach(c=>s[c]=1); } });
                return Object.keys(s).sort((a,b)=>a.localeCompare(b));
              })();
              if(!allCats.length) return <tr><td colSpan={displayMonths.length+1} className="muted" style={{textAlign:'center'}}>No categories yet.</td></tr>;
              return allCats.filter(cat => {
                return displayMonths.some(m => {
                  const cell = monthCategoryDataAll[m] && monthCategoryDataAll[m][cat];
                  return cell && cell.total !== 0;
                });
              }).map(cat=>{
                const exp=!!expanded[cat];
                return (
                  <React.Fragment key={cat}>
                    <tr>
                      <td style={{cursor:'pointer'}} title={'Double-click to filter Data tab by "'+cat+'"'} onDoubleClick={()=>onNavigateToData && onNavigateToData({col:'category',val:cat})}>
                        <button className="btn btn-xs" onClick={()=>setExpanded(p=>Object.assign({},p,{[cat]:!p[cat]}))}>{exp?'▾':'▸'}</button> <strong>{cat}</strong>
                      </td>
                      {displayMonths.map(m=>{
                        const cell=monthCategoryDataAll[m]&&monthCategoryDataAll[m][cat];
                        const v=cell?cell.total:0;
                        const isPositive = v > 0;
                        const displayValue = v !== 0 ? (isPositive ? '+' : '') + '₪' + fmt2(Math.abs(v)) : '—';
                        return <td key={cat+'_'+m} style={{cursor:'pointer'}} title={'Double-click to filter Data tab by "'+cat+'" in month '+m} onDoubleClick={()=>onNavigateToData && onNavigateToData({col:'tag',val:m,col2:'category',val2:cat})}>
                          <strong style={{color: v > 0 ? '#16a34a' : v < 0 ? '#dc2626' : 'inherit'}}>{displayValue}</strong>
                        </td>;
                      })}
                    </tr>
                    {exp && (function(){
                      var subsSet={}; displayMonths.forEach(m=>{ var cell=monthCategoryDataAll[m]&&monthCategoryDataAll[m][cat]; if(cell){ Object.keys(cell.subcategories||{}).forEach(s=>subsSet[s]=1); }});
                      var subs=Object.keys(subsSet).sort((a,b)=>a.localeCompare(b));
                      return subs.filter(s => {
                        return displayMonths.some(m => {
                          var cell=monthCategoryDataAll[m]&&monthCategoryDataAll[m][cat];
                          var subData=cell?(cell.subcategories[s]||{total:0}):0;
                          var v = typeof subData === 'number' ? subData : subData.total;
                          return v !== 0;
                        });
                      }).map(s=>(
                        <tr key={cat+'__'+s}>
                          <td className="muted" style={{paddingLeft:42,cursor:'pointer'}} title={'Double-click to filter Data tab by category "'+cat+'" + subcategory "'+s+'"'} onDoubleClick={()=>onNavigateToData && onNavigateToData({col:'category',val:cat,col2:'subcategory',val2:s})}>↳ {s}</td>
                          {displayMonths.map(m=>{
                            var cell=monthCategoryDataAll[m]&&monthCategoryDataAll[m][cat];
                            var subData=cell?(cell.subcategories[s]||{total:0}):0;
                            var v = typeof subData === 'number' ? subData : subData.total;
                            const isPositive = v > 0;
                            const displayValue = v !== 0 ? (isPositive ? '+' : '') + '₪' + fmt2(Math.abs(v)) : '—';
                            return <td key={cat+'_'+s+'_'+m} style={{color: v > 0 ? '#16a34a' : v < 0 ? '#dc2626' : 'inherit', cursor:'pointer'}} title={'Double-click to filter Data tab by "'+s+'" in month '+m+' under "'+cat+'"'} onDoubleClick={()=>onNavigateToData && onNavigateToData({col:'tag',val:m,col2:'category',val2:cat,col3:'subcategory',val3:s})}>{displayValue}</td>;
                          })}
                        </tr>
                      ));
                    })()}
                  </React.Fragment>
                );
              });
            })()}
            <tr style={{borderTop: '4px double #6b46c1', borderBottom: '4px double #6b46c1', backgroundColor: '#fde047', boxShadow: '0 4px 12px rgba(234, 179, 8, 0.3)', transform: 'scale(1.01)'}}>
              <td style={{backgroundColor: '#fde047', padding: '14px'}}><strong style={{fontSize: '17px', fontWeight: '800', color: '#1f1b2e'}}>Net (Income − Expenses)</strong></td>
              {displayMonths.map(m=> {
                const netValue = Number((monthNet[m]&&monthNet[m].net)||0);
                const isPositive = netValue > 0;
                const displayValue = netValue !== 0 ? (isPositive ? '+' : '') + '₪' + fmt2(Math.abs(netValue)) : '₪0.00';
                return <td key={'net_'+m} style={{backgroundColor: '#fde047', padding: '14px'}}><strong style={{fontSize: '16px', fontWeight: '800', color: netValue > 0 ? '#16a34a' : netValue < 0 ? '#dc2626' : '#6b7280'}}>{displayValue}</strong></td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid-2" style={{marginTop:14}}>
        <div className="panel"><div className="section-title" style={{marginTop:0}}><BarChart2 size={18}/>Monthly Outcome (₪)</div><div className="chart-box"><canvas ref={mRef}></canvas></div></div>
        <div className="panel"><div className="section-title" style={{marginTop:0}}><TrendingUp size={18}/>Monthly Net (₪)</div><div className="chart-box"><canvas ref={nRef}></canvas></div></div>
      </div>

      <div className="section-title"><Search size={18}/>Details for Month</div>
      <div className="controls" style={{marginBottom:10}}>
        <select value={selectedMonth} onChange={(e)=>setSelectedMonth(e.target.value)}>{months.map(m=><option key={'m'+m} value={m}>{m}</option>)}</select>
        <span className="muted">Select month (tag) to focus below</span>
      </div>

      <div style={{overflowX:'auto', marginBottom:14}}>
        <table>
          <thead><tr><th>Category</th><th>Total (₪)</th></tr></thead>
          <tbody>
            {Object.keys(monthCategoryDataAll[selectedMonth]||{}).length? Object.keys(monthCategoryDataAll[selectedMonth]).sort((a,b)=>a.localeCompare(b)).map(cat=>{
              const cell=monthCategoryDataAll[selectedMonth][cat]||{total:0,subcategories:{}}; const subs=cell.subcategories||{}; const total=cell.total||0; const key='m_'+selectedMonth+'_'+cat; const exp=!!expanded[key];
              return (
                <React.Fragment key={'mrow_'+cat}>
                  <tr>
                    <td style={{cursor:'pointer'}} title={'Double-click to filter Data tab by "'+cat+'" in month '+selectedMonth} onDoubleClick={()=>onNavigateToData && onNavigateToData({col:'tag',val:selectedMonth,col2:'category',val2:cat})}><button className="btn btn-xs" onClick={()=>setExpanded(p=>Object.assign({},p,{[key]:!p[key]}))}>{exp?'▾':'▸'}</button> <strong>{cat}</strong></td>
                    <td style={{cursor:'pointer'}} title={'Double-click to filter Data tab by "'+cat+'" in month '+selectedMonth} onDoubleClick={()=>onNavigateToData && onNavigateToData({col:'tag',val:selectedMonth,col2:'category',val2:cat})}><strong style={{color: total > 0 ? '#16a34a' : total < 0 ? '#dc2626' : 'inherit'}}>
                      {total !== 0 ? (total > 0 ? '+' : '') + '₪' + fmt2(Math.abs(total)) : '₪0.00'}
                    </strong></td>
                  </tr>
                  {exp && Object.keys(subs).sort((a,b)=>a.localeCompare(b)).map(s=>{
                    var subData = subs[s];
                    var subValue = typeof subData === 'number' ? subData : subData.total;
                    const displayValue = subValue !== 0 ? (subValue > 0 ? '+' : '') + '₪' + fmt2(Math.abs(subValue)) : '₪0.00';
                    return <tr key={'mrow_'+cat+'_'+s}>
                      <td className="muted" style={{paddingLeft:42,cursor:'pointer'}} title={'Double-click to filter Data tab by category "'+cat+'" + subcategory "'+s+'" in month '+selectedMonth} onDoubleClick={()=>onNavigateToData && onNavigateToData({col:'tag',val:selectedMonth,col2:'category',val2:cat,col3:'subcategory',val3:s})}>↳ {s}</td>
                      <td style={{color: subValue > 0 ? '#16a34a' : subValue < 0 ? '#dc2626' : 'inherit', cursor:'pointer'}} title={'Double-click to filter Data tab by category "'+cat+'" + subcategory "'+s+'" in month '+selectedMonth} onDoubleClick={()=>onNavigateToData && onNavigateToData({col:'tag',val:selectedMonth,col2:'category',val2:cat,col3:'subcategory',val3:s})}>{displayValue}</td>
                    </tr>;
                  })}
                </React.Fragment>
              );
            }) : <tr><td colSpan="2" style={{textAlign:'center'}} className="muted">No categories in this month.</td></tr>}
            {selectedMonth && (monthNet[selectedMonth] || Object.keys(monthCategoryDataAll[selectedMonth]||{}).length) && (
              <tr style={{borderTop: '2px solid #e5e7eb', backgroundColor: '#f9fafb'}}>
                <td><strong>Net (Income - Expenses)</strong></td>
                <td><strong style={{color: (monthNet[selectedMonth]&&monthNet[selectedMonth].net||0) > 0 ? '#16a34a' : (monthNet[selectedMonth]&&monthNet[selectedMonth].net||0) < 0 ? '#dc2626' : 'inherit'}}>
                  {(() => {
                    const netValue = Number((monthNet[selectedMonth]&&monthNet[selectedMonth].net)||0);
                    return netValue !== 0 ? (netValue > 0 ? '+' : '') + '₪' + fmt2(Math.abs(netValue)) : '₪0.00';
                  })()}
                </strong></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="controls" style={{marginBottom:10}}>
        <span className="muted">Sub-category pie for category:</span>
        <select value={subPieCat} onChange={(e)=>setSubPieCat(e.target.value)}>
          {monthCats.filter(c => {
            const mcd = monthCategoryDataAll[selectedMonth] || {};
            return mcd[c] && (mcd[c].type || 'Expense') === 'Expense';
          }).map(c => <option key={'spc_'+c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="grid-2">
        <div className="panel"><div className="section-title" style={{marginTop:0}}><PieChart size={18}/>Categories (Outcome)</div><div className="chart-box"><canvas ref={catRef}></canvas></div></div>
        <div className="panel"><div className="section-title" style={{marginTop:0}}><Layers size={18}/>Sub-categories — {subPieCat || '-'}</div><div className="chart-box"><canvas ref={subRef}></canvas></div></div>
      </div>
    </div>
  );
}
