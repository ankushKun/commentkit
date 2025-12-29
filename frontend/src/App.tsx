import { useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { LoginForm } from '@/components/login-form';
import { DashboardLayout, type TabType } from '@/components/dashboard-layout';
import { OverviewTab } from '@/components/overview-tab';
import { SitesTab } from '@/components/sites-tab';
import { SettingsTab } from '@/components/settings-tab';
import { AdminTab } from '@/components/admin-tab';
import './index.css';

function Dashboard() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen py-12 px-4">
        <LoginForm />
      </div>
    );
  }

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'sites' && <SitesTab />}
      {activeTab === 'settings' && <SettingsTab />}
      {activeTab === 'admin' && user?.is_superadmin && <AdminTab />}
    </DashboardLayout>
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
