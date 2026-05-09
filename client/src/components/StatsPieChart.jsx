import React from 'react';
import { PieChart } from 'lucide-react';
import { Chart } from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { fmt2 } from '../utils.js';

Chart.register(ChartDataLabels);

export default function StatsPieChart({statsData, selectedCategories}) {
  const pieRef = React.useRef(null);
  const pieChartRef = React.useRef(null);
  React.useEffect(() => {
    if (pieChartRef.current) { try { pieChartRef.current.destroy(); } catch(_){} pieChartRef.current = null; }
    if (!pieRef.current || !statsData || !statsData.top_categories || !statsData.top_categories.length) return;
    const catTotals = {};
    statsData.top_categories.forEach(c => { catTotals[c.name] = c.total; });
    const labels = Object.keys(catTotals);
    const data = labels.map(l => catTotals[l]);
    if (!labels.length) return;
    const total = data.reduce((a,b) => a+b, 0);
    pieChartRef.current = new Chart(pieRef.current.getContext('2d'), {
      type: 'pie',
      data: { labels, datasets: [{ data }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right' },
          datalabels: {
            display: function(context) {
              const numSlices = context.dataset.data.length;
              const value = context.dataset.data[context.dataIndex];
              const pct = total ? (value / total * 100) : 0;
              const threshold = numSlices <= 4 ? 2 : numSlices <= 7 ? 5 : numSlices <= 10 ? 8 : 12;
              return pct >= threshold;
            },
            formatter: (value) => {
              const pct = total ? (value / total * 100).toFixed(1) : 0;
              return pct + '%';
            },
            color: '#fff',
            font: { weight: 'bold', size: 12 }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed || 0;
                const pct = total ? (value / total * 100).toFixed(1) : 0;
                return [label + ': ₪' + fmt2(value), pct + '%'];
              }
            }
          }
        }
      }
    });
    return () => { if (pieChartRef.current) { try { pieChartRef.current.destroy(); } catch(_){} } };
  }, [statsData]);
  return (
    <div className="panel" style={{marginBottom: 24, borderRadius: 16, padding: 24}}>
      <h3 style={{margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: '#30334b', display:'flex', alignItems:'center', gap:8}}>
        <PieChart size={18} style={{color:'#7c3aed'}}/>Pie Chart Of Selected Period &amp; Categories
      </h3>
      <div className="chart-box" style={{height: 320}}><canvas ref={pieRef}></canvas></div>
    </div>
  );
}
