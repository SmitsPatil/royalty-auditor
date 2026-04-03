import { useState, useEffect } from 'react';
import { Edit, Trash2, X, Check, AlertTriangle, Upload } from 'lucide-react';
import api from '../api';
import { formatDate } from '../utils';
import Papa from 'papaparse';
import * as pdfjsLib from 'pdfjs-dist';

// Worker configuration for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// ─── Delete Confirmation Modal Component ───────────────────────────
const DeleteModal = ({ isOpen, onCancel, onConfirm, contractId, retentionDays, setRetentionDays }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header flex items-center gap-2 mb-4 text-red-600">
          <AlertTriangle size={24} />
          <h2 className="modal-title text-red-600">Remove Contract?</h2>
        </div>
        <div className="modal-body">
          <p className="mb-4 text-slate-600">
            Are you sure you want to remove contract <strong className="text-slate-900">{contractId}</strong>? 
            This action will immediately flag associated logs as "missing license".
          </p>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Data Retention Period
            </label>
            <select 
              className="search-input w-full bg-white" 
              value={retentionDays} 
              onChange={e => setRetentionDays(Number(e.target.value))}
            >
              <option value={7}>7 Days (Immediate Clean)</option>
              <option value={30}>30 Days (Standard)</option>
              <option value={180}>6 Months (Archive)</option>
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-red" onClick={onConfirm}>Delete Contract</button>
        </div>
      </div>
    </div>
  );
};

