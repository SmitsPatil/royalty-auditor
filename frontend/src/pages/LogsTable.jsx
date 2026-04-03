import { useState, useEffect } from 'react';
import api from '../api';
import { formatDate } from '../utils';

export default function LogsTable() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');

  const fetchLogs = (currentSkip, query = '') => {
    api.get(`/logs?limit=200&skip=${currentSkip}&q=${query}`).then(r => {
      // Handle the paginated backend response
      const data = r.data.data || r.data || [];
      if (data.length < 200) setHasMore(false);
      
      if (currentSkip === 0) {
        setLogs(data);
      } else {
        setLogs(prev => [...prev, ...data]);
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    setLoading(true);
    setSkip(0);
    setHasMore(true);
    const delayDebounceFn = setTimeout(() => {
      fetchLogs(0, search);
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const loadMore = () => {
    const nextSkip = skip + 200;
    setSkip(nextSkip);
    fetchLogs(nextSkip, search);
  };

  return (
    <div className="animate-in delay-1">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Streaming Logs</h1>
          <p className="page-subtitle">Historical play events from the usage ledger</p>
        </div>
        <div className="flex items-center gap-4">
          <input 
            type="text" 
            placeholder="Search by Play/Content/Contract ID..." 
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: '400px', width: '100%', flex: 1 }}
          />
          <span className="badge badge-purple">{logs.length} visible</span>
        </div>
      </div>
      {loading && skip === 0 ? (
        <div className="loading-wrap" style={{ minHeight: '300px' }}><div className="spinner"/><span>Loading logs…</span></div>
      ) : (
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Play ID</th><th>Content</th><th>Contract</th>
              <th>Plays</th><th>Country</th><th>Device</th><th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(logs) && logs.map(l => (
              <tr key={l.play_id}>
                <td className="font-semibold text-sm">{l.play_id}</td>
                <td className="text-sm">{l.content_id}</td>
                <td className="text-sm">
                  {l.contract_id
                    ? <span>{l.contract_id}</span>
                    : <span className="badge badge-red">MISSING</span>}
                </td>
                <td className="text-sm font-semibold">{l.plays?.toLocaleString()}</td>
                <td className="text-sm"><span className="badge badge-gray">{l.country}</span></td>
                <td className="text-sm text-muted">{l.device}</td>
                <td className="text-sm text-muted">{formatDate(l.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      )}
      
      {hasMore && !loading && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
          <button className="btn btn-outline" onClick={loadMore}>
            Load More Logs
          </button>
        </div>
      )}
    </div>
  );
}
