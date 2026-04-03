import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, Square, RotateCcw, Activity, 
  CheckCircle2, Terminal, Cpu, Database, 
  FileSearch, CreditCard, AlertTriangle, Send, 
  Search, Calendar, Server, Shield, Clock,
  Wind, Target, ShieldCheck, Info, ChevronDown, Check, X
} from 'lucide-react';
import api from '../api';

// Component Shims for legacy/missing icons
function BarChart3({ size }) { return <Activity size={size}/>; }
function Fingerprint({ size }) { return <Shield size={size}/>; }

const AGENTS = [
  { id: 'PlannerAgent', icon: <Cpu size={14}/>, desc: 'Coordinating Audit Pipeline' },
  { id: 'ContractReaderAgent', icon: <FileSearch size={14}/>, desc: 'Parsing Royalties & Tiers' },
  { id: 'UsageAgent', icon: <Database size={14}/>, desc: 'Aggregating Play Metadata' },
  { id: 'LedgerAgent', icon: <CreditCard size={14}/>, desc: 'Validating Global Payments' },
  { id: 'RoyaltyAgent', icon: <BarChart3 size={14}/>, desc: 'Calculating Leakage Delta' },
  { id: 'AuditAgent', icon: <Fingerprint size={14}/>, desc: 'Final Integrity Check' },
  { id: 'ViolationAgent', icon: <AlertTriangle size={14}/>, desc: 'Flagging Rogue Stream IDs' },
  { id: 'ReporterAgent', icon: <Send size={14}/>, desc: 'Syncing Financial Summary' }
];

