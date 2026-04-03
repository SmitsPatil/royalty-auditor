import { useState, useEffect } from 'react';
import { Edit, Trash2, X, Check } from 'lucide-react';
import api from '../api';
import { formatDate } from '../utils';

export default function ContractsTable() {
  const [contracts, setContracts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState('');
  
  const [removingId, setRemovingId] = useState(null);
  const [fadingRows, setFadingRows] = useState({});

  // Inline editing state
  const [editingContractId, setEditingContractId] = useState(null);
  const [editingDraft, setEditingDraft] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [retentionDays, setRetentionDays] = useState(30);

  const fetchContracts = (page, query = '') => {
    setLoading(true);
    const skip = (page - 1) * pageSize;
    api.get(`/contracts?limit=${pageSize}&skip=${skip}&q=${query}`).then(r => {
      setContracts(r.data.data || []);
      setTotal(r.data.total || 0);
      setLoading(false);
    }).catch(err => {
      console.error("Failed to fetch contracts", err);
      setLoading(false);
    });
  };

  useEffect(() => {
    setCurrentPage(1);
    const delayDebounceFn = setTimeout(() => fetchContracts(1, search), 400);
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  useEffect(() => {
    fetchContracts(currentPage, search);
  }, [currentPage]);

  const totalPages = Math.ceil(total / pageSize);

  const submitRemove = async () => {
    const id = removingId;
    try {
      await api.delete(`/contracts/${id}?retention_days=${retentionDays}`);
      setRemovingId(null);
      // Trigger fade out
      setFadingRows(prev => ({...prev, [id]: true}));
      setTimeout(() => {
        setContracts(prev => prev.filter(c => c.contract_id !== id));
        setTotal(prev => prev - 1);
      }, 800);
    } catch (e) {
      alert("Failed to remove contract");
    }
  };

  const startEdit = (c) => {
    setEditingContractId(c.contract_id);
    setEditingDraft({...c});
  };

  const cancelEdit = () => {
    setEditingContractId(null);
    setEditingDraft(null);
  };

  const submitEdit = async () => {
    setSavingEdit(true);
    try {
      await api.put(`/contracts/${editingContractId}`, editingDraft);
      setContracts(prev => prev.map(c => c.contract_id === editingContractId ? { ...c, ...editingDraft } : c));
      cancelEdit();
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data || err.message;
      alert("Failed to update contract: " + JSON.stringify(msg));
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="animate-in delay-1 flex flex-col flex-1 min-h-screen w-full max-w-none px-6 py-4">
      <div className="page-header flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Contract Repository</h1>
          <p className="page-subtitle">Historical digital licensing agreements</p>
        </div>
        <div className="flex items-center gap-4">
          <input 
            type="text" 
            placeholder="Search Title/Contract/Studio..." 
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: '400px', width: '100%' }}
          />
          <span className="badge badge-blue">{total} Total</span>
        </div>
      </div>
      
      {loading ? (
        <div className="loading-wrap flex-1" style={{ minHeight: '400px' }}><div className="spinner"/><span>Loading records…</span></div>
      ) : (
      <>
        <div className="table-wrap flex-1 mb-4">
          <table className="data-table table-zebra">
            <thead>
              <tr>
                <th style={{ minWidth: '120px' }}>Contract ID</th>
                <th style={{ minWidth: '150px' }}>Content</th>
                <th style={{ minWidth: '150px' }}>Studio</th>
                <th style={{ minWidth: '100px' }}>Rate/Play</th>
                <th style={{ minWidth: '100px' }}>Tier Rate</th>
                <th style={{ minWidth: '100px' }}>Threshold</th>
                <th style={{ minWidth: '150px' }}>Territory</th>
                <th style={{ minWidth: '120px' }}>Valid From</th>
                <th style={{ minWidth: '120px' }}>Valid To</th>
                <th style={{ textAlign: 'right', minWidth: '150px', position: 'sticky', right: 0, background: '#f8fafc', boxShadow: '-2px 0 5px rgba(0,0,0,0.05)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-10 text-muted">No contracts found matching your search.</td></tr>
              ) : contracts.map(c => {
                const isEditing = editingContractId === c.contract_id;
                const isRemoving = removingId === c.contract_id;

                return (
                <tr key={c.contract_id} style={{ 
                  transition: 'opacity 0.4s ease, transform 0.4s ease', 
                  opacity: fadingRows[c.contract_id] ? 0 : 1, 
                  background: isEditing ? 'rgba(59, 130, 246, 0.05)' : isRemoving ? 'rgba(239, 68, 68, 0.05)' : undefined,
                  transform: fadingRows[c.contract_id] ? 'translateX(10px)' : 'none'
                }}>
                  <td className="font-bold">{c.contract_id}</td>
                  
                  {isRemoving ? (
                    <>
                      <td colSpan={8}>
                        <div className="flex items-center gap-4 py-1">
                          <span className="text-red font-bold flex items-center gap-2"><Trash2 size={14}/> Confirm Removal?</span>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-muted">Retain for:</label>
                            <select className="search-input text-xs py-0 px-2" style={{ height: '24px', width: 'auto' }} value={retentionDays} onChange={e => setRetentionDays(Number(e.target.value))}>
                              <option value={7}>7 Days</option>
                              <option value={30}>30 Days</option>
                              <option value={180}>6 Months</option>
                            </select>
                          </div>
                          <span className="text-xs text-muted italic opacity-70">Logs will flag as "missing license" instantly.</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', position: 'sticky', right: 0, background: isRemoving ? '#fff5f5' : 'inherit' }}>
                        <button className="btn btn-sm btn-red mr-1" onClick={submitRemove}>Delete</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => setRemovingId(null)}>Cancel</button>
                      </td>
                    </>
                  ) : isEditing ? (
                    <>
                      <td>{c.content_id}</td>
                      <td><input className="search-input text-xs py-1 px-2" value={editingDraft.studio || ''} onChange={e => setEditingDraft({...editingDraft, studio: e.target.value})} /></td>
                      <td><input type="number" step="0.01" className="search-input text-xs py-1 px-2" value={editingDraft.rate_per_play} onChange={e => setEditingDraft({...editingDraft, rate_per_play: Number(e.target.value)})} /></td>
                      <td><input type="number" step="0.01" className="search-input text-xs py-1 px-2" value={editingDraft.tier_rate} onChange={e => setEditingDraft({...editingDraft, tier_rate: Number(e.target.value)})} /></td>
                      <td><input type="number" className="search-input text-xs py-1 px-2" value={editingDraft.tier_threshold} onChange={e => setEditingDraft({...editingDraft, tier_threshold: Number(e.target.value)})} /></td>
                      <td><input className="search-input text-xs py-1 px-2" value={editingDraft.territory || ''} onChange={e => setEditingDraft({...editingDraft, territory: e.target.value})} /></td>
                      <td><input type="date" className="search-input text-xs py-1 px-1" value={editingDraft.start_date || ''} onChange={e => setEditingDraft({...editingDraft, start_date: e.target.value})} /></td>
                      <td><input type="date" className="search-input text-xs py-1 px-1" value={editingDraft.end_date || ''} onChange={e => setEditingDraft({...editingDraft, end_date: e.target.value})} /></td>
                      <td style={{ textAlign: 'right', position: 'sticky', right: 0, background: '#f0f7ff' }}>
                        <button className="action-btn action-btn-edit mr-1" onClick={submitEdit} disabled={savingEdit}>
                          {savingEdit ? <div className="spinner" style={{width: 14, height: 14}}/> : <Check size={14}/>} <span className="ml-1">Save</span>
                        </button>
                        <button className="action-btn action-btn-delete" onClick={cancelEdit} disabled={savingEdit}><X size={14}/> <span className="ml-1">Cancel</span></button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{c.content_id}</td>
                      <td>{c.studio}</td>
                      <td className="font-semibold">₹{c.rate_per_play}</td>
                      <td className="font-semibold">₹{c.tier_rate}</td>
                      <td>{c.tier_threshold?.toLocaleString()}</td>
                      <td><span className="badge badge-gray">{c.territory || 'Global'}</span></td>
                      <td className="text-muted">{formatDate(c.start_date)}</td>
                      <td className="text-muted">{formatDate(c.end_date)}</td>
                      <td style={{ textAlign: 'right', position: 'sticky', right: 0, background: 'inherit', boxShadow: '-2px 0 5px rgba(0,0,0,0.02)' }}>
                        <button className="action-btn action-btn-edit mr-2" onClick={() => startEdit(c)} title="Edit inline">
                          <Edit size={14}/> <span>Edit</span>
                        </button>
                        <button className="action-btn action-btn-delete" onClick={() => setRemovingId(c.contract_id)} title="Remove mapping">
                          <Trash2 size={14}/> <span>Delete</span>
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              )})}
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
              Previous
            </button>
            <div className="pagination-info flex items-center px-4">
              Page {currentPage} of {totalPages || 1}
            </div>
            <button 
              className="pagination-btn" 
              disabled={currentPage >= totalPages || loading} 
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </>
      )}
    </div>
  );
}
