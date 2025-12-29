import { useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { SiteProvider } from '@/lib/site-context';
import { LoginForm } from '@/components/login-form';
import { DashboardLayout, type TabType } from '@/components/dashboard-layout';
import { OverviewTab } from '@/components/overview-tab';
import { SitesTab } from '@/components/sites-tab';
import { SettingsTab } from '@/components/settings-tab';
import './index.css';

function Dashboard() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen py-12 px-4 bg-slate-50">
        <LoginForm />
      </div>
    );
  }

  return (
    <SiteProvider>
      <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'sites' && <SitesTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </DashboardLayout>
    </SiteProvider>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Dashboard />
    </AuthProvider>
  );
}

export default App;
