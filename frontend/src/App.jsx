import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Database, Activity, FileText, FileX, 
  History, CreditCard, Shield, ShieldCheck, AlertCircle, 
  Workflow, Brain, BrainCircuit, ExternalLink, BookOpen, 
  ChevronDown, ChevronUp, Menu 
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import ContractsTable from './pages/ContractsTable';
import LogsTable from './pages/LogsTable';
import PaymentsTable from './pages/PaymentsTable';
import AuditResults from './pages/AuditResults';
import Violations from './pages/Violations';
import AgentTrace from './pages/AgentTrace';
import FutureExtensions from './pages/FutureExtensions';
import RemovedContracts from './pages/RemovedContracts';
import './App.css';

const NAV_GROUPS = [
  { 
    id: 'overview',
    label: 'Overview',
    icon: <LayoutDashboard size={20} />,
    items: [
      { to: '/', label: 'Summary Dashboard', icon: <LayoutDashboard size={18} /> },
    ]
  },
  { 
    id: 'data',
    label: 'Managed Data',
    icon: <Database size={20} />,
    items: [
      { to: '/contracts', label: 'Active Contracts', icon: <FileText size={18} /> },
      { to: '/removed',   label: 'Removal History', icon: <History size={18} /> },
      { to: '/logs',      label: 'Streaming Logs',    icon: <Activity size={18} /> },
      { to: '/payments',  label: 'Usage Payments',   icon: <CreditCard size={18} /> },
    ]
  },
  { 
    id: 'audit',
    label: 'Audit & Compliance',
    icon: <Shield size={20} />,
    items: [
      { to: '/results',    label: 'Audit Results',     icon: <ShieldCheck size={18} /> },
      { to: '/violations', label: 'Compliance Violations', icon: <AlertCircle size={18} /> },
      { to: '/trace',      label: 'AI Agent Trace',        icon: <Workflow size={18} /> },
    ]
  },
  { 
    id: 'intel',
    label: 'Intelligence',
    icon: <Brain size={20} />,
    items: [
      { to: '/extensions', label: 'AI Capabilities', icon: <BrainCircuit size={18} /> },
    ]
  },
];

function Sidebar({ isCollapsed }) {
  const [expandedGroups, setExpandedGroups] = useState({
    overview: true,
    data: false,
    audit: false,
    intel: false
  });

  const toggleGroup = (id) => {
    if (isCollapsed) return; // Disable accordion in collapsed mode
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div className="flex items-center gap-3 overflow-hidden" style={{ marginLeft: isCollapsed ? '0' : '36px', transition: 'margin 0.3s' }}>
          <div className="sidebar-logo-icon">LR</div>
          {!isCollapsed && (
            <div className="animate-in fade-in whitespace-nowrap">
              <div className="sidebar-logo-text">LRAC</div>
              <div className="sidebar-logo-sub">Royalty Auditor</div>
            </div>
          )}
        </div>
      </div>

      <nav style={{ flex: 1, marginTop: '1rem' }}>
        {NAV_GROUPS.map((group) => (
          <div key={group.id} className="nav-group">
            <div 
              className={`nav-group-header ${expandedGroups[group.id] ? 'expanded' : ''} ${isCollapsed ? 'collapsed' : ''}`} 
              onClick={() => toggleGroup(group.id)}
              title={isCollapsed ? group.label : ''}
            >
              <div className="flex items-center gap-3">
                {group.icon}
                {!isCollapsed && <span className="nav-group-label">{group.label}</span>}
              </div>
              {!isCollapsed && (
                <div style={{ marginLeft: 'auto' }}>
                  {expandedGroups[group.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              )}
            </div>
            
            {(expandedGroups[group.id] || isCollapsed) && (
              <div className="nav-group-content">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) => `nav-link${isActive ? ' active' : ''} ${isCollapsed ? 'collapsed' : ''}`}
                    title={isCollapsed ? item.label : ''}
                  >
                     {isCollapsed ? (
                       <span className="flex justify-center w-full">{item.icon}</span>
                     ) : (
                       item.label
                     )}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-divider"></div>
        <a 
          href="http://localhost:8000/docs" 
          target="_blank" 
          rel="noreferrer"
          title="API Documentation"
          className={isCollapsed ? 'collapsed' : ''}
        >
          <BookOpen size={18} /> 
          {!isCollapsed && <span className="footer-label">API Documentation</span>}
          {!isCollapsed && <ExternalLink size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
        </a>
      </div>
    </aside>
  );
}

function App() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <BrowserRouter>
      <div className={`app-shell ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Fixed Toggle Button outside Sidebar */}
        <button 
          className="sidebar-collapse-btn" 
          onClick={() => setIsCollapsed(prev => !prev)}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <Menu size={18} />
        </button>

        <Sidebar isCollapsed={isCollapsed} />
        <main className="main-content">
          <Routes>
            <Route path="/"           element={<Dashboard />} />
            <Route path="/contracts"  element={<ContractsTable />} />
            <Route path="/removed"    element={<RemovedContracts />} />
            <Route path="/logs"       element={<LogsTable />} />
            <Route path="/payments"   element={<PaymentsTable />} />
            <Route path="/results"    element={<AuditResults />} />
            <Route path="/violations" element={<Violations />} />
            <Route path="/trace"      element={<AgentTrace />} />
            <Route path="/extensions" element={<FutureExtensions />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