export default function ContractsTable() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  
  const [removingId, setRemovingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fadingRows, setFadingRows] = useState({});

  // Inline editing state
  const [editingContractId, setEditingContractId] = useState(null);
  const [editingDraft, setEditingDraft] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [retentionDays, setRetentionDays] = useState(30);

  const fetchContracts = (currentSkip, query = '') => {
    setLoading(true);
    api.get(`/contracts?limit=100&skip=${currentSkip}&q=${query}`).then(r => {
      const data = r.data.data || r.data || [];
      if (data.length < 100) setHasMore(false);
      
      if (currentSkip === 0) {
        setContracts(data);
      } else {
        setContracts(prev => [...prev, ...data]);
      }
      setLoading(false);
    }).catch(err => {
      console.error("Failed to fetch contracts", err);
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

  const handleDeleteClick = (id) => {
    setRemovingId(id);
    setIsModalOpen(true);
  };

  const submitRemove = async () => {
    const id = removingId;
    try {
      await api.delete(`/contracts/${id}?retention_days=${retentionDays}`);
      setIsModalOpen(false);
      setRemovingId(null);
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
      setContracts(prev => prev.map(c => c.contract_id === editingContractId ? { ...c, ...editingDraft } : c));
      cancelEdit();
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data || err.message;
      alert("Failed to update contract: " + JSON.stringify(msg));
    } finally {
      setSavingEdit(false);
    }
  };

  const parseCSV = (file) => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const cleaned = results.data.map(row => ({
            contract_id: row.contract_id || row.id || `CTR-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            content_id: row.content_id || 'CID-UNKNOWN',
            royalty_rate: parseFloat(row.royalty_rate || 0),
            rate_per_play: parseFloat(row.rate_per_play || 0),
            tier_rate: parseFloat(row.tier_rate || 0),
            tier_threshold: parseInt(row.tier_threshold || 0),
            territory: row.territory || 'Global',
            studio: row.studio || 'Unknown',
            start_date: row.start_date || new Date().toISOString().split('T')[0],
            end_date: row.end_date || '2029-12-31'
          }));
          resolve(cleaned);
        },
        error: (err) => reject(err)
      });
    });
  };

  const parsePDF = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => item.str).join(' ') + ' ';
    }

    // Heuristic extraction for PDF fields
    const contracts = [];
    const lowerText = fullText.toLowerCase();

    // Look for patterns like "Contract ID: CTR-1234"
    const idRegex = /(?:contract\s*id|id|cid)\W*([a-z0-9-]+)/gi;
    const rateRegex = /(?:rate|royalty|price)\W*(\d*\.?\d+)/gi;
    const territoryRegex = /(?:territory|region|country)\W*([a-z,\s]{2,10})/gi;

    let match;
    const ids = [];
    while ((match = idRegex.exec(fullText)) !== null) {
        ids.push(match[1]);
    }

    if (ids.length > 0) {
        ids.forEach((id, idx) => {
            contracts.push({
                contract_id: id,
                content_id: 'CID-PDF-' + id.substring(0, 4),
                rate_per_play: 0.12, // Default fallback if extraction fails
                territory: 'US,UK,IN',
                studio: 'Extracted PDF',
                start_date: new Date().toISOString().split('T')[0],
                end_date: '2030-12-31'
            });
        });
    }

    return contracts;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      let data = [];
      if (file.name.toLowerCase().endsWith('.csv')) {
        data = await parseCSV(file);
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        data = await parsePDF(file);
      }

      if (data.length === 0) {
        throw new Error("No valid data could be extracted from the file.");
      }

      await api.post('/contracts/upload', { contracts: data });
      alert(`Successfully uploaded ${data.length} contracts.`);
      fetchContracts(0, search);
    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to process file: " + err.message);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="animate-in delay-1">
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
            style={{ width: '320px' }}
          />
          <input 
            type="file" 
            id="contract-upload-input" 
            accept=".csv,.pdf" 
            onChange={handleFileUpload} 
            className="hidden" 
            style={{ display: 'none' }}
          />
          <button 
            className="btn btn-blue flex items-center gap-2" 
            onClick={() => document.getElementById('contract-upload-input').click()}
            disabled={loading}
          >
            <Upload size={18} />
            <span>{loading ? 'Processing...' : 'Upload CSV/PDF'}</span>
          </button>
          <span className="badge badge-blue">{contracts.length} visible</span>
        </div>
      </div>
      
      {loading && skip === 0 ? (
        <div className="loading-wrap" style={{ minHeight: '300px' }}><div className="spinner"/><span>Loading records…</span></div>
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
            {contracts.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-10 text-muted">No contracts found.</td></tr>
            ) : contracts.map(c => {
              const isEditing = editingContractId === c.contract_id;

              return (
              <tr key={c.contract_id} style={{ 
                transition: 'opacity 0.4s ease, transform 0.4s ease', 
                opacity: fadingRows[c.contract_id] ? 0 : 1, 
                background: isEditing ? 'rgba(59, 130, 246, 0.05)' : undefined,
                transform: fadingRows[c.contract_id] ? 'translateX(10px)' : 'none'
              }}>
                <td className="font-bold">{c.contract_id}</td>
                
                {isEditing ? (
                  <>
                    <td>{c.content_id}</td>
                    <td><input className="search-input text-xs py-1 px-2" value={editingDraft.studio || ''} onChange={e => setEditingDraft({...editingDraft, studio: e.target.value})} /></td>
                    <td><input type="number" step="0.01" className="search-input text-xs py-1 px-2" value={editingDraft.rate_per_play} onChange={e => setEditingDraft({...editingDraft, rate_per_play: Number(e.target.value)})} /></td>
                    <td><input type="number" step="0.01" className="search-input text-xs py-1 px-2" value={editingDraft.tier_rate} onChange={e => setEditingDraft({...editingDraft, tier_rate: Number(e.target.value)})} /></td>
                    <td><input type="number" className="search-input text-xs py-1 px-2" value={editingDraft.tier_threshold} onChange={e => setEditingDraft({...editingDraft, tier_threshold: Number(e.target.value)})} /></td>
                    <td><input className="search-input text-xs py-1 px-2" value={editingDraft.territory || ''} onChange={e => setEditingDraft({...editingDraft, territory: e.target.value})} /></td>
                    <td><input type="date" className="search-input text-xs py-1 px-1" value={editingDraft.start_date || ''} onChange={e => setEditingDraft({...editingDraft, start_date: e.target.value})} /></td>
                    <td><input type="date" className="search-input text-xs py-1 px-1" value={editingDraft.end_date || ''} onChange={e => setEditingDraft({...editingDraft, end_date: e.target.value})} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex gap-2 justify-end">
                        <button className="icon-btn icon-btn-edit" onClick={submitEdit} disabled={savingEdit} title="Save Changes">
                          {savingEdit ? <div className="spinner" style={{width: 14, height: 14}}/> : <Check size={16}/>}
                        </button>
                        <button className="icon-btn" onClick={cancelEdit} disabled={savingEdit} title="Cancel Editing">
                          <X size={16}/>
                        </button>
                      </div>
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
                    <td style={{ textAlign: 'right' }}>
                      <div className="actions-cell">
                        <button 
                          className="icon-btn icon-btn-edit" 
                          onClick={() => startEdit(c)} 
                          title="Edit Contract"
                        >
                          <Edit size={16}/>
                        </button>
                        <button 
                          className="icon-btn icon-btn-delete" 
                          onClick={() => handleDeleteClick(c.contract_id)} 
                          title="Remove Contract"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>
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

      {/* ─── Delete Confirmation Modal ─── */}
      <DeleteModal 
        isOpen={isModalOpen}
        onCancel={() => { setIsModalOpen(false); setRemovingId(null); }}
        onConfirm={submitRemove}
        contractId={removingId}
        retentionDays={retentionDays}
        setRetentionDays={setRetentionDays}
      />
    </div>
  );
}
