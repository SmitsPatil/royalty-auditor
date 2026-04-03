import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Activity, Globe, Monitor, Zap } from 'lucide-react';
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
      // Use the paginated backend response structure
      const dataItems = r.data.data || r.data || [];
      const totalCount = r.data.total || (Array.isArray(dataItems) ? dataItems.length : 0);
      
      setLogs(Array.isArray(dataItems) ? dataItems : []);
      setTotal(totalCount);
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
      {/* ── Page Header Standard ── */}
      <div className="page-header flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <Activity size={24} className="text-blue-500" />
            Streaming Logs
          </h1>
          <p className="page-subtitle">Real-time play telemetry from the usage ledger</p>
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
        <div className="loading-wrap flex-1" style={{ minHeight: '40vh' }}>
          <div className="spinner" />
          <span>Synchronizing telemetry…</span>
        </div>
      ) : (
      <>
        <div className="table-wrap flex-1 mb-4 overflow-x-auto">
          <table className="data-table table-zebra w-full text-xs">
            <thead>
              <tr className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                <th className="py-3 px-4 text-left" style={{ minWidth: '130px' }}>Play ID</th>
                <th className="py-3 px-4 text-left" style={{ minWidth: '180px' }}>Content</th>
                <th className="py-3 px-4 text-left" style={{ minWidth: '140px' }}>Contract</th>
                <th className="py-3 px-4 text-left" style={{ minWidth: '100px' }}>Plays</th>
                <th className="py-3 px-4 text-left" style={{ minWidth: '120px' }}>Region</th>
                <th className="py-3 px-4 text-left" style={{ minWidth: '140px' }}>Device</th>
                <th className="py-3 px-4 text-left" style={{ minWidth: '180px' }}>Timestamp</th>
                <th className="py-3 px-4 text-right sticky right-0 bg-slate-50" style={{ minWidth: '120px', boxShadow: '-2px 0 5px rgba(0,0,0,0.05)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-20 text-muted">No telemetry records found. Check ingest stream?</td></tr>
              ) : logs.map(l => (
                <tr key={l.play_id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="font-bold text-slate-500 font-mono py-2.5 px-4">{l.play_id}</td>
                  <td className="font-bold text-blue-700 py-2.5 px-4">{l.content_id}</td>
                  <td className="py-2.5 px-4">
                    {l.contract_id
                      ? <span className="font-bold">{l.contract_id}</span>
                      : <span className="badge badge-red text-[10px]">UNLINKED</span>}
                  </td>
                  <td className="font-bold py-2.5 px-4">{l.plays?.toLocaleString()}</td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-1.5 capitalize text-slate-600">
                      <Globe size={12} className="text-slate-400" />
                      <span className="badge badge-gray text-xs">{l.country}</span>
                    </div>
                  </td>
                  <td className="text-muted py-2.5 px-4">
                    <div className="flex items-center gap-1.5 capitalize">
                      <Monitor size={12} /> {l.device}
                    </div>
                  </td>
                  <td className="text-muted py-2.5 px-4 whitespace-nowrap">{formatDate(l.timestamp)}</td>
                  <td className="text-right py-2.5 px-4 sticky right-0 bg-inherit" style={{ boxShadow: '-2px 0 5px rgba(0,0,0,0.02)' }}>
                    <button className="action-btn action-btn-edit font-bold" title="Trace Raw Event">
                      <Zap size={12} /> <span>Trace</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Standard Pagination Footer ── */}
        <div className="pagination-wrap">
          <div className="pagination-info">
            Showing records <strong>{(currentPage - 1) * pageSize + 1}</strong> to <strong>{Math.min(currentPage * pageSize, total)}</strong> of <strong>{total}</strong>
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
