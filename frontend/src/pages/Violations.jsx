import { useState, useEffect } from 'react';
import { Download, AlertTriangle } from 'lucide-react';
import api from '../api';
import { formatDate } from '../utils';

export default function Violations() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchViolations = (query = '') => {
    setLoading(true);
    api.get(`/audit/results?limit=1000&q=${query}`).then(r => {
      setResults(r.data.filter(x => x.violations && x.violations.length > 0));
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
            <h1 className="page-title">Violations</h1>
            <span className="badge badge-red">{results.length} breaches</span>
          </div>
          <p className="page-subtitle">Contract enforcement failures and billing anomalies</p>
        </div>
        <div className="flex items-center gap-4">
          <input 
            type="text" 
            placeholder="Search Breach/Title..." 
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '280px' }}
          />
          <button className="btn btn-outline" onClick={handleExport}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>
      {loading && results.length === 0 ? (
        <div className="loading-wrap" style={{ minHeight: '300px' }}><div className="spinner"/><span>Scanning violations…</span></div>
      ) : (
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Contract</th><th>Content</th><th>Violation Reason</th>
              <th>Financial Impact</th><th>Status</th><th>Flagged</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i}>
                <td className="font-semibold text-sm">{r.contract_id !== 'UNKNOWN' ? r.contract_id : <span className="text-muted">No Contract</span>}</td>
                <td className="text-sm">{r.content_id}</td>
                <td className="text-sm">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    {r.violations.map((v, idx) => (
                      <span key={idx} className="badge badge-red" style={{ borderRadius: '4px', display: 'inline-block', width: 'fit-content' }}>
                        {v}
                      </span>
                    ))}
                  </div>
                </td>
                <td className={`text-sm font-semibold ${r.difference !== 0 ? 'text-red' : 'text-muted'}`}>
                  ₹{Math.abs(r.difference).toLocaleString()}
                </td>
                <td>
                  {r.status === 'UNDERPAID'
                    ? <span className="badge badge-red">Underpaid</span>
                    : <span className="badge badge-amber">Overpaid</span>}
                </td>
                <td className="text-sm text-muted">{formatDate(r.timestamp)}</td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No violations found. Clean audit!</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
