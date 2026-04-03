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

/* ─── Fixed Modal Ingestion Card (Vanilla CSS - No Tailwind Dependency) ─ */
const CenteredIngestionCard = ({ isOpen, onClose, title, children, footer }) => {
  if (!isOpen) return null;
  return (
    <>
      {/* Fixed Overlay */}
      <div 
        style={{
          position: 'fixed', inset: 0, 
          zIndex: 9998, background: 'rgba(0,0,0,0.6)', 
          backdropFilter: 'blur(4px)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          animation: 'modalFadeIn 0.3s ease-out forwards'
        }}
        onClick={onClose}
      >
        {/* Card Container */}
        <div 
            style={{ 
                width: '420px', background: '#0f172a', color: 'white',
                padding: '24px', borderRadius: '16px', 
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', flexDirection: 'column', gap: '20px',
                pointerEvents: 'auto', animation: 'cardPopUp 0.35s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards'
            }}
            onClick={e => e.stopPropagation()}
        >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'white', margin: 0 }}>{title}</h2>
                    <p style={{ fontSize: '10px', color: '#60a5fa', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px' }}>Secure Ingestion Pipeline</p>
                </div>
                <button 
                    style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                    onClick={onClose}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                    <X size={18} />
                </button>
            </div>
            
            {/* Body */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, overflowY: 'auto', maxHeight: '70vh', paddingRight: '4px' }} className="custom-scrollbar-dark">
                {children}
            </div>

            {/* Footer */}
            {footer && (
                <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                    {footer}
                </div>
            )}
        </div>
      </div>

      <style>{`
          @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes cardPopUp { 
              from { opacity: 0; transform: translateY(20px) scale(0.95); } 
              to { opacity: 1; transform: translateY(0) scale(1); } 
          }
          .custom-scrollbar-dark::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar-dark::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
          .custom-scrollbar-dark::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </>
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

      <CenteredIngestionCard
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title={uploadStep === 'preview' ? "Verification Pipeline" : "Import Workspace"}
        footer={
            uploadStep === 'preview' ? (
                <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                    <button 
                        style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '8px', color: '#94a3b8', fontSize: '11px', fontWeight: '700', cursor: 'pointer', textTransform: 'uppercase' }}
                        onClick={() => { setUploadStep('select'); setPreviewData([]); }}
                    >
                        Reset
                    </button>
                    <button 
                        style={{ flex: 1.5, padding: '10px', background: '#3b82f6', border: 'none', borderRadius: '8px', color: 'white', fontSize: '11px', fontWeight: '700', cursor: 'pointer', textTransform: 'uppercase', opacity: (errors.length > 0 || isUploading) ? 0.5 : 1 }}
                        disabled={errors.length > 0 || isUploading}
                        onClick={confirmUpload}
                    >
                        {isUploading ? 'Ingesting...' : 'Confirm Ingest'}
                    </button>
                </div>
            ) : (
                <button 
                    style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#cbd5e1', fontSize: '11px', fontWeight: '700', cursor: 'pointer', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    onClick={handleDownloadSample}
                >
                    <FileDown size={14} />
                    Download Schema Template
                </button>
            )
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Gateway Section */}
            {uploadStep !== 'preview' && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: '800', color: 'white', marginBottom: '12px' }}>01. Inbound Gateway</h4>
                    <div 
                        style={{ border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '12px', padding: '32px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', background: 'rgba(59, 130, 246, 0.02)' }}
                        onClick={() => document.getElementById('final-upload-input').click()}
                        onMouseOver={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)'; }}
                        onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.background = 'rgba(59, 130, 246, 0.02)'; }}
                    >
                        <Upload size={24} style={{ color: '#60a5fa', marginBottom: '12px' }} />
                        <p style={{ fontSize: '13px', fontWeight: '700', color: 'white', margin: 0 }}>Drop data files here</p>
                        <p style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>UTF-8 CSV or Professional PDF</p>
                    </div>
                </div>
            )}

            {/* Disk Section */}
            {uploadStep !== 'preview' && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>02. Local File Explorer</label>
                    <input type="file" id="final-upload-input" accept=".csv,.pdf" style={{ display: 'none' }} onChange={handleFileSelect} />
                    <button 
                        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', padding: '12px', borderRadius: '10px', color: 'white', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                        onClick={() => document.getElementById('final-upload-input').click()}
                    >
                        Browse Records
                    </button>
                </div>
            )}

            {/* Format Guide Section */}
            {uploadStep !== 'preview' && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>03. Schema Governance</label>
                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                                <code style={{ color: '#3b82f6', fontSize: '12px', fontWeight: '700' }}>contract_id*</code>
                                <span style={{ color: '#475569', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase' }}>Primary ID</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                                <code style={{ color: '#3b82f6', fontSize: '12px', fontWeight: '700' }}>content_id*</code>
                                <span style={{ color: '#475569', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase' }}>Asset Mapping</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <code style={{ color: '#64748b', fontSize: '12px' }}>studio</code>
                                <span style={{ color: '#475569', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase' }}>Optional</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview View */}
            {uploadStep === 'preview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {errors.length > 0 && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', padding: '16px' }}>
                            <div style={{ display: 'flex', itemsCenter: 'center', gap: '8px', color: '#ef4444', fontSize: '12px', fontWeight: '800', marginBottom: '8px' }}>
                                <AlertCircle size={16} />
                                <span>VALIDATION FAILURES</span>
                            </div>
                            <ul style={{ paddingLeft: '16px', color: '#fca5a5', fontSize: '11px', gap: '4px', display: 'flex', flexDirection: 'column' }}>
                                {errors.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
                            </ul>
                        </div>
                    )}
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ fontSize: '15px', fontWeight: '800', color: 'white' }}>Lineage Trace</h4>
                        <span style={{ fontSize: '10px', background: '#1e3a8a', color: '#bfdbfe', padding: '3px 8px', borderRadius: '4px', fontWeight: '700' }}>{previewData.length} records detected</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }} className="custom-scrollbar-dark">
                        {previewData.map((p, i) => (
                            <div key={i} style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: p.contract_id ? 'white' : '#ef4444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.contract_id || 'MISSING_UID'}</span>
                                    <span style={{ fontSize: '10px', color: '#64748b' }}>{p.content_id}</span>
                                </div>
                                <div style={{ fontSize: '9px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>{p.territory}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </CenteredIngestionCard>

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
