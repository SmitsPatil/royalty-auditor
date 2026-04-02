import { useState, useEffect } from 'react';
import api from '../api';
import { formatDate } from '../utils';

export default function PaymentsTable() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');

  const fetchPayments = (currentSkip, query = '') => {
    api.get(`/payments?limit=100&skip=${currentSkip}&q=${query}`).then(r => {
      if (r.data.length < 100) setHasMore(false);
      if (currentSkip === 0) {
        setPayments(r.data);
      } else {
        setPayments(prev => [...prev, ...r.data]);
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    setLoading(true);
    setSkip(0);
    setHasMore(true);
    const delayDebounceFn = setTimeout(() => {
      fetchPayments(0, search);
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const loadMore = () => {
    const nextSkip = skip + 100;
    setSkip(nextSkip);
    fetchPayments(nextSkip, search);
  };


  const total = payments.reduce((s, p) => s + (p.amount_paid || 0), 0);

  return (
    <div className="animate-in delay-1">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Payment Ledger</h1>
          <p className="page-subtitle">Disbursed content royalties</p>
        </div>
        <div className="flex items-center gap-4">
          <input 
            type="text" 
            placeholder="Search Payment/Content ID..." 
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '280px' }}
          />
          <span className="badge badge-green">{payments.length} visible</span>
        </div>
      </div>
      {loading && skip === 0 ? (
        <div className="loading-wrap" style={{ minHeight: '300px' }}><div className="spinner"/><span>Loading payments…</span></div>
      ) : (
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Payment ID</th><th>Contract</th><th>Content</th>
              <th>Amount Paid</th><th>Date</th>
            </tr>
          </thead>
          <tbody>
            {payments.map(p => (
              <tr key={p.payment_id}>
                <td className="font-semibold text-sm">{p.payment_id}</td>
                <td className="text-sm">{p.contract_id}</td>
                <td className="text-sm">{p.content_id}</td>
                <td className="text-sm font-semibold text-green">₹{p.amount_paid?.toLocaleString()}</td>
                <td className="text-sm text-muted">{formatDate(p.payment_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      )}
      
      {hasMore && !loading && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
          <button className="btn btn-outline" onClick={loadMore}>
            Load More Payments
          </button>
        </div>
      )}
    </div>
  );
}
