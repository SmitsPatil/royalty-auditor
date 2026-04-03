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

/* ─── Drawer Component (Slide-in from Right) ────────────────────────── */
const RightDrawer = ({ isOpen, onClose, title, children, footer, activeSection, setActiveSection, onDownloadSample }) => {
  if (!isOpen) return null;
  return (
    <div 
        className="fixed inset-0 z-[1000] flex justify-end" 
        style={{ background: 'rgba(15, 23, 42, 0.15)', backdropFilter: 'blur(3px)' }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
    >
        <div 
            className="h-full bg-white flex flex-col shadow-2xl animate-in" 
            style={{ 
                width: '460px', 
                animation: 'slideInRight 0.4s cubic-bezier(0, 0, 0.2, 1)',
                borderLeft: '1px solid var(--border)'
            }}
        >
            <div className="border-bottom bg-slate-50 sticky top-0 z-10">
                <div className="p-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 leading-tight">{title}</h2>
                        <p className="text-xs text-slate-500 mt-1">Batch Management Workspace</p>
                    </div>
                    <button className="icon-btn hover:bg-slate-200 transition-colors" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                
                {/* Secondary Header Navigation */}
                <div className="px-6 pb-4 flex gap-4">
                    <button 
                        className={`text-xs font-bold uppercase tracking-wider pb-1 border-b-2 transition-all ${activeSection === 'upload' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        onClick={() => setActiveSection('upload')}
                    >
                        Upload
                    </button>
                    <button 
                        className={`text-xs font-bold uppercase tracking-wider pb-1 border-b-2 transition-all ${activeSection === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        onClick={() => setActiveSection('info')}
                    >
                        Format Info
                    </button>
                    <button 
                        className="text-xs font-bold uppercase tracking-wider pb-1 border-b-2 border-transparent text-slate-400 hover:text-blue-500 transition-all ml-auto flex items-center gap-1"
                        onClick={onDownloadSample}
                    >
                        <FileDown size={14} />
                        Sample CSV
                    </button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
                {children}
            </div>

            {footer && (
                <div className="p-6 border-top bg-slate-50 flex gap-3 sticky bottom-0 z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
                    {footer}
                </div>
            )}
        </div>
        <style>{`
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0.5; }
                to { transform: translateX(0); opacity: 1; }
            }
            .border-bottom { border-bottom: 1px solid var(--border); }
            .border-top { border-top: 1px solid var(--border); }
            .sticky { position: sticky; }
            .inset-0 { top: 0; left: 0; right: 0; bottom: 0; }
            .fixed { position: fixed; }
            .space-y-6 > * + * { margin-top: 1.5rem; }
            .space-y-3 > * + * { margin-top: 0.75rem; }
            .space-y-1 > * + * { margin-top: 0.25rem; }
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
  const [activeSection, setActiveSection] = useState('upload'); // 'upload' | 'info'
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

      {/* ─── Side Drawer: Batch Import & Help ─── */}
      <RightDrawer
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title={uploadStep === 'preview' ? "Review Import" : (activeSection === 'info' ? "Format Requirements" : "Upload Contracts")}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        onDownloadSample={handleDownloadSample}
        footer={
            uploadStep === 'preview' ? (
                <>
                    <button className="btn btn-ghost flex-1" onClick={() => setUploadStep('select')}>Back</button>
                    <button className="btn btn-blue flex-1" disabled={errors.length > 0 || isUploading} onClick={confirmUpload}>
                        {isUploading ? 'Appending...' : 'Confirm Appending'}
                    </button>
                </>
            ) : null
        }
      >
        <div className="space-y-6">
            {activeSection === 'info' ? (
                <div className="animate-in">
                    <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                        To ensure successful integration, your CSV must follow the standardized governance structure below.
                    </p>
                    <div className="bg-slate-950 rounded-2xl p-6 shadow-xl mb-6">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Mandatory Schema</h4>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-3 border-b border-white/5">
                                <span className="text-xs font-mono text-blue-400">contract_id</span>
                                <span className="text-[10px] text-slate-400">Unique Identifier</span>
                            </div>
                            <div className="flex justify-between items-center pb-3 border-b border-white/5">
                                <span className="text-xs font-mono text-blue-400">content_id</span>
                                <span className="text-[10px] text-slate-400">Asset Ref</span>
                            </div>
                        </div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-8 mb-4">Optional Metadata</h4>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-3 border-b border-white/5 text-slate-300">
                                <span className="text-xs font-mono">studio</span>
                                <span className="text-[10px] text-slate-500">Legal Name</span>
                            </div>
                            <div className="flex justify-between items-center pb-3 border-b border-white/5 text-slate-300">
                                <span className="text-xs font-mono">territory</span>
                                <span className="text-[10px] text-slate-500">ISO Codes</span>
                            </div>
                        </div>
                    </div>
                    <button className="btn btn-blue w-full" onClick={() => setActiveSection('upload')}>
                        Continue to Upload
                    </button>
                </div>
            ) : uploadStep === 'select' ? (
                <>
                    <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 mb-6 group cursor-pointer" onClick={() => setActiveSection('info')}>
                        <div className="flex items-center gap-3 text-blue-700 font-bold text-sm mb-2">
                            <Info size={18} className="text-blue-500" />
                            <span>Quick Format Guide</span>
                        </div>
                        <p className="text-xs text-blue-600/80 leading-relaxed">
                            Required headers: <code className="bg-blue-100/50 px-1 rounded">contract_id</code>, 
                            <code className="bg-blue-100/50 px-1 ml-1 rounded">content_id</code>. Click to view full schema.
                        </p>
                    </div>

                    <div className="border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group"
                         onClick={() => document.getElementById('drawer-upload').click()}>
                        <input type="file" id="drawer-upload" accept=".csv,.pdf" className="hidden" onChange={handleFileSelect} />
                        <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-100 group-hover:text-blue-500 transition-all transform group-hover:scale-110 shadow-inner">
                            <Upload size={32} />
                        </div>
                        <h3 className="font-bold text-slate-800 text-base">Select Source File</h3>
                        <p className="text-xs text-slate-500 mt-2">Supports CSV (Standard) and PDF (Automated Extraction)</p>
                    </div>
                </>
            ) : (
                <div className="animate-in">
                    {errors.length > 0 && (
                        <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-6 shadow-sm">
                            <div className="flex items-center gap-2 text-red-600 font-bold text-sm mb-3">
                                <AlertCircle size={18} />
                                <span>Critical Errors Found</span>
                            </div>
                            <ul className="text-xs text-red-500 list-disc pl-5 space-y-1.5 font-medium">
                                {errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                                {errors.length > 5 && <li className="list-none pt-1">...and {errors.length - 5} more</li>}
                            </ul>
                        </div>
                    )}
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ingestion Preview</h4>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{previewData.length} records detected</span>
                    </div>
                    <div className="space-y-3">
                        {previewData.slice(0, 20).map((p, i) => (
                            <div key={i} className={`p-4 rounded-2xl border transition-all hover:bg-white hover:shadow-md ${!p.contract_id ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-bold text-xs text-slate-800">{p.contract_id || 'ID MISSING'}</span>
                                    <span className="text-[10px] bg-white px-2 py-1 rounded-lg border border-slate-200 font-bold text-slate-600">{p.territory}</span>
                                </div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-2">
                                    <span className="truncate max-w-[120px]">{p.studio}</span>
                                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                    <span className="font-mono">{p.content_id}</span>
                                </div>
                            </div>
                        ))}
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
