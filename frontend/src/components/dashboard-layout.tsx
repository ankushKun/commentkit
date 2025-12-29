import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import {
    LayoutDashboard,
    Globe,
    Settings,
    Shield,
    LogOut,
    Search,
    Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type TabType = 'overview' | 'sites' | 'settings' | 'admin';

interface DashboardLayoutProps {
    children: React.ReactNode;
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
}

export function DashboardLayout({ children, activeTab, onTabChange }: DashboardLayoutProps) {
    const { user, logout } = useAuth();

    const menuGroups = [
        {
            label: "General",
            items: [
                { id: 'overview', label: 'Overview', icon: LayoutDashboard },
            ]
        },
        {
            label: "Management",
            items: [
                { id: 'sites', label: 'Sites & Comments', icon: Globe },
            ]
        },
        {
            label: "Configuration",
            items: [
                { id: 'settings', label: 'Settings', icon: Settings },
            ]
        }
    ];

    if (user?.is_superadmin) {
        menuGroups.push({
            label: "Admin",
            items: [
                { id: 'admin', label: 'System Admin', icon: Shield }
            ]
        });
    }

    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            {/* Top Navigation Bar - Dark Theme */}
            <header className="h-14 bg-slate-900 text-white flex items-center px-4 justify-between shrink-0 z-50 shadow-md">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 font-bold text-lg tracking-tight text-white">
                        <div className="h-7 w-7 rounded bg-blue-500 flex items-center justify-center text-white shadow-lg">
                            CK
                        </div>
                        CommentKit
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative hidden md:block w-96">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Type / to search..."
                            className="w-full bg-slate-800 border-none rounded-md py-2 pl-9 pr-4 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800">
                        <Bell className="h-4 w-4" />
                    </Button>
                    <div className="h-6 w-px bg-slate-800 mx-2" />

                    <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                            <div className="text-sm font-medium text-slate-200">{user?.display_name || 'User'}</div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
                            onClick={logout}
                            title="Sign out"
                        >
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto">
                    <div className="py-6 px-3 space-y-6">
                        {menuGroups.map((group, idx) => (
                            <div key={idx}>
                                <h3 className="mb-2 px-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    {group.label}
                                </h3>
                                <div className="space-y-0.5">
                                    {group.items.map((item) => {
                                        const Icon = item.icon;
                                        const isActive = activeTab === item.id;
                                        return (
                                            <Button
                                                key={item.id}
                                                variant="ghost"
                                                onClick={() => onTabChange(item.id as TabType)}
                                                className={cn(
                                                    "w-full justify-start gap-3 h-9 px-3 font-medium transition-colors mb-1",
                                                    isActive
                                                        ? "bg-blue-50 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                                )}
                                            >
                                                <Icon className={cn("h-4 w-4", isActive ? "text-blue-600" : "text-slate-400")} />
                                                {item.label}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
                    <div className="max-w-7xl mx-auto h-full space-y-4">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
