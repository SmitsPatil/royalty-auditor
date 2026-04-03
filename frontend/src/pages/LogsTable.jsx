import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Activity, Globe, Monitor } from 'lucide-react';
import api from '../api';
import { formatDate } from '../utils';

export default function LogsTable() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState('');

  const fetchLogs = (page, query = '') => {
    setLoading(true);
    const skip = (page - 1) * pageSize;
    api.get(`/logs?limit=${pageSize}&skip=${skip}&q=${query}`).then(r => {
      setLogs(r.data.data || []);
      setTotal(r.data.total || 0);
      setLoading(false);
    }).catch(err => {
      console.error("Failed to fetch logs", err);
      setLoading(false);
    });
  };

  useEffect(() => {
    setCurrentPage(1);
    const delayDebounceFn = setTimeout(() => fetchLogs(1, search), 400);
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  useEffect(() => {
    fetchLogs(currentPage, search);
  }, [currentPage]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="animate-in delay-1 flex flex-col flex-1 min-h-screen w-full max-w-none px-6 py-4">
      <div className="page-header flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Activity size={24} className="text-blue-500" />
            Streaming Logs
          </h1>
          <p className="page-subtitle">Historical play events from the high-velocity usage ledger</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input 
              type="text" 
              placeholder="Search by Play/Content/Contract ID..." 
              className="search-input pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '400px' }}
            />
          </div>
          <span className="badge badge-purple font-bold px-3">Live Feed</span>
        </div>
      </div>

      {loading ? (
        <div className="loading-wrap flex-1" style={{ minHeight: '400px' }}><div className="spinner"/><span>Streaming event data…</span></div>
      ) : (
      <>
        <div className="table-wrap flex-1 mb-4">
          <table className="data-table table-zebra">
            <thead>
              <tr>
                <th style={{ minWidth: '150px' }}>Play ID</th>
                <th style={{ minWidth: '180px' }}>Content</th>
                <th style={{ minWidth: '150px' }}>Contract</th>
                <th style={{ minWidth: '100px' }}>Plays</th>
                <th style={{ minWidth: '120px' }}>Region</th>
                <th style={{ minWidth: '150px' }}>Device</th>
                <th style={{ minWidth: '180px' }}>Timestamp</th>
                <th style={{ textAlign: 'right', minWidth: '120px', position: 'sticky', right: 0, background: '#f8fafc', boxShadow: '-2px 0 5px rgba(0,0,0,0.05)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-20 text-muted">No telemetry logs found. Check system ingest?</td></tr>
              ) : logs.map(l => (
                <tr key={l.play_id}>
                  <td className="font-bold text-xs font-mono text-slate-500">{l.play_id}</td>
                  <td className="font-semibold text-blue-700">{l.content_id}</td>
                  <td>
                    {l.contract_id
                      ? <span className="font-bold">{l.contract_id}</span>
                      : <span className="badge badge-red text-[10px]">UNLINKED</span>}
                  </td>
                  <td className="font-bold">{l.plays?.toLocaleString()}</td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <Globe size={12} className="text-slate-400" />
                      <span className="badge badge-gray text-xs">{l.country}</span>
                    </div>
                  </td>
                  <td className="text-muted text-xs flex items-center gap-1.5">
                    <Monitor size={12} /> {l.device}
                  </td>
                  <td className="text-muted text-xs">{formatDate(l.timestamp)}</td>
                  <td style={{ textAlign: 'right', position: 'sticky', right: 0, background: 'inherit', boxShadow: '-2px 0 5px rgba(0,0,0,0.02)' }}>
                    <button className="action-btn action-btn-edit" title="Trace Raw Event">
                      <span>Trace</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination-wrap">
          <div className="pagination-info">
            Showing events <strong>{(currentPage - 1) * pageSize + 1}</strong> to <strong>{Math.min(currentPage * pageSize, total)}</strong> of <strong>{total}</strong>
          </div>
          <div className="pagination-controls">
            <button 
              className="pagination-btn" 
              disabled={currentPage === 1 || loading} 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <div className="pagination-info flex items-center px-4 font-semibold">
              Page {currentPage} of {totalPages || 1}
            </div>
            <button 
              className="pagination-btn" 
              disabled={currentPage >= totalPages || loading} 
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </>
      )}
    </div>
  );
}
