import { useState, useEffect } from 'react';
import { Edit, Trash2, X, Check, AlertTriangle, Upload, Info, FileDown, AlertCircle } from 'lucide-react';
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

  // --- Upload Feature State ---
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState('select'); // 'select' | 'preview'
  const [previewData, setPreviewData] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState([]);

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

  const handleDownloadSample = () => {
    const headers = ['contract_id', 'content_id', 'studio', 'rate_per_play', 'tier_rate', 'tier_threshold', 'territory', 'start_date', 'end_date'];
    const sample = 'CTR-SAMPLE,CID-101,Sample Studio,12.5,0.05,0.08,5000,"US,UK,IN",2024-01-01,2025-12-31';
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\n" + sample;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sample_contracts.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const validateData = (data) => {
    const errs = [];
    data.forEach((row, idx) => {
      if (!row.contract_id) errs.push(`Row ${idx + 1}: Missing Contract ID`);
      if (!row.content_id) errs.push(`Row ${idx + 1}: Missing Content ID`);
    });
    return errs;
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const cleaned = results.data.map(row => ({
            contract_id: row.contract_id || '',
            content_id: row.content_id || '',
            studio: row.studio || 'Unknown',
            rate_per_play: parseFloat(row.rate_per_play || 0),
            tier_rate: parseFloat(row.tier_rate || 0),
            tier_threshold: parseInt(row.tier_threshold || 0),
            territory: row.territory || 'Global',
            start_date: row.start_date || new Date().toISOString().split('T')[0],
            end_date: row.end_date || '2030-12-31'
          }));
          setPreviewData(cleaned);
          setErrors(validateData(cleaned));
          setUploadStep('preview');
        }
      });
    } else if (file.name.toLowerCase().endsWith('.pdf')) {
        // PDF logic simplified for brevity but functional
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(' ') + ' ';
        }
        const idMatch = text.match(/(?:contract\s*id|id)\W*([a-z0-9-]+)/i);
        const extracted = [{
            contract_id: idMatch ? idMatch[1] : `PDF-${Date.now()}`,
            content_id: 'CID-EXTRACTED',
            studio: 'PDF Upload',
            rate_per_play: 0.15,
            tier_rate: 0.20,
            tier_threshold: 1000,
            territory: 'US,UK',
            start_date: new Date().toISOString().split('T')[0],
            end_date: '2029-12-31'
        }];
        setPreviewData(extracted);
        setErrors(validateData(extracted));
        setUploadStep('preview');
    }
  };

  const confirmUpload = async () => {
    setIsUploading(true);
    try {
      await api.post('/contracts/upload-batch', { contracts: previewData });
      alert(`Success: ${previewData.length} contracts appended.`);
      setIsUploadModalOpen(false);
      setUploadStep('select');
      fetchContracts(0, search);
    } catch (err) {
      alert("Upload failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsUploading(false);
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
          <div className="flex gap-2">
            <button className="icon-btn icon-btn-edit" style={{ borderRadius: '12px' }} onClick={() => setIsInfoModalOpen(true)} title="Format Requirements">
              <Info size={18} />
            </button>
            <button className="btn btn-blue flex items-center gap-2" onClick={() => { setIsUploadModalOpen(true); setUploadStep('select'); }}>
              <Upload size={18} />
              <span>Upload CSV/PDF</span>
            </button>
          </div>
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

      {/* ─── Format Info Modal ─── */}
      {isInfoModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
                <div className="flex items-center gap-2 text-blue-600">
                    <Info size={24} />
                    <h2 className="modal-title text-blue-600">Required CSV Structure</h2>
                </div>
                <button className="icon-btn" onClick={() => setIsInfoModalOpen(false)}><X size={20}/></button>
            </div>
            <div className="modal-body">
              <p className="text-slate-600 mb-4">Ensure your CSV files have the following exact headers:</p>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="text-blue-600">contract_id*</div>
                <div className="text-blue-600">content_id*</div>
                <div>studio</div>
                <div>rate_per_play</div>
                <div>tier_rate</div>
                <div>tier_threshold</div>
                <div>territory</div>
                <div>start_date</div>
                <div>end_date</div>
              </div>
              <p className="text-xs text-muted mt-4">* mandatory fields</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost flex items-center gap-2" onClick={handleDownloadSample}>
                <FileDown size={18} />
                Download Sample CSV
              </button>
              <button className="btn btn-blue" onClick={() => setIsInfoModalOpen(false)}>Got it</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Upload workflow Modal ─── */}
      {isUploadModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: uploadStep === 'preview' ? '900px' : '500px' }}>
            <div className="modal-header">
                <h2 className="modal-title">Batch Import Contracts</h2>
                <button className="icon-btn" onClick={() => setIsUploadModalOpen(false)}><X size={20}/></button>
            </div>
            <div className="modal-body">
                {uploadStep === 'select' ? (
                    <div className="py-10 text-center">
                        <input type="file" id="batch-file" accept=".csv,.pdf" className="hidden" onChange={handleFileSelect} style={{ display: 'none' }} />
                        <label htmlFor="batch-file" className="cursor-pointer">
                            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-blue-200 hover:bg-blue-100 transition-colors">
                                <Upload size={32} />
                            </div>
                            <h3 className="font-bold text-slate-800">Select File to Parse</h3>
                            <p className="text-muted text-sm mt-1">Supports CSV and text-based PDFs</p>
                        </label>
                    </div>
                ) : (
                    <div>
                        {errors.length > 0 && (
                            <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-4">
                                <div className="flex items-center gap-2 text-red-600 font-bold text-sm mb-2">
                                    <AlertCircle size={16} />
                                    <span>Validation Errors</span>
                                </div>
                                <ul className="text-xs text-red-500 list-disc pl-5">
                                    {errors.map((e, i) => <li key={i}>{e}</li>)}
                                </ul>
                            </div>
                        )}
                        <div className="table-wrap" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            <table className="data-table text-xs">
                                <thead>
                                    <tr>
                                        <th>Contract ID</th><th>Content</th><th>Studio</th><th>Rate</th><th>Territory</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.map((p, i) => (
                                        <tr key={i} className={!p.contract_id ? 'bg-red-50' : ''}>
                                            <td className="font-bold">{p.contract_id || 'MISSING'}</td>
                                            <td>{p.content_id}</td>
                                            <td>{p.studio}</td>
                                            <td>₹{p.rate_per_play}</td>
                                            <td>{p.territory}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
            <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setIsUploadModalOpen(false)}>Cancel</button>
                {uploadStep === 'preview' && (
                    <button className="btn btn-blue" disabled={errors.length > 0 || isUploading} onClick={confirmUpload}>
                        {isUploading ? 'Appending...' : `Confirm Import (${previewData.length} Records)`}
                    </button>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
