import { useState, useEffect } from 'react';
import Layout from './Layout.jsx';
import Dashboard from './Dashboard.jsx';
import Inventory from './Inventory.jsx';
import Sales from './Sales.jsx';
import HeldOrders from './HeldOrders.jsx';
import Expenses from './Expenses.jsx';
import LbcBooking from './LbcBooking.jsx';
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
      case 'lbc-booking':  return <LbcBooking data={data} update={update} />;
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
      {/* Legacy search app rendered in its own div — always in the DOM
          so the legacy script stays mounted; hidden when not on search tab */}
      <div
        id="app"
        suppressHydrationWarning
        style={{ display: activeTab === 'search' ? '' : 'none' }}
      />
      {renderTab()}
    </Layout>
  );
}
