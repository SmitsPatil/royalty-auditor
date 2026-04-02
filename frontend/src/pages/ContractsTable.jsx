import { useState, useEffect } from 'react';
import { Edit, Trash2, X, Check } from 'lucide-react';
import api from '../api';
import { formatDate } from '../utils';

export default function ContractsTable() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  
  const [removingId, setRemovingId] = useState(null);
  const [fadingRows, setFadingRows] = useState({});

  // Inline editing state
  const [editingContractId, setEditingContractId] = useState(null);
  const [editingDraft, setEditingDraft] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [retentionDays, setRetentionDays] = useState(30);

  const fetchContracts = (currentSkip, query = '') => {
    api.get(`/contracts?limit=100&skip=${currentSkip}&q=${query}`).then(r => {
      if (r.data.length < 100) setHasMore(false);
      if (currentSkip === 0) setContracts(r.data);
      else setContracts(prev => [...prev, ...r.data]);
      setLoading(false);
    });
  };

  useEffect(() => {
    setLoading(true);
    setSkip(0);
    setHasMore(true);
    const delayDebounceFn = setTimeout(() => fetchContracts(0, search), 400);
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const loadMore = () => {
    const nextSkip = skip + 100;
    setSkip(nextSkip);
    fetchContracts(nextSkip, search);
  };

  const submitRemove = async () => {
    const id = removingId;
    try {
      await api.delete(`/contracts/${id}?retention_days=${retentionDays}`);
      setRemovingId(null);
      // Trigger fade out
      setFadingRows(prev => ({...prev, [id]: true}));
      setTimeout(() => {
        setContracts(prev => prev.filter(c => c.contract_id !== id));
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
      // Update locally immediately
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
    <div className="animate-in delay-1 relative">
      <div className="page-header flex items-center justify-between">
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
            style={{ maxWidth: '400px', width: '100%', flex: 1 }}
          />
          <span className="badge badge-blue">{contracts.length} visible</span>
        </div>
      </div>
      
      {loading && skip === 0 ? (
        <div className="loading-wrap" style={{ minHeight: '300px' }}><div className="spinner"/><span>Loading contracts…</span></div>
      ) : (
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Contract ID</th><th>Content</th><th>Studio</th>
              <th>Rate/Play</th><th>Tier Rate</th><th>Threshold</th>
              <th>Territory</th><th>Valid From</th><th>Valid To</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map(c => {
              const isEditing = editingContractId === c.contract_id;
              const isRemoving = removingId === c.contract_id;

              return (
              <tr key={c.contract_id} style={{ 
                transition: 'all 0.8s ease', 
                opacity: fadingRows[c.contract_id] ? 0 : 1, 
                background: isEditing ? '#f8fafc' : isRemoving ? '#fff1f2' : undefined,
                transform: fadingRows[c.contract_id] ? 'translateX(20px)' : 'none'
              }}>
                <td className="font-semibold text-sm">{c.contract_id}</td>
                
                {isRemoving ? (
                  <>
                    <td colSpan={7} className="text-sm">
                      <div className="flex items-center gap-4 py-1">
                        <span className="text-red font-semibold flex items-center gap-2"><Trash2 size={14}/> Confirm removal?</span>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-muted">Retain for:</label>
                          <select className="search-input text-xs py-0 px-2" style={{ height: '24px' }} value={retentionDays} onChange={e => setRetentionDays(Number(e.target.value))}>
                            <option value={7}>7 Days</option>
                            <option value={30}>30 Days</option>
                            <option value={180}>6 Months</option>
                            <option value={365}>1 Year</option>
                          </select>
                        </div>
                        <span className="text-xs text-muted italic">Logs will be flagged as "missing license" instantly.</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', minWidth: '90px' }}>
                      <button className="btn btn-sm mr-1" onClick={submitRemove} style={{ padding: '6px', background: 'var(--red)', color: 'white' }}>Delete</button>
                      <button className="btn btn-sm" onClick={() => setRemovingId(null)} style={{ padding: '6px', background: 'transparent', color: '#6b7280' }}>Cancel</button>
                    </td>
                  </>
                ) : isEditing ? (
                  <>
                    <td className="text-sm">{c.content_id}</td>
                    <td className="text-sm"><input className="search-input text-xs w-full py-1 px-2" value={editingDraft.studio || ''} onChange={e => setEditingDraft({...editingDraft, studio: e.target.value})} /></td>
                    <td className="text-sm"><input type="number" step="0.01" className="search-input text-xs w-full py-1 px-2" value={editingDraft.rate_per_play} onChange={e => setEditingDraft({...editingDraft, rate_per_play: Number(e.target.value)})} /></td>
                    <td className="text-sm"><input type="number" step="0.01" className="search-input text-xs w-full py-1 px-2" value={editingDraft.tier_rate} onChange={e => setEditingDraft({...editingDraft, tier_rate: Number(e.target.value)})} /></td>
                    <td className="text-sm"><input type="number" className="search-input text-xs w-full py-1 px-2" value={editingDraft.tier_threshold} onChange={e => setEditingDraft({...editingDraft, tier_threshold: Number(e.target.value)})} /></td>
                    <td className="text-sm"><input className="search-input text-xs w-full py-1 px-2" value={editingDraft.territory || ''} onChange={e => setEditingDraft({...editingDraft, territory: e.target.value})} /></td>
                    <td className="text-sm text-muted"><input type="date" className="search-input text-xs w-full py-1 px-1" value={editingDraft.start_date || ''} onChange={e => setEditingDraft({...editingDraft, start_date: e.target.value})} /></td>
                    <td className="text-sm text-muted"><input type="date" className="search-input text-xs w-full py-1 px-1" value={editingDraft.end_date || ''} onChange={e => setEditingDraft({...editingDraft, end_date: e.target.value})} /></td>
                    <td style={{ textAlign: 'right', minWidth: '90px' }}>
                      <button className="btn btn-sm mr-1" onClick={submitEdit} disabled={savingEdit} style={{ padding: '6px', background: 'var(--green)', color: 'white' }} title="Save Changes">
                        {savingEdit ? <div className="spinner" style={{width: 14, height: 14}}/> : <Check size={14}/>}
                      </button>
                      <button className="btn btn-sm" onClick={cancelEdit} disabled={savingEdit} style={{ padding: '6px', background: 'transparent', color: 'var(--red)' }} title="Cancel"><X size={14}/></button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="text-sm">{c.content_id}</td>
                    <td className="text-sm">{c.studio}</td>
                    <td className="text-sm">₹{c.rate_per_play}</td>
                    <td className="text-sm">₹{c.tier_rate}</td>
                    <td className="text-sm">{c.tier_threshold?.toLocaleString()}</td>
                    <td className="text-sm"><span className="badge badge-gray">{c.territory || 'Global'}</span></td>
                    <td className="text-sm text-muted">{formatDate(c.start_date)}</td>
                    <td className="text-sm text-muted">{formatDate(c.end_date)}</td>
                    <td style={{ textAlign: 'right', minWidth: '80px' }}>
                      <button className="btn btn-sm mr-2" onClick={() => startEdit(c)} style={{ padding: '4px 6px', background: 'transparent', color: '#6b7280' }} title="Edit inline"><Edit size={14}/></button>
                      <button className="btn btn-sm" onClick={() => setRemovingId(c.contract_id)} style={{ padding: '4px 6px', background: 'transparent', color: 'var(--red)' }} title="Remove mapping"><Trash2 size={14}/></button>
                    </td>
                  </>
                )}
              </tr>
            )})}
          </tbody>
        </table>
      </div>
      )}
      
      {hasMore && !loading && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
          <button className="btn btn-outline" onClick={loadMore}>
            Load More Contracts
          </button>
        </div>
      )}
    </div>
  );
}
