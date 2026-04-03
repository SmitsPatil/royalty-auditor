import { useState } from 'react';
import { Bot, Send, FileText, Zap, Database, Lock, Link as LinkIcon, CreditCard } from 'lucide-react';
import api from '../api';

function NLQChat() {
  const [query, setQuery]     = useState('');
  const [answer, setAnswer]   = useState('');
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setAnswer('');
    try {
      const res = await api.post('/analytics/query', { query });
      setAnswer(res.data.answer || "I parsed the audit trail but couldn't find a specific anomaly for that query.");
    } catch (err) {
      setAnswer("The Audit Agent is currently offline or the dataset is still indexing. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card mb-6 bg-gradient-to-br from-white/5 to-transparent backdrop-blur border border-white/10">
      <div className="card-title">
        <span className="card-title-text text-white font-medium"><Bot size={14} className="text-blue-400" /> Audit Intelligence Agent</span>
        <span className="badge badge-blue">Live Analysis</span>
      </div>
      <p className="text-sm text-gray-400 mb-4">Ask the Auditor anything about a specific contract, studio, or financial violation.</p>
      <div className="flex gap-3">
        <input
          type="text"
          className="bg-white/10 border border-white/20 text-white rounded-md px-4 py-2 flex-1 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder='e.g. "Why was Content_442 overpaid?"'
          onKeyDown={e => e.key === 'Enter' && ask()}
        />
        <button className="btn btn-primary bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-md font-bold transition-all" onClick={ask} disabled={loading}>
          {loading ? 'Analyzing...' : 'Ask Agent'}
        </button>
      </div>
      {loading && (
        <div className="flex items-center gap-3 mt-4 text-xs font-bold text-blue-400 animate-pulse">
           <Zap size={12}/> AGENT COGNITION IN PROGRESS...
        </div>
      )}
      {answer && (
        <div className="ai-response mt-6 p-4 bg-white/5 border border-white/10 rounded-lg animate-in">
          <div className="flex items-center gap-2 mb-2">
             <Bot size={14} className="text-blue-400" />
             <span className="text-[10px] font-black uppercase tracking-widest text-[#FFFFFF]">Audit Terminal Response</span>
          </div>
          <p className="text-sm text-gray-200 leading-relaxed font-medium">{answer}</p>
        </div>
      )}
    </div>
  );
}

const INTEGRATIONS = [
  { icon: CreditCard, label: 'Stripe Connect', sub: 'Royalty payouts synced' },
  { icon: Database,   label: 'SAP ERP',        sub: 'Finance data streaming' },
  { icon: Lock,       label: 'Blockchain Ledger', sub: 'Immutable audit trail' },
];

const CAPABILITIES = [
  { icon: FileText, label: 'LLM Contract Summarizer', desc: 'Auto-extracts obligations from 500-page PDFs using GPT-4o Vision. Identifies territory clauses, tier thresholds, and rate schedules in seconds.', badge: 'Active', color: 'badge-green' },
  { icon: Zap,      label: 'Real-time Streaming Audit', desc: 'Kafka stream processing of live playback logs. Flags violations instantly with <100ms latency at 120K events/sec.', badge: 'Live', color: 'badge-blue' },
  { icon: Bot,      label: 'Agent Memory & Learning', desc: 'Agents persist audit context across sessions. Pattern-matching learns from historical leakage to proactively catch new violations.', badge: 'Beta', color: 'badge-amber' },
];

export default function FutureExtensions() {
  return (
    <div className="animate-in delay-1">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">AI Capabilities</h1>
          <p className="page-subtitle">Enterprise AI features, integrations, and future extensions</p>
        </div>
        <span className="badge badge-purple">Enterprise Tier</span>
      </div>

      <NLQChat />

      <div className="card mb-6">
        <div className="card-title"><span className="card-title-text">Core AI Modules</span></div>
        <div className="grid grid-3">
          {CAPABILITIES.map(c => (
            <div key={c.label} style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <c.icon size={16} color="var(--blue)" />
                  <span className="text-sm font-semibold">{c.label}</span>
                </div>
                <span className={`badge ${c.color}`}>{c.badge}</span>
              </div>
              <p className="text-xs text-muted" style={{ lineHeight: 1.6 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title"><span className="card-title-text">Connected Infrastructure</span></div>
        <div className="grid grid-3">
          {INTEGRATIONS.map(int => (
            <div key={int.label} className="integration-card">
              <div className="flex items-center gap-3">
                <int.icon size={16} color="var(--text-secondary)" />
                <div>
                  <div className="text-sm font-semibold">{int.label}</div>
                  <div className="text-xs text-muted">{int.sub}</div>
                </div>
              </div>
              <div className="integration-dot" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
