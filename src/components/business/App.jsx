import { useState, useEffect } from 'react';
import Layout from './Layout.jsx';
import Dashboard from './Dashboard.jsx';
import Inventory from './Inventory.jsx';
import Sales from './Sales.jsx';
import HeldOrders from './HeldOrders.jsx';
import Expenses from './Expenses.jsx';
import BusinessSettings from './BusinessSettings.jsx';
import { useBusinessStore } from './store.js';

// Lazy-boot the legacy search app only once; returns a promise
let legacyBootPromise = null;
function bootLegacy() {
  if (!legacyBootPromise) {
    legacyBootPromise = import('../../legacy/main.js').catch(e => {
      console.error('Legacy app failed to boot:', e);
      legacyBootPromise = null;
    });
  }
  return legacyBootPromise;
}

export default function BusinessApp() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSyncing, setIsSyncing] = useState(false);
  const [data, update] = useBusinessStore();

  // Boot legacy app on first Search visit; sync settings each time
  useEffect(() => {
    if (activeTab !== 'search') return;
    bootLegacy().then(() => {
      // Push business store values into legacy state so they stay in sync
      import('../../legacy/utils/state.js').then(({ state: ls, persistSettings }) => {
        ls.phpRate     = data.phpRate;
        ls.gasWriteUrl = data.googleSheetsUrl;
        if (data.ebayUserToken) ls.ebayToken = data.ebayUserToken;
        // Lock legacy app to search tab
        ls.tab = 'search';
        persistSettings?.();
        window.renderApp?.();
      }).catch(() => {});
    });
  }, [activeTab, data.phpRate, data.googleSheetsUrl, data.ebayUserToken]);

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

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onSync={handleSync}
      isSyncing={isSyncing}
      autoSyncEnabled={data.autoSyncEnabled}
    >
      {/* #app always in the DOM — legacy script must never lose its node.
          Visible only on Search tab; all legacy chrome stripped via CSS. */}
      <div
        id="app"
        suppressHydrationWarning
        style={{ display: activeTab === 'search' ? 'block' : 'none' }}
      />
      {renderTab()}
    </Layout>
  );
}
