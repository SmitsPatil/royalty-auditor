import { useState, useEffect } from 'react';
import { Download, AlertTriangle, Search, Eye, Flag, ShieldAlert } from 'lucide-react';
import api from '../api';
import { formatDate } from '../utils';

export default function Violations() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchViolations = (query = '') => {
    setLoading(true);
    // Fetch specifically for violations (filter is handled by calculating breaches from results)
    api.get(`/audit/results?limit=1000&q=${query}`).then(r => {
      // The backend returns a list in 'data' based on my previous change
      const allResults = r.data.data || r.data || [];
      setResults(allResults.filter(x => x.violations && x.violations.length > 0));
      setLoading(false);
    }).catch(err => {
      console.error("Failed to fetch violations", err);
      setLoading(false);
    });
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchViolations(search);
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const handleExport = () =>
    window.open(`${import.meta.env.VITE_API_URL || ''}/api/export/violations.csv`, '_blank');

  return (
    <div className="animate-in delay-1 flex flex-col flex-1 min-h-screen w-full max-w-none px-6 py-4">
      <div className="page-header flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title">Compliance Violations</h1>
            <span className="badge badge-red font-bold px-3">{results.length} active breaches</span>
          </div>
          <p className="page-subtitle">Contract enforcement failures and automated billing anomalies</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input 
              type="text" 
              placeholder="Search Breach/Title..." 
              className="search-input pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '300px' }}
            />
          </div>
          <button className="btn btn-outline" onClick={handleExport}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-wrap flex-1" style={{ minHeight: '400px' }}><div className="spinner"/><span>Scanning system for violations…</span></div>
      ) : (
      <div className="table-wrap flex-1">
        <table className="data-table table-zebra">
          <thead>
            <tr>
              <th style={{ minWidth: '150px' }}>Contract</th>
              <th style={{ minWidth: '180px' }}>Content</th>
              <th style={{ minWidth: '250px' }}>Violation Reason</th>
              <th style={{ minWidth: '150px' }}>Financial Impact</th>
              <th style={{ minWidth: '120px' }}>Severity</th>
              <th style={{ minWidth: '150px' }}>Flagged Date</th>
              <th style={{ textAlign: 'right', minWidth: '160px', position: 'sticky', right: 0, background: '#f8fafc', boxShadow: '-2px 0 5px rgba(0,0,0,0.05)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-20 text-muted">
                <div className="flex flex-col items-center gap-3">
                  <ShieldAlert size={48} className="text-green opacity-20" />
                  <span>No violations found. Your licensing environment is clean!</span>
                </div>
              </td></tr>
            ) : results.map((r, i) => (
              <tr key={i}>
                <td className="font-bold">{r.contract_id !== 'UNKNOWN' ? r.contract_id : <span className="text-muted italic">No Contract</span>}</td>
                <td className="text-secondary">{r.content_id}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {r.violations.map((v, idx) => (
                      <span key={idx} className="badge badge-red text-xs py-0.5 px-2" style={{ borderRadius: '4px' }}>
                        {v}
                      </span>
                    ))}
                  </div>
                </td>
                <td className={`font-bold ${r.difference !== 0 ? 'text-red' : 'text-muted'}`}>
                  ₹{Math.abs(r.difference).toLocaleString()}
                </td>
                <td>
                  {r.status === 'UNDERPAID'
                    ? <span className="badge badge-red font-bold">CRITICAL</span>
                    : <span className="badge badge-amber font-bold">WARNING</span>}
                </td>
                <td className="text-muted">{formatDate(r.timestamp)}</td>
                <td style={{ textAlign: 'right', position: 'sticky', right: 0, background: 'inherit', boxShadow: '-2px 0 5px rgba(0,0,0,0.02)' }}>
                  <button className="action-btn action-btn-edit mr-2" title="Investigate">
                    <Eye size={14}/> <span>Review</span>
                  </button>
                  <button className="action-btn action-btn-delete" title="Mark as Resolved">
                    <Flag size={14}/> <span>Resolve</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
