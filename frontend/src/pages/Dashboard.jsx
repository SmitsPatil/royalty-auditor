import { useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement,
  PointElement, LineElement
} from 'chart.js';
import { Bar, Doughnut, Line, getElementAtEvent } from 'react-chartjs-2';
import { 
  TrendingDown, TrendingUp, CheckCircle, AlertCircle, 
  FilterX, Database, MousePointer2, Bell, LineChart, Activity
} from 'lucide-react';
import api from '../api';
import { formatDate } from '../utils';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement);

const CATEGORY_COLORS = {
  'Podcast':   '#ef4444',
  'Song':      '#8b5cf6',
  'Movie':     '#3b82f6',
  'Series':    '#10b981',
  'Audiobook': '#f59e0b',
  'Global':    '#6b7280'
};

const CHART_OPTIONS_BAR = {
  maintainAspectRatio: false,
  plugins: { 
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1f2937',
      padding: 12,
      cornerRadius: 8,
      titleFont: { size: 13, weight: 'bold' },
      bodyFont: { size: 12 },
      footerFont: { size: 11, style: 'italic', weight: 'normal' },
      footerColor: '#9ca3af',
      callbacks: {
        footer: () => 'Click to drill down'
      }
    }
  },
  hover: { mode: 'index', intersect: false },
  onHover: (event, chartElement) => {
    event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
  },
  scales: {
    y: { grid: { color: '#f3f4f6' }, ticks: { color: '#9ca3af', font: { size: 10 } }, border: { display: false } },
    x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 9 } }, border: { display: false } }
  }
};

const CHART_OPTIONS_DONUT = {
  maintainAspectRatio: false,
  plugins: { 
    legend: { 
      position: 'bottom', 
      labels: { color: '#6b7280', font: { size: 10, family: 'Inter' }, padding: 12, boxWidth: 8, boxHeight: 8 }
    },
    tooltip: {
      backgroundColor: '#1f2937',
      padding: 12,
      cornerRadius: 8,
      callbacks: {
        footer: () => 'Click to drill down'
      },
      footerFont: { size: 11, style: 'italic' },
      footerColor: '#9ca3af'
    }
  },
  hover: { offset: 15 },
  onHover: (event, chartElement) => {
    event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
  },
  cutout: '72%'
};

