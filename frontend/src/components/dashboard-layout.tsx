import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

export type TabType = 'overview' | 'sites' | 'settings' | 'admin';

interface DashboardLayoutProps {
    children: React.ReactNode;
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
}

export function DashboardLayout({ children, activeTab, onTabChange }: DashboardLayoutProps) {
    const { user, logout } = useAuth();

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b bg-card">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <h1 className="text-xl font-bold">CommentKit</h1>
                        <nav className="flex gap-1">
                            <Button
                                variant={activeTab === 'overview' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => onTabChange('overview')}
                            >
                                Overview
                            </Button>
                            <Button
                                variant={activeTab === 'sites' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => onTabChange('sites')}
                            >
                                My Sites
                            </Button>
                            <Button
                                variant={activeTab === 'settings' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => onTabChange('settings')}
                            >
                                Settings
                            </Button>
                            {user?.is_superadmin && (
                                <Button
                                    variant={activeTab === 'admin' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => onTabChange('admin')}
                                >
                                    Admin
                                </Button>
                            )}
                        </nav>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                            {user?.display_name || user?.email}
                        </span>
                        <Button variant="outline" size="sm" onClick={logout}>
                            Sign out
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8">
                {children}
            </main>
        </div>
    );
}
