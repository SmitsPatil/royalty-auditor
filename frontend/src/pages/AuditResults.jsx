import { useState, useEffect } from 'react';
import { Download, Search, Eye, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const pageSize = 100;

  const fetchResults = (currentSkip, query = '') => {
    setLoading(true);
    api.get(`/audit/results?limit=${pageSize}&skip=${currentSkip}&q=${query}`).then(r => {
      const data = r.data.data || r.data || [];
      if (data.length < pageSize) setHasMore(false);
      
      if (currentSkip === 0) {
        setResults(data);
      } else {
        setResults(prev => [...prev, ...data]);
      }
      setLoading(false);
    }).catch(err => {
      console.error("Failed to fetch audit results", err);
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
    const nextSkip = skip + pageSize;
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
          <p className="page-subtitle">Detailed financial comparison across all contracts</p>
        </div>
        <div className="flex items-center gap-4">
          <input 
            type="text" 
            placeholder="Search Content/Contract..." 
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: '400px', width: '100%', flex: 1 }}
          />
          <button className="btn btn-outline" onClick={handleExport}>
            <Download size={14} /> Export CSV
          </button>
          <span className="badge badge-purple">{results.length} visible</span>
        </div>
      </div>

      {loading && skip === 0 ? (
        <div className="loading-wrap" style={{ minHeight: '300px' }}><div className="spinner"/><span>Loading audit data…</span></div>
      ) : (
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Contract</th><th>Content</th><th>Plays</th>
              <th>Expected</th><th>Paid</th><th>Difference</th>
              <th>Date</th><th>Status</th><th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-10 text-muted text-sm">No results found matching your search.</td></tr>
            ) : results.map((r, i) => (
              <tr key={r.id || i}>
                <td className="text-sm font-semibold">{r.contract_id}</td>
                <td className="text-sm">{r.content_id}</td>
                <td className="text-sm font-semibold">{r.total_plays?.toLocaleString()}</td>
                <td className="text-sm">₹{r.expected?.toLocaleString()}</td>
                <td className="text-sm">₹{r.paid?.toLocaleString()}</td>
                <td className={`text-sm font-bold ${r.difference > 0 ? 'text-red' : r.difference < 0 ? 'text-green' : ''}`}>
                  {r.difference > 0 ? '+' : ''}₹{r.difference?.toLocaleString()}
                </td>
                <td className="text-sm text-muted">{formatDate(r.timestamp)}</td>
                <td className="text-sm">{statusBadge(r.status)}</td>
                <td className="text-right">
                  <div className="flex gap-2 items-center justify-end">
                    <button className="action-btn action-btn-edit" title="View Details">
                      <Eye size={14}/>
                    </button>
                    <button className="action-btn action-btn-delete" title="Flag for Review">
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </td>
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
