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
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState('');

  const fetchResults = (page, query = '') => {
    setLoading(true);
    const skip = (page - 1) * pageSize;
    api.get(`/audit/results?limit=${pageSize}&skip=${skip}&q=${query}`).then(r => {
      setResults(r.data.data || []);
      setTotal(r.data.total || 0);
      setLoading(false);
    }).catch(err => {
      console.error("Failed to fetch audit results", err);
      setLoading(false);
    });
  };

  useEffect(() => {
    setCurrentPage(1);
    const delayDebounceFn = setTimeout(() => fetchResults(1, search), 400);
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  useEffect(() => {
    fetchResults(currentPage, search);
  }, [currentPage]);

  const totalPages = Math.ceil(total / pageSize);

  const handleExport = () =>
    window.open(`${import.meta.env.VITE_API_URL || ''}/api/export/audit_results.csv`, '_blank');

  return (
    <div className="animate-in delay-1 flex flex-col flex-1 min-h-screen w-full max-w-none px-6 py-4">
      <div className="page-header flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Audit Results</h1>
          <p className="page-subtitle">Detailed financial comparison Across All Contracts</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input 
              type="text" 
              placeholder="Search Content/Contract..." 
              className="search-input pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '320px' }}
            />
          </div>
          <button className="btn btn-outline" onClick={handleExport}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-wrap flex-1" style={{ minHeight: '400px' }}><div className="spinner"/><span>Analyzing audit data…</span></div>
      ) : (
      <>
        <div className="table-wrap flex-1 mb-4">
          <table className="data-table table-zebra">
            <thead>
              <tr>
                <th style={{ minWidth: '150px' }}>Contract</th>
                <th style={{ minWidth: '200px' }}>Content</th>
                <th style={{ minWidth: '100px' }}>Plays</th>
                <th style={{ minWidth: '120px' }}>Expected</th>
                <th style={{ minWidth: '120px' }}>Paid</th>
                <th style={{ minWidth: '140px' }}>Difference</th>
                <th style={{ minWidth: '150px' }}>Audit Date</th>
                <th style={{ minWidth: '120px' }}>Status</th>
                <th style={{ textAlign: 'right', minWidth: '160px', position: 'sticky', right: 0, background: '#f8fafc', boxShadow: '-2px 0 5px rgba(0,0,0,0.05)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-muted">No results found matching your search.</td></tr>
              ) : results.map((r, i) => (
                <tr key={r.id || i}>
                  <td className="font-bold">{r.contract_id}</td>
                  <td className="text-secondary">{r.content_id}</td>
                  <td className="font-semibold">{r.total_plays?.toLocaleString()}</td>
                  <td className="font-semibold">₹{r.expected?.toLocaleString()}</td>
                  <td className="font-semibold">₹{r.paid?.toLocaleString()}</td>
                  <td className={`font-bold ${r.difference > 0 ? 'text-red' : r.difference < 0 ? 'text-green' : ''}`}>
                    {r.difference > 0 ? '+' : ''}₹{r.difference?.toLocaleString()}
                  </td>
                  <td className="text-muted">{formatDate(r.timestamp)}</td>
                  <td>{statusBadge(r.status)}</td>
                  <td style={{ textAlign: 'right', position: 'sticky', right: 0, background: 'inherit', boxShadow: '-2px 0 5px rgba(0,0,0,0.02)' }}>
                    <button className="action-btn action-btn-edit mr-2" title="View Details">
                      <Eye size={14}/> <span>View</span>
                    </button>
                    <button className="action-btn action-btn-delete" title="Flag for Review">
                      <Trash2 size={14}/> <span>Flag</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination-wrap">
          <div className="pagination-info">
            Showing audit entries <strong>{(currentPage - 1) * pageSize + 1}</strong> to <strong>{Math.min(currentPage * pageSize, total)}</strong> of <strong>{total}</strong>
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
