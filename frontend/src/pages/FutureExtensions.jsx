import { useState } from 'react';
import { Bot, Send, FileText, Zap, Database, Lock, Link as LinkIcon, CreditCard } from 'lucide-react';

function NLQChat() {
  const [query, setQuery]     = useState('');
  const [answer, setAnswer]   = useState('');
  const [loading, setLoading] = useState(false);

  const MOCK_ANSWERS = {
    default: "Based on the audit trace, the content had 42,000 plays attributed to territory DE (Germany), which is not covered under its licensing contract (territory: US, CA). As a result, the RoyaltyAgent calculated expected revenue as $0 for those plays. However, the Ledger Agent detected a payment of $1,260 was already dispatched for these plays, generating an OVERPAYMENT flag of $1,260."
  };

  const ask = () => {
    if (!query.trim()) return;
    setLoading(true);
    setAnswer('');
    setTimeout(() => {
      setAnswer(MOCK_ANSWERS.default);
      setLoading(false);
    }, 1200);
  };

  return (
    <div className="card mb-6">
      <div className="card-title">
        <span className="card-title-text"><Bot size={14} /> Natural Language Query</span>
        <span className="badge badge-blue">AI Powered</span>
      </div>
      <p className="text-sm text-muted mb-4">Ask the Audit Agent anything about a specific contract, content, or violation.</p>
      <div className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder='e.g. "Why was Movie_442 overpaid?"'
          onKeyDown={e => e.key === 'Enter' && ask()}
        />
        <button className="btn btn-primary" onClick={ask} style={{ flexShrink: 0 }}>
          {loading ? '…' : <Send size={14} />} Ask
        </button>
      </div>
      {loading && (
        <div className="flex items-center gap-2 mt-4 text-sm text-muted">
          <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Thinking…
        </div>
      )}
      {answer && (
        <div className="ai-response mt-4 animate-in">
          <div className="ai-icon"><Bot size={14} /></div>
          <p className="ai-text">{answer}</p>
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
