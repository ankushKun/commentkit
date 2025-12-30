import { useAuth } from '@/lib/auth-context';
import { useSite } from '@/lib/site-context';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import {
    Home,
    Globe,
    Settings,
    LogOut,
    MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logo from "../../icon.png"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BookOpen } from "lucide-react";

export type TabType = 'overview' | 'sites' | 'settings';

interface DashboardLayoutProps {
    children: React.ReactNode;
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
}

export function DashboardLayout({ children, activeTab, onTabChange }: DashboardLayoutProps) {
    const { user, logout } = useAuth();
    const { currentSite } = useSite();

    const pendingCount = currentSite?.stats.pending_comments || 0;

    const navigation = [
        { id: 'overview', label: 'Overview', icon: Home, badge: pendingCount > 0 ? pendingCount : undefined },
        { id: 'sites', label: 'Sites', icon: Globe },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            {/* Top Navigation Bar */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between shrink-0 z-50">
                <div className="flex items-center gap-8">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        {/* <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-sm font-bold text-sm">
                            <MessageSquare className="h-4 w-4" />
                        </div> */}
                        <img src={logo} alt="Logo" className="h-8 w-8" />
                        <span className="font-bold text-xl text-slate-900">CommentKit</span>
                    </div>

                    {/* Navigation */}
                    <nav className="hidden md:flex items-center gap-1">
                        {navigation.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                                <Button
                                    key={item.id}
                                    variant="ghost"
                                    onClick={() => onTabChange(item.id as TabType)}
                                    className={cn(
                                        "gap-2 h-10 px-4 font-medium relative",
                                        isActive
                                            ? "text-blue-600 bg-blue-50 hover:bg-blue-50 hover:text-blue-700"
                                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    {item.label}
                                    {item.badge !== undefined && (
                                        <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-700">
                                            {item.badge > 99 ? '99+' : item.badge}
                                        </span>
                                    )}
                                </Button>
                            );
                        })}
                    </nav>
                </div>

                {/* Right Section */}
                <div className="flex items-center gap-4">

                    {/* Resources Links */}
                    <div className="hidden lg:flex items-center gap-2">
                        <Button
                            variant="ghost"
                            className="text-slate-600 gap-2 h-9 px-3 text-sm hover:text-slate-900"
                            asChild
                        >
                            <a href="/docs" target="_blank">
                                <BookOpen className="h-4 w-4" />
                                Docs
                            </a>
                        </Button>
                    </div>

                    <div className="h-6 w-px bg-slate-200" />

                    {/* User Menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="flex items-center gap-3 h-auto p-2 hover:bg-slate-100">
                                <div className="text-right hidden sm:block">
                                    <div className="text-sm font-medium text-slate-900">
                                        {user?.display_name || user?.email?.split('@')[0] || 'User'}
                                    </div>
                                    <div className="text-xs text-slate-500">{user?.email}</div>
                                </div>
                                <Avatar
                                    emailHash={user?.email_hash}
                                    name={user?.display_name || user?.email}
                                    size="md"
                                    className="ring-2 ring-slate-100"
                                />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>My Account</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem disabled>
                                <span className="text-xs text-muted-foreground">{user?.email}</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-600 cursor-pointer">
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Log out</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto bg-slate-50 p-8">
                <div className="max-w-[1400px] mx-auto h-full">
                    {children}
                </div>
            </main>
        </div>
    );
}
