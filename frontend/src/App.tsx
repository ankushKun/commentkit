import { useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { LoginForm } from '@/components/LoginForm';
import { DashboardLayout, type TabType } from '@/components/DashboardLayout';
import { OverviewTab } from '@/components/OverviewTab';
import { SitesTab } from '@/components/SitesTab';
import { SettingsTab } from '@/components/SettingsTab';
import { AdminTab } from '@/components/AdminTab';
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
      <div className="min-h-screen flex items-center justify-center p-4">
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
