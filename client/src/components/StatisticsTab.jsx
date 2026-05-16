import React from 'react';
import { BarChart2, Clock, CreditCard, FolderOpen, RotateCcw, AlertTriangle, Info } from 'lucide-react';
import { API } from '../api.js';
import { fmt2 } from '../utils.js';
import StatsPieChart from './StatsPieChart.jsx';

export default function StatisticsTab({past, categories}){
  const [selectedYears, setSelectedYears] = React.useState([]);
  const [tagsByYear, setTagsByYear] = React.useState({});
  const [selectedType, setSelectedType] = React.useState('Expense');
  const [selectedCategories, setSelectedCategories] = React.useState([]);
  const [selectedSubcategories, setSelectedSubcategories] = React.useState([]);
  const [activeQuickSelect, setActiveQuickSelect] = React.useState(null);
  const [statsData, setStatsData] = React.useState(null);
  const [error, setError] = React.useState('');
  const [calculating, setCalculating] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(true);

  const availableYearsAndTags = React.useMemo(() => {
    const yearTagMap = {};
    (past || []).forEach(tx => {
      if (!tx) return;
      try {
        let year = tx.year ? parseInt(tx.year) : 0;
        if (!year && tx.date) {
          const dateStr = String(tx.date);
          if (dateStr.length >= 4) year = parseInt(dateStr.substring(0, 4));
        }
        let tag = 0;
        const rawTag = String(tx.tag || tx.month_tag || '');
        if (rawTag.includes('/')) {
          const parts = rawTag.split('/');
          tag = parseInt(parts[0]) || 0;
          if (!year) { const yr = parseInt(parts[1]) || 0; year = yr < 100 ? yr + 2000 : yr; }
        } else {
          tag = parseInt(tx.month_tag || tx.tag || 0);
        }
        if (!year || !tag) return;
        if (!yearTagMap[year]) yearTagMap[year] = new Set();
        yearTagMap[year].add(parseInt(tag));
      } catch (e) {}
    });
    const result = {};
    Object.keys(yearTagMap).forEach(year => { result[parseInt(year)] = Array.from(yearTagMap[year]).sort((a, b) => a - b); });
    return result;
  }, [past]);

  const availableYears = React.useMemo(() => {
    return Object.keys(availableYearsAndTags).map(y => parseInt(y)).sort((a, b) => b - a);
  }, [availableYearsAndTags]);

  const categoryOptions = React.useMemo(() => Object.keys(categories || {}).sort(), [categories]);

  const subcategoryOptions = React.useMemo(() => {
    const allSubs = new Set();
    selectedCategories.forEach(cat => { (categories[cat] || []).forEach(sub => allSubs.add(sub)); });
    return Array.from(allSubs).sort();
  }, [selectedCategories, categories]);

  const selectedMonthCount = React.useMemo(() => {
    let count = 0;
    selectedYears.forEach(year => { count += (tagsByYear[year] || []).length; });
    return count;
  }, [selectedYears, tagsByYear]);

  function toggleYear(year) {
    if (selectedYears.includes(year)) {
      const newTagsByYear = {...tagsByYear}; delete newTagsByYear[year];
      setSelectedYears(selectedYears.filter(y => y !== year));
      setTagsByYear(newTagsByYear);
    } else {
      setSelectedYears([...selectedYears, year]);
    }
  }

  function toggleTag(year, tag) {
    const currentTags = tagsByYear[year] || [];
    const newTags = currentTags.includes(tag) ? currentTags.filter(t => t !== tag) : [...currentTags, tag].sort((a, b) => a - b);
    setTagsByYear({...tagsByYear, [year]: newTags});
  }

  function quickFilterLast3() {
    const pairs = [];
    Object.keys(availableYearsAndTags).forEach(year => { availableYearsAndTags[year].forEach(tag => { pairs.push({ year: parseInt(year), tag }); }); });
    pairs.sort((a, b) => { if (a.year !== b.year) return b.year - a.year; return b.tag - a.tag; });
    const last3 = pairs.slice(0, 3);
    const years = [...new Set(last3.map(p => p.year))];
    const tagMap = {};
    last3.forEach(p => { if (!tagMap[p.year]) tagMap[p.year] = []; tagMap[p.year].push(p.tag); });
    setSelectedYears(years); setTagsByYear(tagMap); setActiveQuickSelect('last3');
  }

  function quickFilterLast6() {
    const pairs = [];
    Object.keys(availableYearsAndTags).forEach(year => { availableYearsAndTags[year].forEach(tag => { pairs.push({ year: parseInt(year), tag }); }); });
    pairs.sort((a, b) => { if (a.year !== b.year) return b.year - a.year; return b.tag - a.tag; });
    const last6 = pairs.slice(0, 6);
    const years = [...new Set(last6.map(p => p.year))];
    const tagMap = {};
    last6.forEach(p => { if (!tagMap[p.year]) tagMap[p.year] = []; tagMap[p.year].push(p.tag); });
    setSelectedYears(years); setTagsByYear(tagMap); setActiveQuickSelect('last6');
  }

  function quickFilterAllTime() {
    const years = Object.keys(availableYearsAndTags).map(y => parseInt(y));
    const tagMap = {};
    years.forEach(year => { tagMap[year] = availableYearsAndTags[year]; });
    setSelectedYears(years); setTagsByYear(tagMap); setActiveQuickSelect('alltime');
  }

  function clearFilters() {
    setSelectedYears([]); setTagsByYear({}); setSelectedCategories([]);
    setSelectedSubcategories([]); setStatsData(null); setError(''); setActiveQuickSelect(null);
    setFiltersOpen(true);
  }

  function toggleCategory(cat) {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter(c => c !== cat));
      const subsToRemove = categories[cat] || [];
      setSelectedSubcategories(selectedSubcategories.filter(s => !subsToRemove.includes(s)));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
      const subsToAdd = categories[cat] || [];
      setSelectedSubcategories([...new Set([...selectedSubcategories, ...subsToAdd])]);
    }
    setActiveQuickSelect(null);
  }

  function toggleSubcategory(sub) {
    setSelectedSubcategories(selectedSubcategories.includes(sub) ? selectedSubcategories.filter(s => s !== sub) : [...selectedSubcategories, sub]);
    setActiveQuickSelect(null);
  }

  function selectAllCategories() {
    const allCats = categoryOptions;
    setSelectedCategories(allCats);
    const allSubs = new Set();
    allCats.forEach(cat => { (categories[cat] || []).forEach(sub => allSubs.add(sub)); });
    setSelectedSubcategories(Array.from(allSubs)); setActiveQuickSelect(null);
  }

  function clearAllCategories() { setSelectedCategories([]); setSelectedSubcategories([]); setActiveQuickSelect(null); }
  function selectAllSubcategories() { setSelectedSubcategories(subcategoryOptions); setActiveQuickSelect(null); }
  function clearAllSubcategories() { setSelectedSubcategories([]); setActiveQuickSelect(null); }

  async function calculateStatistics(quickFilter = 'none') {
    if (selectedMonthCount < 2 && quickFilter === 'none') {
      setError('Select at least two months to calculate statistics.');
      setStatsData(null); return;
    }
    setError(''); setCalculating(true);
    try {
      const payload = {
        years: selectedYears,
        tagsByYear: Object.keys(tagsByYear).reduce((acc, year) => { acc[year] = tagsByYear[year]; return acc; }, {}),
        type: selectedType, categories: selectedCategories, subcategories: selectedSubcategories, quickFilter
      };
      const result = await API.getStatistics(payload);
      if (result.error) { setError(result.error); setStatsData(null); } else { setStatsData(result); setFiltersOpen(false); }
    } catch (e) {
      setError('Failed to calculate statistics: ' + e.message); setStatsData(null);
    } finally { setCalculating(false); }
  }

  if (!past || past.length === 0) {
    return (
      <div className="panel">
        <div className="section-title"><BarChart2 size={20}/>Statistics Dashboard</div>
        <div className="muted">No transaction data available. Upload data first in the Transactions or Data tabs.</div>
      </div>
    );
  }

  const qBtnStyle = (key) => ({
    borderRadius: 20,
    background: activeQuickSelect === key ? 'linear-gradient(180deg,#7c3aed,#6d28d9)' : '',
    color: activeQuickSelect === key ? '#fff' : '',
    boxShadow: activeQuickSelect === key ? '0 4px 8px rgba(124,58,237,0.25)' : '',
    border: activeQuickSelect === key ? 'none' : ''
  });

  return (
    <div style={{maxWidth: '1200px', margin: '0 auto', padding: '0 16px'}}>
      <div style={{marginBottom: 24}}>
        <div className="section-title" style={{fontSize: 28, marginBottom: 6}}>📊 Statistics Dashboard</div>
        <div className="section-sub" style={{fontSize: 14, color: '#667085'}}>
          Analyze monthly {selectedType.toLowerCase()} patterns across selected time periods
        </div>
      </div>

      <div className="panel" style={{marginBottom: 24, borderRadius: 16, padding: 24}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: filtersOpen ? 20 : 0}}>
          <div>
            <h3 style={{margin: 0, fontSize: 18, fontWeight: 700, color: '#30334b'}}>Filter Options</h3>
            {filtersOpen && <p style={{margin: '4px 0 0', fontSize: 13, color: '#667085'}}>Select time periods, type, and categories to analyze</p>}
          </div>
          <div style={{display:'flex', gap:10, alignItems:'center'}}>
            <div style={{padding: '6px 12px', backgroundColor: selectedMonthCount >= 2 ? '#dcfce7' : '#fee2e2', color: selectedMonthCount >= 2 ? '#065f46' : '#991b1b', borderRadius: 16, fontSize: 12, fontWeight: 700}}>
              {selectedMonthCount} month{selectedMonthCount !== 1 ? 's' : ''} selected
            </div>
            <button className="btn btn-xs" onClick={() => setFiltersOpen(o => !o)} style={{borderRadius:12, padding:'6px 12px', fontSize:12}}>
              {filtersOpen ? '▲ Hide' : '▼ Filters'}
            </button>
          </div>
        </div>

        {filtersOpen && <>
        {/* TIME RANGE */}
        <div style={{marginBottom: 12, padding: '10px 14px', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb'}}>
          <h4 style={{margin: '0 0 8px 0', fontSize: 14, fontWeight: 700, color: '#30334b', display:'flex', alignItems:'center', gap:6}}><Clock size={13}/>Time Range</h4>
          <div style={{marginBottom: 10}}>
            <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
              <button className={'btn btn-xs ' + (activeQuickSelect === 'last3' ? 'primary' : '')} onClick={quickFilterLast3} style={qBtnStyle('last3')}>{activeQuickSelect === 'last3' && '✓ '}Last 3 Months</button>
              <button className={'btn btn-xs ' + (activeQuickSelect === 'last6' ? 'primary' : '')} onClick={quickFilterLast6} style={qBtnStyle('last6')}>{activeQuickSelect === 'last6' && '✓ '}Last 6 Months</button>
              <button className={'btn btn-xs ' + (activeQuickSelect === 'alltime' ? 'primary' : '')} onClick={quickFilterAllTime} style={qBtnStyle('alltime')}>{activeQuickSelect === 'alltime' && '✓ '}All Time</button>
            </div>
          </div>
          <div style={{marginBottom: 8}}>
            <label style={{display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6}}>Years</label>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
              {availableYears.map(year => (
                <button key={year} className={'btn btn-xs ' + (selectedYears.includes(year) ? 'primary' : '')} onClick={() => { toggleYear(year); setActiveQuickSelect(null); }} style={{borderRadius: 20, minWidth: 60, padding: '8px 16px', background: selectedYears.includes(year) ? 'linear-gradient(180deg,#7c3aed,#6d28d9)' : '', color: selectedYears.includes(year) ? '#fff' : '', boxShadow: selectedYears.includes(year) ? '0 4px 8px rgba(124,58,237,0.25)' : '', border: selectedYears.includes(year) ? 'none' : ''}}>
                  {selectedYears.includes(year) && '✓ '}{year}
                </button>
              ))}
            </div>
          </div>
          {selectedYears.length > 0 && (
            <div>
              <label style={{display: 'block', fontSize: 13, fontWeight: 600, color: '#30334b', marginBottom: 8}}>
                Months (Tags) {selectedMonthCount > 0 && (<span style={{marginLeft: 8, padding: '2px 8px', background: '#ede9fe', color: '#6b46c1', borderRadius: 12, fontSize: 11, fontWeight: 700}}>{selectedMonthCount} selected</span>)}
              </label>
              {selectedYears.sort((a,b) => b - a).map(year => {
                const availableTags = availableYearsAndTags[year] || [];
                const selectedTags = tagsByYear[year] || [];
                return (
                  <div key={year} style={{marginBottom: 12, paddingLeft: 16, borderLeft: '3px solid #7c3aed', paddingTop: 4, paddingBottom: 4}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8}}>
                      <span style={{fontSize: 12, fontWeight: 600, color: '#6b46c1'}}>{year}</span>
                      <button className="btn btn-xs" onClick={() => { setTagsByYear({...tagsByYear, [year]: availableTags.slice()}); setActiveQuickSelect(null); }} style={{padding:'2px 8px',fontSize:10,borderRadius:10,background:'#eef2ff',color:'#4338ca',border:'1px solid #c7d2fe'}}>Select All</button>
                      <button className="btn btn-xs" onClick={() => { setTagsByYear({...tagsByYear, [year]: []}); setActiveQuickSelect(null); }} style={{padding:'2px 8px',fontSize:10,borderRadius:10,background:'#fef2f2',color:'#991b1b',border:'1px solid #fecaca'}}>Clear All</button>
                    </div>
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
                      {availableTags.map(tag => (
                        <button key={tag} className={'btn btn-xs ' + (selectedTags.includes(tag) ? 'primary' : '')} onClick={() => { toggleTag(year, tag); setActiveQuickSelect(null); }} style={{minWidth: 36, padding: '6px 12px', borderRadius: 16, fontSize: 13, background: selectedTags.includes(tag) ? 'linear-gradient(180deg,#7c3aed,#6d28d9)' : '', color: selectedTags.includes(tag) ? '#fff' : '', boxShadow: selectedTags.includes(tag) ? '0 4px 8px rgba(124,58,237,0.25)' : '', border: selectedTags.includes(tag) ? 'none' : ''}}>
                          {selectedTags.includes(tag) && '✓ '}{tag}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* TRANSACTION TYPE */}
        <div style={{marginBottom: 12, padding: '10px 14px', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb'}}>
          <h4 style={{margin: '0 0 8px 0', fontSize: 14, fontWeight: 700, color: '#30334b', display:'flex', alignItems:'center', gap:6}}><CreditCard size={13}/>Transaction Type</h4>
          <div style={{display: 'inline-flex', gap: 0, backgroundColor: '#f3f4f6', borderRadius: 20, padding: 4}}>
            <button className={'btn btn-xs ' + (selectedType === 'Expense' ? 'primary' : '')} onClick={() => setSelectedType('Expense')} style={{borderRadius: 16, background: selectedType === 'Expense' ? 'linear-gradient(180deg,#7c3aed,#6d28d9)' : 'transparent', color: selectedType === 'Expense' ? '#fff' : '#4b5563', border: 'none', boxShadow: selectedType === 'Expense' ? '0 4px 8px rgba(124,58,237,0.25)' : 'none', fontWeight: 700}}>
              {selectedType === 'Expense' && '✓ '}Expenses
            </button>
            <button className={'btn btn-xs ' + (selectedType === 'Income' ? 'primary' : '')} onClick={() => setSelectedType('Income')} style={{borderRadius: 16, background: selectedType === 'Income' ? 'linear-gradient(180deg,#7c3aed,#6d28d9)' : 'transparent', color: selectedType === 'Income' ? '#fff' : '#4b5563', border: 'none', boxShadow: selectedType === 'Income' ? '0 4px 8px rgba(124,58,237,0.25)' : 'none', fontWeight: 700}}>
              {selectedType === 'Income' && '✓ '}Incomes
            </button>
          </div>
        </div>

        {/* CATEGORIES */}
        <div style={{marginBottom: 12, padding: '10px 14px', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb'}}>
          <h4 style={{margin: '0 0 8px 0', fontSize: 14, fontWeight: 700, color: '#30334b', display:'flex', alignItems:'center', gap:6}}><FolderOpen size={13}/>Categories &amp; Subcategories</h4>
          <div style={{marginBottom: 16}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
              <label style={{fontSize: 13, fontWeight: 600, color: '#30334b'}}>
                Categories {selectedCategories.length > 0 && (<span style={{marginLeft: 8, padding: '2px 8px', background: '#ede9fe', color: '#6b46c1', borderRadius: 12, fontSize: 11, fontWeight: 700}}>{selectedCategories.length} selected</span>)}
              </label>
              <div style={{display: 'flex', gap: 8}}>
                <button className="btn btn-xs" onClick={selectAllCategories} style={{padding: '4px 10px', fontSize: 11, borderRadius: 12, background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe'}}>Select All</button>
                <button className="btn btn-xs" onClick={clearAllCategories} style={{padding: '4px 10px', fontSize: 11, borderRadius: 12, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca'}}>Clear All</button>
              </div>
            </div>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
              {categoryOptions.map(cat => (
                <button key={cat} className={'btn btn-xs ' + (selectedCategories.includes(cat) ? 'primary' : '')} onClick={() => toggleCategory(cat)} style={{borderRadius: 16, padding: '6px 12px', fontSize: 13, background: selectedCategories.includes(cat) ? 'linear-gradient(180deg,#7c3aed,#6d28d9)' : '', color: selectedCategories.includes(cat) ? '#fff' : '', boxShadow: selectedCategories.includes(cat) ? '0 4px 8px rgba(124,58,237,0.25)' : '', border: selectedCategories.includes(cat) ? 'none' : '', transition: 'all 0.2s'}}>
                  {selectedCategories.includes(cat) && '✓ '}{cat}
                </button>
              ))}
            </div>
          </div>
          {selectedCategories.length === 1 && subcategoryOptions.length > 0 && (
            <div>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
                <label style={{fontSize: 13, fontWeight: 600, color: '#30334b'}}>
                  Subcategories {selectedSubcategories.length > 0 && (<span style={{marginLeft: 8, padding: '2px 8px', background: '#ede9fe', color: '#6b46c1', borderRadius: 12, fontSize: 11, fontWeight: 700}}>{selectedSubcategories.length} selected</span>)}
                </label>
                <div style={{display: 'flex', gap: 8}}>
                  <button className="btn btn-xs" onClick={selectAllSubcategories} style={{padding: '4px 10px', fontSize: 11, borderRadius: 12, background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe'}}>Select All</button>
                  <button className="btn btn-xs" onClick={clearAllSubcategories} style={{padding: '4px 10px', fontSize: 11, borderRadius: 12, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca'}}>Clear All</button>
                </div>
              </div>
              <p style={{margin: '0 0 8px 0', fontSize: 11, color: '#667085', fontStyle: 'italic'}}>For "{selectedCategories[0]}"</p>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
                {subcategoryOptions.map(sub => (
                  <button key={sub} className={'btn btn-xs ' + (selectedSubcategories.includes(sub) ? 'primary' : '')} onClick={() => toggleSubcategory(sub)} style={{borderRadius: 16, padding: '6px 12px', fontSize: 13, background: selectedSubcategories.includes(sub) ? 'linear-gradient(180deg,#7c3aed,#6d28d9)' : '', color: selectedSubcategories.includes(sub) ? '#fff' : '', boxShadow: selectedSubcategories.includes(sub) ? '0 4px 8px rgba(124,58,237,0.25)' : '', border: selectedSubcategories.includes(sub) ? 'none' : '', transition: 'all 0.2s'}}>
                    {selectedSubcategories.includes(sub) && '✓ '}{sub}
                  </button>
                ))}
              </div>
            </div>
          )}
          {selectedCategories.length > 1 && (
            <div style={{padding: '12px 16px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, marginTop: 12}}>
              <p style={{margin: 0, fontSize: 12, color: '#0c4a6e', lineHeight: '1.5'}}>
                <Info size={12} style={{display:'inline',verticalAlign:'middle',marginRight:4}}/> Statistics will be calculated for <strong>all subcategories</strong> across the {selectedCategories.length} selected categories.
                {subcategoryOptions.length > 0 && ` (${subcategoryOptions.length} total subcategories)`}
              </p>
            </div>
          )}
        </div>

        </>}
        {/* Calculate Button */}
        <div style={{display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: '2px solid #e5e7eb', marginTop: filtersOpen ? 0 : 4}}>
          <button className="btn primary" onClick={() => calculateStatistics('none')} disabled={selectedMonthCount < 2 || calculating} style={{borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 700, boxShadow: '0 6px 16px rgba(124,58,237,0.35)'}}>
            {calculating ? 'Calculating...' : <><BarChart2 size={14} style={{display:'inline',verticalAlign:'middle',marginRight:4}}/>Calculate Statistics</>}
          </button>
          <button className="btn btn-xs" onClick={clearFilters} style={{borderRadius: 12, padding: '8px 16px', fontSize: 13, background: '#f3f4f6', color: '#4b5563', border: '1px solid #d1d5db'}}>
            <RotateCcw size={13} style={{display:'inline',verticalAlign:'middle',marginRight:4}}/>Reset Filters
          </button>
        </div>
        {error && (<div style={{marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13, fontWeight: 500, display:'flex', alignItems:'center', gap:6}}><AlertTriangle size={14}/>{error}</div>)}
      </div>

      {statsData && statsData.summary && (
        <React.Fragment>
          <div className="panel" style={{marginBottom: 24, borderRadius: 16, padding: 24}}>
            <div style={{marginBottom: 16}}>
              <h3 style={{margin: 0, fontSize: 18, fontWeight: 700, color: '#30334b'}}>Summary Statistics</h3>
              <p style={{margin: '4px 0 0', fontSize: 13, color: '#667085'}}>Based on {selectedMonthCount} selected month{selectedMonthCount !== 1 ? 's' : ''} & {selectedType.toLowerCase()} transactions</p>
            </div>
            <div style={{overflowX: 'auto'}}>
              <table>
                <thead>
                  <tr>
                    <th style={{textAlign: 'left', fontSize: 13, letterSpacing: '0.5px'}}>Metric</th>
                    <th style={{textAlign: 'right', fontSize: 13, letterSpacing: '0.5px'}}>Amount (₪)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', borderTop: '3px solid #f59e0b', borderBottom: '3px solid #f59e0b', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)', transform: 'scale(1.005)'}}>
                    <td style={{fontSize: 16, fontWeight: 800, color: '#92400e', padding: '14px 12px', letterSpacing: '0.3px'}}>⭐ Mean Monthly Amount</td>
                    <td style={{textAlign: 'right', fontSize: 18, fontWeight: 800, color: '#92400e', padding: '14px 12px', letterSpacing: '0.5px'}}>₪{fmt2(statsData.summary.avg_monthly)}</td>
                  </tr>
                  <tr>
                    <td style={{fontSize: 14, fontWeight: 600}}>Median Monthly Amount</td>
                    <td style={{textAlign: 'right', fontSize: 15, fontWeight: 700, color: '#6b46c1'}}>₪{fmt2(statsData.summary.median_monthly)}</td>
                  </tr>
                  <tr>
                    <td style={{fontSize: 14, fontWeight: 600}}>Min Monthly Amount</td>
                    <td style={{textAlign: 'right', fontSize: 15, fontWeight: 700, color: '#6b46c1'}}>₪{fmt2(statsData.summary.min_monthly)}</td>
                  </tr>
                  <tr>
                    <td style={{fontSize: 14, fontWeight: 600}}>Max Monthly Amount</td>
                    <td style={{textAlign: 'right', fontSize: 15, fontWeight: 700, color: '#6b46c1'}}>₪{fmt2(statsData.summary.max_monthly)}</td>
                  </tr>
                  <tr style={{borderTop: '3px solid #6b46c1', backgroundColor: '#fde047', boxShadow: '0 4px 12px rgba(234, 179, 8, 0.3)'}}>
                    <td style={{backgroundColor: '#fde047', padding: '12px', fontSize: 15, fontWeight: 800, color: '#1f1b2e'}}>Total Over Period</td>
                    <td style={{backgroundColor: '#fde047', textAlign: 'right', padding: '12px', fontSize: 15, fontWeight: 800, color: '#1f1b2e'}}>₪{fmt2(statsData.summary.total_over_period||0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          {statsData && statsData.top_categories && statsData.top_categories.length > 0 && (
            <StatsPieChart statsData={statsData} selectedCategories={selectedCategories} />
          )}
        </React.Fragment>
      )}
    </div>
  );
}