export default function Dashboard() {
  const [summary, setSummary]   = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [hiddenCategories, setHiddenCategories] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [audits, setAudits] = useState([]);
  const chartRef = useRef();

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let url = `/analytics/summary?`;
        if (categoryFilter) url += `category=${categoryFilter}&`;
        
        const [s, a] = await Promise.all([
          api.get(url),
          api.get(`/audit/results?limit=100${categoryFilter ? `&category=${categoryFilter}` : ''}`)
        ]);
        setSummary(s.data);
        const auditData = a.data.data || a.data || [];
        setAudits(Array.isArray(auditData) ? auditData : []);
      } catch (e) {
        console.error("Dashboard data fetch error:", e);
        const status = e.response?.status;
        const msg = e.response?.data?.detail || e.message;
        setError(`LRAC API Error [${status || 'NETWORK'}]: ${msg}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [categoryFilter]);

  if (loading && !summary) return (
    <div className="loading-wrap">
      <div className="spinner" />
      <span>Loading enterprise data…</span>
    </div>
  );
  
  if (error) return (
    <div className="loading-wrap">
      <AlertCircle size={28} color="var(--red)" />
      <span style={{ color: 'var(--red)' }}>{error}</span>
    </div>
  );

  if (!summary) return null;

  /* ── Robust Calculations ── */
  const totalViolations = (summary.overpaid || 0) + (summary.underpaid || 0);
  const violationData = {
    labels: ['Overpaid', 'Underpaid'],
    datasets: [{
      data: [summary.overpaid || 0, summary.underpaid || 0],
      backgroundColor: ['#3b82f6', '#ef4444'],
      hoverBackgroundColor: ['#2563eb', '#dc2626'],
      borderWidth: 0,
      spacing: 2
    }]
  };

  const enhancedViolationOptions = {
    ...CHART_OPTIONS_DONUT,
    cutout: '72%',
    plugins: {
      ...CHART_OPTIONS_DONUT.plugins,
      legend: {
        ...CHART_OPTIONS_DONUT.plugins.legend,
        display: true,
        position: 'bottom',
        labels: {
          ...CHART_OPTIONS_DONUT.plugins.legend.labels,
          generateLabels: (chart) => {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label, i) => {
                const value = data.datasets[0].data[i];
                const percentage = totalViolations > 0 ? Math.round((value / totalViolations) * 100) : 0;
                return {
                  text: `${label} (${percentage}% / ${value} cases)`,
                  fillStyle: data.datasets[0].backgroundColor[i],
                  index: i
                };
              });
            }
            return [];
          }
        }
      }
    },
    onClick: (event, elements) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        const status = index === 0 ? 'OVERPAID' : 'UNDERPAID';
        setStatusFilter(prev => prev === status ? '' : status);
      }
    }
  };

  const studios = Object.entries(summary.by_studio || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 8);
  const studioData = {
    labels: studios.map(s => s[0]),
    datasets: [{ 
      label: 'Leakage (₹)', 
      data: studios.map(s => s[1]),
      backgroundColor: '#3b82f6',
      hoverBackgroundColor: '#2563eb',
      borderRadius: 4, 
    }]
  };

  const top10Content = Object.entries(summary.by_content || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 10);
  const contentData = {
    labels: top10Content.map(c => c[0]),
    datasets: [{ 
      label: 'Impact (₹)', 
      data: top10Content.map(c => c[1]),
      backgroundColor: '#8b5cf6',
      hoverBackgroundColor: '#7c3aed',
      borderRadius: 4, 
    }]
  };

  /* ── Category Chart ── */
  const catMetrics = summary.category_metrics || {};
  const catLabels = Object.keys(catMetrics);
  const catData = catLabels.map(l => catMetrics[l].count);
  const catColors = catLabels.map(l => CATEGORY_COLORS[l] || '#6b7280');
  
  const categoryChartData = {
    labels: catLabels,
    datasets: [{
      data: catLabels.map(l => hiddenCategories.has(l) ? 0 : catMetrics[l].count),
      backgroundColor: catColors,
      hoverBackgroundColor: catColors.map(c => c + 'dd'),
      borderWidth: 0
    }]
  };

  const onChartClick = (event, elements) => {
    if (elements.length > 0) {
      const index = elements[0].index;
      const label = catLabels[index];
      setCategoryFilter(prev => prev === label ? '' : label);
    }
  };

  const categoryOptions = {
    ...CHART_OPTIONS_DONUT,
    onClick: onChartClick,
    cutout: '82%',
    spacing: 5,
    plugins: {
      ...CHART_OPTIONS_DONUT.plugins,
      legend: { display: false }, // Disable default legend
      tooltip: {
        ...CHART_OPTIONS_DONUT.plugins.tooltip,
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const val = context.raw || 0;
            const total = catData.reduce((a, b) => a + b, 0);
            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
            const leakage = summary.category_metrics[label]?.leakage || 0;
            return [
              ` ${label}: ${val} Contracts (${pct}%)`,
              ` Total Variance: ₹${leakage.toLocaleString()}`
            ];
          }
        }
      }
    }
  };

  const recentAlerts = audits
    .filter(a => a.status !== 'OK' && Math.abs(a.difference) > 0)
    .sort((a, b) => b.id - a.id)
    .slice(0, 5);

  const trendData = {
    labels: summary.trend?.labels || [],
    datasets: [{
      label: 'Variance Trend',
      data: summary.trend?.values || [],
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 240, 0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 3
    }]
  };

  const regionLabels = Object.keys(summary.by_region || {});
  const regionValues = Object.values(summary.by_region || {});
  const regionRiskData = {
    labels: regionLabels,
    datasets: [{
      data: regionValues,
      backgroundColor: '#ef4444',
      borderRadius: 2,
      barThickness: 6
    }]
  };

  // Local filtering for displayed alerts if statusFilter is active
  const filteredAlerts = statusFilter 
    ? recentAlerts.filter(a => a.status === statusFilter)
    : recentAlerts;

  return (
    <div className="animate-in delay-1">
      {/* ── Page Header ── */}
      <div className="page-header flex items-center justify-between">
        <div style={{ marginLeft: '40px' }}>
          <h1 className="page-title flex items-center gap-3">
            Audit Intelligence
            {categoryFilter && (
              <span className="badge badge-purple flex items-center gap-2 cursor-pointer py-1.5 px-4 border border-purple-200 animate-in fade-in" onClick={() => setCategoryFilter('')} title="Click to clear filter">
                Filtered by: {categoryFilter} <FilterX size={14} />
              </span>
            )}
            {statusFilter && (
              <span className="badge badge-red flex items-center gap-2 cursor-pointer py-1.5 px-4 border border-red-200 animate-in fade-in" onClick={() => setStatusFilter('')} title="Click to clear status filter">
                Status: {statusFilter} <FilterX size={14} />
              </span>
            )}
            {loading && !!summary && <div className="spinner" style={{ width: 16, height: 16, borderLeftColor: 'var(--blue)' }} />}
          </h1>
          <p className="page-subtitle">Real-time royalty audit overview and compliance risk assessment</p>
        </div>
      </div>

      {/* ── Dashboard Hero Section ── */}
      <div className={`dashboard-hero p-4 animate-in delay-1 ${loading && !!summary ? 'opacity-50' : ''}`}>
        <div className="hero-split items-start gap-6">
          <div className="hero-left">
            <div className="hero-kpi-grid">
              <div className="hero-kpi-card">
                <span className="hero-kpi-label">Total Contracts</span>
                <div className="hero-kpi-value-wrap">
                  <span className="hero-kpi-value text-hero-blue">{(summary.total_count || 0).toLocaleString()}</span>
                  <div className="kpi-icon-wrap"><Database size={16} className="text-blue-400" /></div>
                </div>
                <span className="hero-kpi-chip">System Population</span>
              </div>
              <div className="hero-kpi-card">
                <span className="hero-kpi-label">Financial Variance</span>
                <div className="hero-kpi-value-wrap">
                  <span className="hero-kpi-value text-hero-red">₹{(summary.total_leakage || 0).toLocaleString()}</span>
                  <div className="kpi-icon-wrap"><TrendingDown size={16} className="text-red-400" /></div>
                </div>
                <span className="hero-kpi-chip">Net Revenue Delta</span>
              </div>
              <div className="hero-kpi-card">
                <span className="hero-kpi-label">Avg Rev Impact</span>
                <div className="hero-kpi-value-wrap">
                  <span className="hero-kpi-value text-hero-red" style={{ fontSize: '1.1rem' }}>
                    ₹{((summary.total_leakage || 0) / (summary.total_count || 1)).toFixed(1)}
                  </span>
                  <div className="kpi-icon-wrap"><Activity size={14} className="text-red-400" /></div>
                </div>
                <span className="hero-kpi-chip">avg loss / contract</span>
              </div>
              <div className="hero-kpi-card">
                <div className="flex items-center justify-between mb-1">
                  <span className="hero-kpi-label">Underpaid</span>
                  <span className="severity-badge severity-critical" style={{ width: 'fit-content', padding: '2px 8px' }}>Critical</span>
                </div>
                <div className="hero-kpi-value-wrap">
                  <span className="hero-kpi-value text-hero-amber">{summary.underpaid || 0}</span>
                  <div className="kpi-icon-wrap"><AlertCircle size={16} className="text-amber-400" /></div>
                </div>
                <span className="hero-kpi-chip">Leakage Count</span>
              </div>
              <div className="hero-kpi-card">
                <div className="flex items-center justify-between mb-1">
                  <span className="hero-kpi-label">Overpaid</span>
                  <span className="severity-badge severity-info" style={{ width: 'fit-content', padding: '2px 8px' }}>Audit Error</span>
                </div>
                <div className="hero-kpi-value-wrap">
                  <span className="hero-kpi-value text-hero-blue">{summary.overpaid || 0}</span>
                  <div className="kpi-icon-wrap"><TrendingUp size={16} className="text-blue-400" /></div>
                </div>
                <span className="hero-kpi-chip">Compliance Error</span>
              </div>
              <div className="hero-kpi-card">
                <span className="hero-kpi-label">Clean Files</span>
                <div className="hero-kpi-value-wrap">
                  <span className="hero-kpi-value text-hero-green">{summary.clean || 0}</span>
                  <div className="kpi-icon-wrap"><CheckCircle size={16} className="text-green-400" /></div>
                </div>
                <span className="hero-kpi-chip">Audit Confirmed</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-6 items-start">
              <div className="hero-kpi-card h-full justify-center">
                <span className="hero-kpi-label">Compliance score</span>
                <div className="hero-kpi-value-wrap">
                  <span className="hero-kpi-value" style={{ color: '#94a3b8' }}>
                    {Math.round((summary.clean / summary.total_count) * 100)}%
                  </span>
                </div>
                <span className="hero-kpi-chip">Reliability Rating</span>
              </div>
              
              <div className="col-span-2 glass-legend-box p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-hero-muted-white" style={{ textTransform: 'uppercase', letterSpacing: '0.1rem', fontSize: '9px' }}>Region Risk Heat – Top 4 regions</span>
                </div>
                
                <div style={{ height: 60, marginBottom: '8px' }}>
                  <Bar data={regionRiskData} options={{
                    indexAxis: 'y',
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { enabled: true } },
                    scales: {
                      x: { display: false },
                      y: { grid: { display: false }, ticks: { color: '#cbd5e1', font: { size: 9, weight: '600' } } }
                    }
                  }} />
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 border-t border-white/5" style={{ display: 'flex' }}>
                  {['Mumbai', 'London', 'NY', 'Tokyo'].map(city => (
                    <div key={city} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#ef4444' }}></div>
                      <span className="text-hero-pure-white" style={{ fontSize: '11px' }}>{city}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="hero-right" style={{ flexDirection: 'column' }}>
            <div className="flex items-center justify-between w-full h-full gap-8 overflow-visible">
              <div className="flex-1 h-full cursor-pointer flex items-center overflow-visible">
                <Doughnut ref={chartRef} data={categoryChartData} options={categoryOptions} onClick={onChartClick} />
              </div>

              <div className="glass-legend-box">
                {catLabels.map((label, i) => {
                  const val = catMetrics[label]?.count || 0;
                  const total = catLabels.reduce((acc, curr) => acc + (catMetrics[curr]?.count || 0), 0);
                  const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                  const isActive = categoryFilter === label;
                  const isHidden = hiddenCategories.has(label);

                   return (
                    <div 
                      key={label}
                      className={`legend-item-v2 ${isActive ? 'active' : ''} ${isHidden ? 'legend-item-hidden' : ''}`}
                    >
                      <div className="flex items-center gap-3 cursor-pointer group" onClick={(e) => {
                        e.stopPropagation();
                        setHiddenCategories(prev => {
                          const next = new Set(prev);
                          if (next.has(label)) next.delete(label);
                          else next.add(label);
                          return next;
                        });
                      }}>
                        <div 
                          className="w-2.5 h-2.5 rounded-full transition-all" 
                          style={{ backgroundColor: isHidden ? '#64748b' : catColors[i] }}
                        />
                        <span className="text-hero-pure-white group-hover:text-white">
                          {label}
                        </span>
                      </div>
                      <span className="text-hero-muted-white text-[10px] pointer-events-none">
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="hint-text-subtle" onClick={() => setCategoryFilter('')}>
              <MousePointer2 size={10} className="text-blue-400" />
              <span>Drill-down active (click charts to filter)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Intelligence Slots Row ── */}
      <div className="intelligence-grid animate-in delay-2">
        <div className="card h-auto" style={{ height: 'auto', minHeight: 450 }}>
          <div className="card-title">
            <span className="card-title-text"><Bell size={14} className="text-red-500" /> Recent Violation Alerts</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest">Real-time Feed</span>
          </div>
          
          <div className="alert-header-row">
            <span>Contract</span>
            <span>Content ID</span>
            <span>Amt Variance</span>
            <span>Audited</span>
            <span className="text-center">Severity</span>
          </div>
          
          <div className="alert-feed">
            {filteredAlerts.length > 0 ? filteredAlerts.map(alert => (
              <div key={alert.id} className="alert-item">
                <span className="alert-id">#{alert.contract_id}</span>
                <span className="alert-name truncate" title={alert.content_id}>{alert.content_id}</span>
                <span className="alert-amount font-mono">₹{Math.abs(alert.difference || 0).toLocaleString()}</span>
                <span className="alert-date text-[10px]">{formatDate(alert.timestamp)}</span>
                <span className={`severity-badge ${alert.status === 'UNDERPAID' ? 'severity-critical' : 'severity-warning'}`}>
                  {alert.status}
                </span>
              </div>
            )) : (
              <div className="text-center text-slate-400 py-20 text-[12px]">All systems clear. No recent violations found.</div>
            )}
          </div>
        </div>

        <div className="card h-auto" style={{ height: 'auto', minHeight: 450 }}>
          <div className="card-title flex items-center justify-between">
            <span className="card-title-text"><LineChart size={14} className="text-blue-500" /> 7-Day Financial Trend</span>
            <span className="badge badge-purple py-1 px-3 text-[10px]">Audit Lifecycle</span>
          </div>
          <div className="trend-report">
            <Line data={trendData} options={{ 
              maintainAspectRatio: false, 
              plugins: { legend: { display: false }, tooltip: { padding: 12, cornerRadius: 8 } }, 
              scales: { 
                y: { display: true, grid: { color: '#f3f4f6' }, ticks: { color: '#94a3b8', font: { size: 10 } } }, 
                x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } } 
              } 
            }} />
          </div>
          <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
             <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Gradual audit scaling detected. Financial accuracy improving with log density.</span>
                <span className="font-bold text-blue-600">Stable Progression</span>
             </div>
          </div>
        </div>
      </div>

      {/* ── Charts Grid ── */}
      <div className={`grid grid-strict grid-cols-3 ${loading && !!summary ? 'opacity-50' : ''}`} style={{ transition: 'opacity 0.2s' }}>
        <div className="card">
          <div className="card-title"><span className="card-title-text">Violation Analytics</span></div>
          <div style={{ height: 260 }}>
            <Doughnut data={violationData} options={enhancedViolationOptions} />
          </div>
          <div className="text-center text-[10px] text-slate-400 mt-2">Click segments to filter dashboard</div>
        </div>
        
        <div className="card">
          <div className="card-title">
            <span className="card-title-text">Leakage by Studio</span>
          </div>
          <div style={{ height: 260 }}>
            <Bar data={studioData} options={CHART_OPTIONS_BAR} />
          </div>
        </div>
        
        <div className="card">
          <div className="card-title"><span className="card-title-text">Top 10 Leakage by Content</span></div>
          <div style={{ height: 260 }}>
            <Bar data={contentData} options={{ ...CHART_OPTIONS_BAR, indexAxis: 'y' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
