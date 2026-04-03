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
    <div className="animate-in delay-1">
      <div className="page-header flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title">Compliance Violations</h1>
            <span className="badge badge-red font-bold px-3">{results.length} active breaches</span>
          </div>
          <p className="page-subtitle">Contract enforcement failures and automated billing anomalies</p>
        </div>
        <div className="flex items-center gap-4">
          <input 
            type="text" 
            placeholder="Search Breach/Title..." 
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: '400px', width: '100%', flex: 1 }}
          />
          <button className="btn btn-outline" onClick={handleExport}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-wrap" style={{ minHeight: '300px' }}><div className="spinner"/><span>Scanning system for violations…</span></div>
      ) : (
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Contract</th><th>Content</th><th>Violation Reason</th>
              <th>Impact</th><th>Severity</th><th>Flagged Date</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-20 text-muted">
                <div className="flex flex-col items-center gap-3">
                  <ShieldAlert size={48} className="text-green opacity-20" />
                  <span className="text-sm">No violations found. Your licensing environment is clean!</span>
                </div>
              </td></tr>
            ) : results.map((r, i) => (
              <tr key={i}>
                <td className="text-sm font-semibold">{r.contract_id !== 'UNKNOWN' ? r.contract_id : <span className="text-muted italic">No Contract</span>}</td>
                <td className="text-sm">{r.content_id}</td>
                <td className="text-sm">
                  <div className="flex flex-wrap gap-1">
                    {r.violations.map((v, idx) => (
                      <span key={idx} className="badge badge-red text-[10px] py-0 px-2" style={{ borderRadius: '4px' }}>
                        {v}
                      </span>
                    ))}
                  </div>
                </td>
                <td className={`text-sm font-bold ${r.difference !== 0 ? 'text-red' : 'text-muted'}`}>
                  ₹{Math.abs(r.difference).toLocaleString()}
                </td>
                <td className="text-sm">
                  {r.status === 'UNDERPAID'
                    ? <span className="badge badge-red font-bold">CRITICAL</span>
                    : <span className="badge badge-amber font-bold">WARNING</span>}
                </td>
                <td className="text-sm text-muted">{formatDate(r.timestamp)}</td>
                <td className="text-right">
                  <div className="flex gap-2 items-center justify-end">
                    <button className="action-btn action-btn-edit" title="Investigate">
                      <Eye size={14}/>
                    </button>
                    <button className="action-btn action-btn-delete" title="Mark as Resolved">
                      <Flag size={14}/>
                    </button>
                  </div>
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
