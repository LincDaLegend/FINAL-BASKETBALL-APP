import { useState, useEffect } from 'react';
import Layout from './Layout.jsx';
import Dashboard from './Dashboard.jsx';
import Inventory from './Inventory.jsx';
import Sales from './Sales.jsx';
import HeldOrders from './HeldOrders.jsx';
import Expenses from './Expenses.jsx';
import BusinessSettings from './BusinessSettings.jsx';
import { useBusinessStore } from './store.js';

// Lazy-boot the legacy search app only once
let legacyBooted = false;
async function bootLegacy() {
  if (legacyBooted) return;
  legacyBooted = true;
  try {
    await import('../../legacy/main.js');
  } catch (e) {
    console.error('Legacy app failed to boot:', e);
  }
}

export default function BusinessApp() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSyncing, setIsSyncing] = useState(false);
  const [data, update] = useBusinessStore();

  // Boot legacy app when user first visits Search tab
  useEffect(() => {
    if (activeTab === 'search') {
      bootLegacy();
    }
  }, [activeTab]);

  const handleSync = async () => {
    if (!data.googleSheetsUrl || isSyncing) return;
    setIsSyncing(true);
    try {
      await fetch(data.googleSheetsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', data }),
      });
    } catch (e) {
      console.error('Sync failed', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard':    return <Dashboard data={data} setActiveTab={setActiveTab} />;
      case 'inventory':    return <Inventory data={data} update={update} />;
      case 'sales':        return <Sales data={data} update={update} />;
      case 'held-orders':  return <HeldOrders data={data} update={update} />;
      case 'expenses':     return <Expenses data={data} update={update} />;
      case 'settings':     return <BusinessSettings data={data} update={update} onSync={handleSync} isSyncing={isSyncing} />;
      case 'search':       return null;
      default:             return null;
    }
  };

  // Search tab: show legacy app full-screen, no business layout wrapper
  if (activeTab === 'search') {
    return (
      <>
        {/* Minimal nav strip so the user can get back */}
        <div style={{ position: 'fixed', top: 0, left: 0, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: '#1e293b', width: '100%' }}>
          <button
            onClick={() => setActiveTab('dashboard')}
            style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            ← Back to Baller
          </button>
          <span style={{ color: '#334155', fontSize: 12 }}>|</span>
          <span style={{ color: '#64748b', fontSize: 12, fontWeight: 600 }}>Search eBay</span>
        </div>
        <div id="app" suppressHydrationWarning style={{ paddingTop: 40 }} />
      </>
    );
  }

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onSync={handleSync}
      isSyncing={isSyncing}
      autoSyncEnabled={data.autoSyncEnabled}
    >
      {renderTab()}
    </Layout>
  );
}
