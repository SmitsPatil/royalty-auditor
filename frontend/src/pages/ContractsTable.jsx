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

/* ─── Drawer Component (No Overlay, Fixed Right) ──────────────────── */
const RightDrawer = ({ isOpen, onClose, title, children, footer }) => {
  if (!isOpen) return null;
  return (
    <div 
        className="fixed z-[1000] flex justify-end overflow-visible" 
        style={{ right: 0, top: 0, bottom: 0, pointerEvents: 'none' }}
    >
        <div 
            className="h-full bg-white flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.06)]" 
            style={{ 
                width: '400px', 
                pointerEvents: 'auto',
                borderLeft: '1px solid var(--border)',
                animation: 'drawerSlideIn 0.4s cubic-bezier(0, 0, 0.2, 1) forwards'
            }}
        >
            <div className="p-6 border-b bg-white flex items-center justify-between sticky top-0 z-10">
                <div>
                    <h2 className="text-lg font-bold text-slate-900 leading-tight">{title}</h2>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1 font-semibold">Contract Import Hub</p>
                </div>
                <button className="icon-btn hover:bg-slate-100 transition-colors" onClick={onClose}>
                    <X size={20} />
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {children}
            </div>

            {footer && (
                <div className="p-6 border-t bg-slate-50 flex gap-3 sticky bottom-0 z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
                    {footer}
                </div>
            )}
        </div>
        <style>{`
            @keyframes drawerSlideIn {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
            }
            .custom-scrollbar::-webkit-scrollbar { width: 6px; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
            .border-b { border-bottom: 1px solid var(--border); }
            .border-t { border-top: 1px solid var(--border); }
            .sticky { position: sticky; }
            .fixed { position: fixed; }
            .space-y-6 > * + * { margin-top: 1.5rem; }
            .space-y-3 > * + * { margin-top: 0.75rem; }
        `}</style>
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
    <div className="animate-in delay-1 overflow-visible">
      {/* ─── Page Header ─── */}
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
            style={{ width: '300px' }}
          />
          <button 
            className="btn btn-blue flex items-center gap-2" 
            onClick={() => { setIsUploadModalOpen(true); setUploadStep('select'); }}
            style={{ padding: '0.6rem 1.25rem' }}
          >
            <Upload size={18} />
            <span>Manage Imports</span>
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
                <td className="font-bold whitespace-nowrap">{c.contract_id}</td>
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
                        <button className="icon-btn icon-btn-edit" onClick={() => startEdit(c)} title="Edit Contract"><Edit size={16}/></button>
                        <button className="icon-btn icon-btn-delete" onClick={() => handleDeleteClick(c.contract_id)} title="Remove Contract"><Trash2 size={16}/></button>
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
          <button className="btn btn-outline" onClick={loadMore}>Load More Contracts</button>
        </div>
      )}

      {/* ─── Side Drawer: Batch Import Workspace ─── */}
      <RightDrawer
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title={uploadStep === 'preview' ? "Verify Ingestion" : "Import Workspace"}
        footer={
            uploadStep === 'preview' ? (
                <>
                    <button className="btn btn-ghost flex-1" onClick={() => { setUploadStep('select'); setPreviewData([]); }}>Reset</button>
                    <button className="btn btn-blue flex-1" disabled={errors.length > 0 || isUploading} onClick={confirmUpload}>
                        {isUploading ? 'Appending...' : 'Start Append'}
                    </button>
                </>
            ) : (
                <button className="btn btn-ghost w-full" onClick={handleDownloadSample}>
                    <FileDown size={18} className="mr-2" />
                    Download Sample.csv
                </button>
            )
        }
      >
        <div className="space-y-8 pb-10">
            {/* Section 1: Format Guide (Always visible unless in preview) */}
            {uploadStep !== 'preview' && (
                <div className="animate-in">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">1. Format Guide</h4>
                    <div className="bg-slate-900 rounded-2xl p-5 shadow-lg border border-slate-800">
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs">
                                <code className="text-blue-400">contract_id*</code>
                                <span className="text-slate-500 text-[10px]">Primary Key</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <code className="text-blue-400">content_id*</code>
                                <span className="text-slate-500 text-[10px]">Asset Ref</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Section 2: Upload Zone */}
            {uploadStep !== 'preview' && (
                <div className="animate-in delay-1">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">2. Upload Source</h4>
                    <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group"
                         onClick={() => document.getElementById('drawer-upload').click()}>
                        <input type="file" id="drawer-upload" accept=".csv,.pdf" className="hidden" onChange={handleFileSelect} />
                        <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-100 group-hover:text-blue-500 transition-all">
                            <Upload size={24} />
                        </div>
                        <p className="text-xs font-bold text-slate-700">Select CSV or PDF</p>
                        <p className="text-[10px] text-slate-400 mt-1">Files are parsed locally for privacy</p>
                    </div>
                </div>
            )}

            {/* Section 3: Preview (Only visible when data exists) */}
            {uploadStep === 'preview' && (
                <div className="animate-in">
                    {errors.length > 0 && (
                        <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-6 font-medium">
                            <div className="flex items-center gap-2 text-red-600 text-xs mb-2">
                                <AlertCircle size={16} />
                                <span>Validation Conflict ({errors.length})</span>
                            </div>
                            <ul className="text-[10px] text-red-500 list-disc pl-5 space-y-1">
                                {errors.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
                            </ul>
                        </div>
                    )}

                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">3. Preview Ingestion</h4>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{previewData.length} records</span>
                    </div>

                    <div className="space-y-2">
                        {previewData.slice(0, 50).map((p, i) => (
                            <div key={i} className={`p-3 rounded-xl border flex items-center justify-between transition-colors hover:bg-white ${!p.contract_id ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50'}`}>
                                <div>
                                    <div className="text-[10px] font-bold text-slate-800">{p.contract_id || 'ERROR: NO ID'}</div>
                                    <div className="text-[9px] text-slate-400">{p.studio} • {p.content_id}</div>
                                </div>
                                <span className="text-[9px] font-bold text-slate-400 px-2 py-1 bg-white rounded-lg border border-slate-100">{p.territory}</span>
                            </div>
                        ))}
                        {previewData.length > 50 && (
                            <p className="text-center text-[10px] text-slate-400 py-4">and {previewData.length - 50} more records...</p>
                        )}
                    </div>
                </div>
            )}
        </div>
      </RightDrawer>

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
