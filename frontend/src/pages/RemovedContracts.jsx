import { useState, useEffect } from 'react';
import { RefreshCcw, ArchiveX } from 'lucide-react';
import api from '../api';

export default function RemovedContracts() {
  const [removed, setRemoved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(null);

  const fetchRemoved = () => {
    setLoading(true);
    api.get('/contracts/removed').then(r => {
      setRemoved(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchRemoved();
  }, []);

  const handleRestore = async (id) => {
    setRestoring(id);
    try {
      await api.post(`/contracts/${id}/restore`);
      // Re-fetch list
      fetchRemoved();
    } catch (e) {
      alert("Failed to restore contract");
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div className="animate-in delay-1">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <ArchiveX size={24} />
            Removed Contracts History
          </h1>
          <p className="page-subtitle">Tracked graveyard of soft-deleted licenses waiting for auto-expunge</p>
        </div>
      </div>
      
      {loading ? (
        <div className="loading-wrap" style={{ minHeight: '300px' }}><div className="spinner"/><span>Loading graveyard…</span></div>
      ) : removed.length === 0 ? (
        <div className="card text-center text-muted p-10 mt-6" style={{ padding: '4rem' }}>
          No removed contracts found in history.
        </div>
      ) : (
        <div className="table-wrap mt-6">
          <table className="data-table">
            <thead>
              <tr>
                <th>Contract ID</th>
                <th>Content Link</th>
                <th>Deleted At</th>
                <th>Auto-Expunge At</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {removed.map(c => (
                <tr key={c.contract_id} className="fade-in">
                  <td className="font-semibold text-sm">{c.contract_id}</td>
                  <td className="text-sm">{c.content_id} ({c.studio})</td>
                  <td className="text-sm text-red">{new Date(c.deleted_at).toLocaleString()}</td>
                  <td className="text-sm text-muted">{new Date(c.auto_expunge_at).toLocaleString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      className="btn btn-primary btn-sm flex items-center gap-2" 
                      onClick={() => handleRestore(c.contract_id)}
                      disabled={restoring === c.contract_id}
                      style={{ marginLeft: 'auto' }}
                    >
                      {restoring === c.contract_id ? <div className="spinner" style={{width: 12, height:12, borderLeftColor:'white'}}/> : <RefreshCcw size={14} />}
                      Restore
                    </button>
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
