import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import api from '../api';
import { formatDate } from '../utils';

const statusBadge = (s) => {
  if (s === 'UNDERPAID') return <span className="badge badge-red">Underpaid</span>;
  if (s === 'OVERPAID')  return <span className="badge badge-amber">Overpaid</span>;
  return <span className="badge badge-green">Clean</span>;
};

export default function AuditResults() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');

  const fetchResults = (currentSkip, query = '') => {
    api.get(`/audit/results?limit=200&skip=${currentSkip}&q=${query}`).then(r => {
      if (r.data.length < 200) setHasMore(false);
      if (currentSkip === 0) {
        setResults(r.data);
      } else {
        setResults(prev => [...prev, ...r.data]);
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    setLoading(true);
    setSkip(0);
    setHasMore(true);
    const delayDebounceFn = setTimeout(() => {
      fetchResults(0, search);
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const loadMore = () => {
    const nextSkip = skip + 200;
    setSkip(nextSkip);
    fetchResults(nextSkip, search);
  };

  const handleExport = () =>
    window.open(`${import.meta.env.VITE_API_URL || ''}/api/export/audit_results.csv`, '_blank');


  return (
    <div className="animate-in delay-1">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Audit Results</h1>
          <p className="page-subtitle">Detailed financial comparison</p>
        </div>
        <div className="flex items-center gap-4">
          <input 
            type="text" 
            placeholder="Search Content/Contract..." 
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
      {loading && skip === 0 ? (
        <div className="loading-wrap" style={{ minHeight: '300px' }}><div className="spinner"/><span>Loading results…</span></div>
      ) : (
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Contract</th><th>Content</th><th>Plays</th>
              <th>Expected</th><th>Paid</th><th>Difference</th><th>Date</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i}>
                <td className="font-semibold text-sm">{r.contract_id}</td>
                <td className="text-sm">{r.content_id}</td>
                <td className="text-sm">{r.total_plays?.toLocaleString()}</td>
                <td className="text-sm">₹{r.expected?.toLocaleString()}</td>
                <td className="text-sm">₹{r.paid?.toLocaleString()}</td>
                <td className={`text-sm font-semibold ${r.difference > 0 ? 'text-red' : r.difference < 0 ? 'text-green' : ''}`}>
                  {r.difference > 0 ? '+' : ''}₹{r.difference?.toLocaleString()}
                </td>
                <td className="text-sm text-muted">{formatDate(r.timestamp)}</td>
                <td>{statusBadge(r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      )}
      
      {hasMore && !loading && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
          <button className="btn btn-outline" onClick={loadMore}>
            Load More Results
          </button>
        </div>
      )}
    </div>
  );
}