export default function AgentTrace() {
  const [contracts, setContracts] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [playback, setPlayback] = useState('idle');
  const [currentAgentIdx, setCurrentAgentIdx] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [agentLogs, setAgentLogs] = useState({});
  const [agentStatus, setAgentStatus] = useState({});
  const [summary, setSummary] = useState(null);
  const [activeTab, setActiveTab] = useState('audit');
  const [focusedAgentId, setFocusedAgentId] = useState(null);
  const [telemetry, setTelemetry] = useState([]);
  
  // Custom Selector State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const playbackRef = useRef('idle');
  useEffect(() => { playbackRef.current = playback; }, [playback]);

  const consoleEndRef = useRef(null);
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [telemetry, agentLogs]);

  useEffect(() => {
    api.get('/contracts').then(res => {
      const data = res.data.data || res.data || [];
      setContracts(Array.isArray(data) ? data : []);
    }).catch(console.error);
  }, []);

  const resetAudit = () => {
    setPlayback('idle');
    setCurrentAgentIdx(-1);
    setProgress(0);
    setAgentLogs({});
    setAgentStatus({});
    setSummary(null);
    setTelemetry([]);
    setFocusedAgentId(null);
  };

  const runAudit = async (ids = selectedIds) => {
    if (playback === 'paused') {
      setPlayback('running');
      return;
    }

    resetAudit();
    setPlayback('running');
    
    for (let i = 0; i < AGENTS.length; i++) {
      if (playbackRef.current === 'stopped') break;
      while (playbackRef.current === 'paused') {
        await new Promise(r => setTimeout(r, 200));
        if (playbackRef.current === 'stopped') return;
      }

      const agent = AGENTS[i];
      setCurrentAgentIdx(i);
      setFocusedAgentId(agent.id);
      setAgentStatus(prev => ({ ...prev, [agent.id]: 'running' }));
      setProgress(Math.round(((i + 1) / AGENTS.length) * 100));

      try {
        await new Promise(r => setTimeout(r, 1000)); 
        const res = await api.post('/audit/run-step', { 
            agent_name: agent.id, 
            filters: { contract_id: ids } 
        });

        const logs = res.data.trace || res.data.agent_trace || [];
        setAgentLogs(prev => ({ ...prev, [agent.id]: logs }));
        setAgentStatus(prev => ({ ...prev, [agent.id]: 'done' }));
        setTelemetry(prev => [...prev, ...logs.map(l => ({ ...l, agent: agent.id }))]);

        if (agent.id === 'ReporterAgent' && res.data.summary) {
          setSummary(res.data.summary);
        }
      } catch (err) {
        setAgentStatus(prev => ({ ...prev, [agent.id]: 'error' }));
        setAgentLogs(prev => ({ ...prev, [agent.id]: [{ agent: agent.id, detail: 'Step failed' }] }));
        break;
      }
    }

    setPlayback('idle');
    setProgress(100);
    setCurrentAgentIdx(-1);
  };

  const toggleContract = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    setSelectedIds(contracts.map(c => c.contract_id));
  };

  const stopAudit = () => setPlayback('stopped');
  const pauseAudit = () => setPlayback('paused');

  const getLogsForTab = () => {
    return activeTab === 'trace' && focusedAgentId ? (agentLogs[focusedAgentId] || []) : telemetry;
  };

  const getLogLvl = (msg) => {
    if (!msg || typeof msg !== 'string') return 'lvl-info';
    const low = msg.toLowerCase();
    if (low.includes('error') || low.includes('fail')) return 'lvl-error';
    if (low.includes('warn') || low.includes('risk')) return 'lvl-warn';
    if (low.includes('success') || low.includes('done') || low.includes('complete')) return 'lvl-success';
    return 'lvl-info';
  };

  const currentViewAgent = focusedAgentId ? AGENTS.find(a => a.id === focusedAgentId) : (currentAgentIdx >= 0 ? AGENTS[currentAgentIdx] : null);

  const filteredContracts = contracts.filter(c => 
    (c.content_id || '').toLowerCase().includes((searchQuery || '').toLowerCase()) || 
    (c.studio || '').toLowerCase().includes((searchQuery || '').toLowerCase())
  );

  return (
    <div className="trace-pro-shell" onClick={() => isMenuOpen && setIsMenuOpen(false)}>
      
      {/* Consolidated Control Bar */}
      <header className="trace-header flex justify-between">
        <div className="trace-header-left">
          <div className="flex items-center gap-2 pr-4 border-r border-white/10 h-6">
             <Activity size={16} className="text-blue-500"/>
             <span className="text-[10px] font-black uppercase tracking-widest text-[#FFFFFF]">Studio Pro</span>
          </div>
          
          <div className="trace-multi-wrap" onClick={e => e.stopPropagation()}>
            <div 
              className={`trace-multi-trigger ${isMenuOpen ? 'open' : ''}`}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
               <div className="flex items-center gap-2">
                  <Database size={12} className="text-blue-400"/>
                  <span className="text-[10px] font-black text-white uppercase tracking-tighter">
                    {selectedIds.length === 0 ? 'Select Contract Flows...' : 
                     selectedIds.length === 1 ? contracts.find(c => c.contract_id === selectedIds[0])?.content_id :
                     `${selectedIds.length} Contracts Selected`}
                  </span>
               </div>
               <ChevronDown size={14} className={`text-white/20 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}/>
            </div>

            {isMenuOpen && (
              <div className="trace-multi-menu high-contrast">
                 <div className="trace-multi-search-wrap">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"/>
                    <input 
                      type="text" 
                      className="trace-multi-search" 
                      placeholder="Search contracts..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      autoFocus
                    />
                 </div>
                 <div className="flex items-center justify-between px-2 mb-1">
                    <button className="text-[9px] font-black text-blue-400 uppercase hover:text-blue-300" onClick={selectAll}>Select All</button>
                    <button className="text-[9px] font-black text-white/20 uppercase hover:text-white/40" onClick={() => setSelectedIds([])}>Clear</button>
                 </div>
                 <div className="trace-multi-list custom-scrollbar">
                    {filteredContracts.map(c => {
                      const isSelected = selectedIds.includes(c.contract_id);
                      return (
                        <div 
                          key={c.contract_id} 
                          className={`trace-multi-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => toggleContract(c.contract_id)}
                        >
                           <div className="trace-multi-checkbox">
                              {isSelected && <Check size={10} className="text-white"/>}
                           </div>
                           <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-white">{c.content_id}</span>
                              <span className="text-[8px] text-white/40 uppercase tracking-tighter">{c.studio} • {c.contract_id}</span>
                           </div>
                        </div>
                      );
                    })}
                 </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
             {playback === 'running' ? (
               <button className="btn btn-stop h-8 px-4 text-[10px] font-black uppercase tracking-tight flex items-center gap-2 rounded-md" onClick={pauseAudit}>
                  <Pause size={12} fill="currentColor"/> STOP
               </button>
             ) : (
               <button 
                 className="btn btn-run h-8 px-5 text-[10px] font-black uppercase tracking-tight flex items-center gap-2 rounded-md shadow-xl" 
                 onClick={() => runAudit()}
                 disabled={selectedIds.length === 0}
               >
                  <Play size={12} fill="currentColor"/> RUN TRACE
               </button>
             )}
             <button className="btn btn-reset h-8 px-3 text-[10px] font-black uppercase tracking-tight flex items-center gap-2 rounded-md" onClick={resetAudit}>
               <RotateCcw size={12}/> RESET
             </button>
          </div>

          <div className="ml-2 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[#AAB4C5] opacity-20">
             <span>Config</span>
             <Info size={10} className="rotate-180"/>
             <span>Exec</span>
             <Info size={10} className="rotate-180"/>
             <span>Inspect</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
            {summary && (
               <div className="flex items-center gap-2 px-3 py-1 bg-green-500/5 border border-green-500/20 rounded-md">
                  <ShieldCheck size={12} className="text-green-500/50"/>
                  <span className="text-[10px] font-black text-green-500 uppercase tracking-tighter">₹{(summary.total_leakage || 0).toLocaleString()}</span>
               </div>
            )}
           <div className="flex items-center gap-3">
              <span className="text-[9px] font-black text-[#AAB4C5] tabular-nums">{progress}%</span>
              <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                 <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
           </div>
        </div>
      </header>

      {/* Internal Split View */}
      <div className="trace-split-view">
        
        {/* Top Pane: Stepper + Detail */}
        <section className="trace-top-pane custom-scrollbar">
          <div className="trace-stepper-area">
            <div className="trace-pill-strip">
              {AGENTS.map((agent, idx) => {
                const status = agentStatus[agent.id] || 'waiting';
                const isFocused = focusedAgentId === agent.id;
                const isDone = status === 'done';
                const isRunning = status === 'running';

                return (
                  <div 
                    key={agent.id} 
                    onClick={() => setFocusedAgentId(agent.id)}
                    className={`trace-pill-node ${isFocused ? 'active' : ''} ${isRunning ? 'running' : ''} ${isDone ? 'done' : ''}`}
                  >
                    <div className="opacity-60">{isDone ? <CheckCircle2 size={14}/> : agent.icon}</div>
                    <span className="text-[10px] font-black uppercase tracking-tight">{agent.id}</span>
                  </div>
                );
              })}
            </div>
            <div className="trace-progress-line-container">
               <div className="trace-progress-line-fill" style={{ width: `${progress}%` }}></div>
            </div>
          </div>

          <div className="trace-detail-area stable-grid">
            <div className="trace-grid-host">
              {AGENTS.map((agent) => (
                <div key={agent.id} className="agent-box animate-in">
                   <div className="agent-box-header">
                      <div className="flex items-center gap-2">
                        {agent.icon}
                        <span className="text-[9px] font-black uppercase text-white tracking-widest">{agent.id}</span>
                      </div>
                      {agentStatus[agent.id] === 'running' && (
                        <div className="sig-running flex items-center gap-1">
                           <Activity size={8} className="animate-pulse"/>
                           <span className="text-[8px] font-bold">SIGNAL...</span>
                        </div>
                      )}
                   </div>
                   <div className="agent-box-output monospace-scroll custom-scrollbar">
                      {agentLogs[agent.id] ? (
                        agentLogs[agent.id].map((log, i) => (
                          <div key={i} className="flex gap-2 text-[9px] leading-tight mb-1">
                            <span className="text-blue-500 font-bold opacity-40">{'>'}</span>
                            <span className={getLogLvl(log.message || log.detail)}>{log.message || log.detail}</span>
                          </div>
                        ))
                      ) : (
                        <div className="h-full flex items-center justify-center opacity-10">
                           <Terminal size={12}/>
                        </div>
                      )}
                   </div>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* Bottom Pane: Terminal Diagnostics */}
        <section className="trace-bottom-pane custom-scrollbar">
          <div className="trace-console-wrap">
            <div className="trace-console-header">
               <div className="flex items-center gap-2 mr-4">
                  <Terminal size={12} className="text-blue-500/50"/>
                  <span className="text-[8px] font-black text-[#AAB4C5] uppercase tracking-[0.2em]">Live Stream</span>
               </div>
               <div className={`trace-tab ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>GLOBAL</div>
               <div className={`trace-tab ${activeTab === 'trace' ? 'active' : ''}`} onClick={() => setActiveTab('trace')}>AGENT</div>
            </div>
            <div className="flex-1 py-3">
               {getLogsForTab().length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[9px] font-black text-white/5 uppercase tracking-[0.4em]">Empty Signal</div>
               ) : (
                  getLogsForTab().map((log, i) => (
                    <div key={i} className="trace-log-item">
                       <span className="log-ts">[{new Date(log.timestamp || Date.now()).toLocaleTimeString([], { hour12: false })}]</span>
                       <span className="log-agent">[{log.agent || 'SYS'}]</span>
                       <span className={`log-msg ${getLogLvl(log.message || log.detail)}`}>{log.message || log.detail}</span>
                    </div>
                  ))
               )}
               <div ref={consoleEndRef} />
            </div>
          </div>
        </section>
      </div>

    </div>
  );
}
