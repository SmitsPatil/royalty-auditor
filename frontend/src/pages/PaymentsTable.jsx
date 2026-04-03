import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Eye, FileCheck } from 'lucide-react';
import api from '../api';
import { formatDate } from '../utils';

export default function PaymentsTable() {
  const [payments, setPayments] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState('');

  const fetchPayments = (page, query = '') => {
    setLoading(true);
    const skip = (page - 1) * pageSize;
    api.get(`/payments?limit=${pageSize}&skip=${skip}&q=${query}`).then(r => {
      setPayments(r.data.data || []);
      setTotal(r.data.total || 0);
      setLoading(false);
    }).catch(err => {
      console.error("Failed to fetch payments", err);
      setLoading(false);
    });
  };

  useEffect(() => {
    setCurrentPage(1);
    const delayDebounceFn = setTimeout(() => fetchPayments(1, search), 400);
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  useEffect(() => {
    fetchPayments(currentPage, search);
  }, [currentPage]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="animate-in delay-1 flex flex-col flex-1 min-h-screen w-full max-w-none px-6 py-4">
      <div className="page-header flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title text-2xl">Payment Ledger</h1>
          <p className="page-subtitle">Disbursed content royalties across the ecosystem</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input 
              type="text" 
              placeholder="Search Payment/Content ID..." 
              className="search-input pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '320px' }}
            />
          </div>
          <span className="badge badge-green font-bold px-3">Sync Active</span>
        </div>
      </div>

      {loading ? (
        <div className="loading-wrap flex-1" style={{ minHeight: '400px' }}><div className="spinner"/><span>Synchronizing ledger data…</span></div>
      ) : (
      <>
        <div className="table-wrap flex-1 mb-4">
          <table className="data-table table-zebra">
            <thead>
              <tr>
                <th style={{ minWidth: '150px' }}>Payment ID</th>
                <th style={{ minWidth: '150px' }}>Contract</th>
                <th style={{ minWidth: '200px' }}>Content</th>
                <th style={{ minWidth: '150px' }}>Amount Paid</th>
                <th style={{ minWidth: '150px' }}>Payment Date</th>
                <th style={{ textAlign: 'right', minWidth: '160px', position: 'sticky', right: 0, background: '#f8fafc', boxShadow: '-2px 0 5px rgba(0,0,0,0.05)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-20 text-muted">No payments found matching your criteria.</td></tr>
              ) : payments.map(p => (
                <tr key={p.payment_id}>
                  <td className="font-bold text-blue-600">{p.payment_id}</td>
                  <td className="font-semibold">{p.contract_id}</td>
                  <td className="text-secondary">{p.content_id}</td>
                  <td className="font-bold text-green-600">₹{p.amount_paid?.toLocaleString()}</td>
                  <td className="text-muted">{formatDate(p.payment_date)}</td>
                  <td style={{ textAlign: 'right', position: 'sticky', right: 0, background: 'inherit', boxShadow: '-2px 0 5px rgba(0,0,0,0.02)' }}>
                    <button className="action-btn action-btn-edit mr-2" title="View Transaction">
                      <Eye size={14}/> <span>View</span>
                    </button>
                    <button className="action-btn action-btn-delete" style={{ color: 'var(--blue)', borderColor: 'rgba(59,130,246,0.2)' }} title="Download Invoice">
                      <FileCheck size={14}/> <span>Receipt</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
