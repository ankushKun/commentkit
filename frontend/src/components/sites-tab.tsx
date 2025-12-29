import { useEffect, useState } from 'react';
import { sites, comments as commentsApi, type SitePreview, type SiteDetailWithData, type Comment } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Search,
    Filter,
    Calendar,
    ArrowUpDown,
    Copy,
    RefreshCw,
    Trash2,
    CheckCircle2,
    XCircle,
    AlertCircle,
    ChevronLeft,
    Plus,
    Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function SitesTab() {
    const [siteList, setSiteList] = useState<SitePreview[]>([]);
    const [selectedSite, setSelectedSite] = useState<SiteDetailWithData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);

    // Create form state
    const [newSiteName, setNewSiteName] = useState('');
    const [newSiteDomain, setNewSiteDomain] = useState('');
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState('');

    // Comments filter
    const [commentFilter, setCommentFilter] = useState<string>('pending');

    const loadSites = async () => {
        const { data } = await sites.list();
        if (data?.sites) {
            setSiteList(data.sites);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadSites();
    }, []);

    const loadSiteDetails = async (siteId: number, status?: string) => {
        const { data } = await sites.get(siteId, {
            comment_limit: 50,
            comment_status: status === 'all' ? undefined : status,
        });
        if (data) {
            setSelectedSite(data);
        }
    };

    const handleCreateSite = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateLoading(true);
        setCreateError('');

        const { error } = await sites.create(newSiteName, newSiteDomain);

        if (error) {
            setCreateError(error);
        } else {
            setNewSiteName('');
            setNewSiteDomain('');
            setShowCreateForm(false);
            await loadSites();
        }

        setCreateLoading(false);
    };

    const handleDeleteSite = async (siteId: number) => {
        if (!confirm('Are you sure you want to delete this site? This action cannot be undone.')) {
            return;
        }

        await sites.delete(siteId);
        setSelectedSite(null);
        await loadSites();
    };

    const handleRegenerateKey = async (siteId: number) => {
        if (!confirm('Are you sure? This will invalidate the current API key.')) {
            return;
        }

        const { data } = await sites.regenerateKey(siteId);
        if (data && selectedSite) {
            setSelectedSite({ ...selectedSite, api_key: data.api_key });
        }
    };

    const handleModerateComment = async (commentId: number, status: 'approved' | 'rejected' | 'spam') => {
        await commentsApi.updateStatus(commentId, status);
        // Optimistic update or refresh
        if (selectedSite) {
            // For now, just remove it from the list if the filter doesn't match effectively
            // But simplest is to refresh
            // await loadSiteDetails(selectedSite.id, commentFilter);
            // Let's manually update state for speed
            setSelectedSite(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    comments: (prev.comments || []).map(c => c.id === commentId ? { ...c, status } : c)
                };
            });
        }
    };

    const handleDeleteComment = async (commentId: number) => {
        if (!confirm('Delete this comment?')) return;
        await commentsApi.delete(commentId);
        if (selectedSite) {
            setSelectedSite(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    comments: (prev.comments || []).filter(c => c.id !== commentId)
                };
            });
        }
    };

    // Filter logic
    const filteredComments = (selectedSite?.comments ?? []).filter(
        (c: Comment) => commentFilter === 'all' || c.status === commentFilter
    );

    const filterTabs = [
        { id: 'pending', label: 'Pending', count: selectedSite?.stats?.pending_comments ?? 0, icon: AlertCircle },
        { id: 'approved', label: 'Approved', icon: CheckCircle2 },
        { id: 'spam', label: 'Spam', icon: XCircle },
        { id: 'rejected', label: 'Rejected', icon: Trash2 }, // Mapping rejected to deleted concept roughly
        { id: 'all', label: 'All', icon: null }
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-pulse text-muted-foreground">Loading...</div>
            </div>
        );
    }

    // Site detail view (Moderation Dashboard)
    if (selectedSite) {
        return (
            <div className="flex flex-col h-full space-y-4">
                {/* Dashboard Header within Content */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedSite(null)} className="h-8 w-8 p-0 rounded-full">
                            <ChevronLeft className="h-5 w-5 text-slate-500" />
                        </Button>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">{selectedSite.name}</h2>
                            <p className="text-sm text-slate-500">{selectedSite.domain}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => handleRegenerateKey(selectedSite.id)}>
                            <RefreshCw className="h-3.5 w-3.5" /> Key
                        </Button>
                        <Button variant="destructive" size="sm" className="gap-2" onClick={() => handleDeleteSite(selectedSite.id)}>
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                    </div>
                </div>

                {/* API Key Banner (Simulating "Shortcuts" or Info/Config area) */}
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-md flex items-center justify-between text-sm text-blue-800">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold">API Key:</span>
                        <code className="bg-white/50 px-2 py-0.5 rounded font-mono">{selectedSite.api_key}</code>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 text-blue-700 hover:bg-blue-100" onClick={() => navigator.clipboard.writeText(selectedSite.api_key)}>
                        <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                </div>

                {/* Tabs & Toolbar */}
                <div className="space-y-4">
                    {/* Tabs */}
                    <div className="flex bg-white rounded-lg p-1 border border-slate-200 w-fit">
                        {filterTabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = commentFilter === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setCommentFilter(tab.id)}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all",
                                        isActive
                                            ? "bg-blue-50 text-blue-600 shadow-sm"
                                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                    )}
                                >
                                    {Icon && <Icon className="h-4 w-4" />}
                                    {tab.label}
                                    {tab.count !== undefined && tab.count > 0 && (
                                        <span className="ml-1 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Filter Toolbar */}
                    <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search comments..."
                                className="pl-9 border-none focus-visible:ring-0 text-slate-800 placeholder:text-slate-400 h-9"
                            />
                        </div>
                        <div className="h-6 w-px bg-slate-200" />

                        <Button variant="ghost" size="sm" className="text-slate-600 gap-2 font-normal">
                            <Filter className="h-3.5 w-3.5" />
                            Filter by
                        </Button>
                        <div className="h-6 w-px bg-slate-200" />

                        <Button variant="ghost" size="sm" className="text-slate-600 gap-2 font-normal">
                            <Calendar className="h-3.5 w-3.5" />
                            Past Year
                        </Button>
                        <div className="h-6 w-px bg-slate-200" />

                        <Button variant="ghost" size="sm" className="text-slate-600 gap-2 font-normal">
                            <ArrowUpDown className="h-3.5 w-3.5" />
                            Newest
                        </Button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 bg-white rounded-lg border border-slate-200 shadow-sm min-h-100">
                    {filteredComments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center h-full">
                            <div className="h-32 w-32 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                                <CheckCircle2 className="h-12 w-12 text-green-500/20" />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-800 mb-2">
                                Nice work!
                                {commentFilter === 'pending' ? " You've moderated all Pending comments." : " No comments found."}
                            </h3>
                            <p className="text-slate-500 max-w-sm">
                                Want to learn more about fostering a thriving community?
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {filteredComments.map((comment) => (
                                <div key={comment.id} className="p-4 hover:bg-slate-50 transition-colors group">
                                    <div className="flex items-start gap-4">
                                        <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold uppercase">
                                            {comment.author_name ? comment.author_name[0] : 'A'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-slate-800">{comment.author_name || 'Anonymous'}</span>
                                                    <span className="text-xs text-slate-400">• {new Date(comment.created_at).toLocaleDateString()}</span>
                                                    {comment.status === 'pending' && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">Pending</span>}
                                                    {comment.status === 'spam' && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Spam</span>}
                                                    {comment.status === 'approved' && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Approved</span>}
                                                </div>
                                            </div>
                                            <p className="text-slate-600 text-sm leading-relaxed mb-3">
                                                {comment.content}
                                            </p>

                                            <div className="flex items-center gap-2 opacity-100 transition-opacity">
                                                {comment.status !== 'approved' && (
                                                    <Button size="sm" variant="outline" className="h-7 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200" onClick={() => handleModerateComment(comment.id, 'approved')}>
                                                        Approve
                                                    </Button>
                                                )}
                                                {comment.status !== 'spam' && (
                                                    <Button size="sm" variant="outline" className="h-7 text-slate-600 hover:text-slate-800" onClick={() => handleModerateComment(comment.id, 'spam')}>
                                                        Spam
                                                    </Button>
                                                )}
                                                {comment.status !== 'rejected' && (
                                                    <Button size="sm" variant="ghost" className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleModerateComment(comment.id, 'rejected')}>
                                                        Reject
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Sites list view
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">My Sites</h2>
                    <p className="text-slate-500">
                        Manage your registered sites
                    </p>
                </div>
                <Button onClick={() => setShowCreateForm(true)} className="gap-2">
                    <Plus className="h-4 w-4" /> Create Site
                </Button>
            </div>

            {/* Create Form Modal */}
            {showCreateForm && (
                <Card className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50 shadow-2xl border-slate-200 animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-6">
                        <h3 className="text-lg font-bold mb-4">Create New Site</h3>
                        <form onSubmit={handleCreateSite} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="site-name">Site Name</Label>
                                <Input
                                    id="site-name"
                                    placeholder="My Blog"
                                    value={newSiteName}
                                    onChange={(e) => setNewSiteName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="site-domain">Domain</Label>
                                <Input
                                    id="site-domain"
                                    placeholder="myblog.com"
                                    value={newSiteDomain}
                                    onChange={(e) => setNewSiteDomain(e.target.value)}
                                    required
                                />
                            </div>
                            {createError && (
                                <p className="text-sm text-destructive">{createError}</p>
                            )}
                            <div className="flex justify-end gap-2 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowCreateForm(false)}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={createLoading}>
                                    {createLoading ? 'Creating...' : 'Create Site'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </Card>
            )}

            {/* Background overlay for modal */}
            {showCreateForm && (
                <div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm" onClick={() => setShowCreateForm(false)} />
            )}

            {/* Sites Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {siteList.map((site) => (
                    <Card
                        key={site.id}
                        className="cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group border-slate-200"
                        onClick={() => loadSiteDetails(site.id)}
                    >
                        <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <Globe className="h-5 w-5" />
                                </div>
                                <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-full">
                                    ID: {site.id}
                                </span>
                            </div>
                            <h3 className="font-bold text-lg text-slate-800 mb-1 group-hover:text-blue-600 transition-colors">{site.name}</h3>
                            <p className="text-sm text-slate-500 mb-4">{site.domain}</p>
                            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                                <span>{new Date(site.created_at).toLocaleDateString()}</span>
                                <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                    Manage <ChevronLeft className="h-3 w-3 rotate-180" />
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {siteList.length === 0 && !loading && (
                    <Card className="col-span-full border-dashed">
                        <CardContent className="py-12 text-center">
                            <p className="text-muted-foreground mb-4">
                                No sites found. Start by creating one.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
