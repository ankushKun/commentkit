import { useEffect, useState } from 'react';
import { sites, comments as commentsApi, type SitePreview, type SiteDetailWithData, type Comment, type VerificationInfo } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Copy,
    Check,
    Trash2,
    CheckCircle2,
    XCircle,
    AlertCircle,
    ChevronLeft,
    Plus,
    Globe,
    ShieldCheck,
    ShieldAlert,
    Loader2,
    Code,
    FileText,
    MessageSquare,
    Settings,
    ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SitesTabProps {
    autoShowCreate?: boolean;
}

export function SitesTab({ autoShowCreate = false }: SitesTabProps) {
    const [siteList, setSiteList] = useState<SitePreview[]>([]);
    const [selectedSite, setSelectedSite] = useState<SiteDetailWithData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(autoShowCreate);

    // Create form state
    const [newSiteName, setNewSiteName] = useState('');
    const [newSiteDomain, setNewSiteDomain] = useState('');
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState('');

    // Comments filter
    const [commentFilter, setCommentFilter] = useState<string>('pending');

    // Site detail view tab
    const [siteDetailTab, setSiteDetailTab] = useState<'overview' | 'pages' | 'comments'>('overview');

    // Verification state
    const [verificationInfo, setVerificationInfo] = useState<VerificationInfo | null>(null);
    const [verificationLoading, setVerificationLoading] = useState(false);
    const [verificationError, setVerificationError] = useState<string | null>(null);
    const [showVerification, setShowVerification] = useState(false);

    // Post-creation verification instructions
    const [showVerifyInstructions, setShowVerifyInstructions] = useState(false);
    const [newlyCreatedSiteId, setNewlyCreatedSiteId] = useState<number | null>(null);
    const [newlyCreatedSiteDomain, setNewlyCreatedSiteDomain] = useState<string>('');
    const [postCreateVerificationInfo, setPostCreateVerificationInfo] = useState<VerificationInfo | null>(null);
    const [postCreateVerifying, setPostCreateVerifying] = useState(false);
    const [postCreateVerified, setPostCreateVerified] = useState(false);
    const [postCreateVerifyError, setPostCreateVerifyError] = useState<string | null>(null);

    // Integration instructions dialog
    const [showIntegrationInstructions, setShowIntegrationInstructions] = useState(false);
    const [copiedItem, setCopiedItem] = useState<string | null>(null);

    const copyToClipboard = async (text: string, itemId: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedItem(itemId);
        setTimeout(() => setCopiedItem(null), 2000);
    };

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

    // React to autoShowCreate prop changes
    useEffect(() => {
        if (autoShowCreate) {
            setShowCreateForm(true);
        }
    }, [autoShowCreate]);

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

        const { data, error } = await sites.create(newSiteName, newSiteDomain);

        if (error) {
            setCreateError(error);
        } else if (data) {
            const createdDomain = newSiteDomain;
            setNewSiteName('');
            setNewSiteDomain('');
            setShowCreateForm(false);
            await loadSites();

            // Fetch verification info and show instructions dialog
            setNewlyCreatedSiteId(data.id);
            setNewlyCreatedSiteDomain(createdDomain);
            const { data: verifyData } = await sites.getVerification(data.id);
            if (verifyData) {
                setPostCreateVerificationInfo(verifyData);
                setShowVerifyInstructions(true);
            }
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

    const loadVerificationInfo = async (siteId: number) => {
        setVerificationLoading(true);
        setVerificationError(null);
        const { data, error } = await sites.getVerification(siteId);
        if (error) {
            setVerificationError(error);
        } else if (data) {
            setVerificationInfo(data);
        }
        setVerificationLoading(false);
    };

    const handleVerifySite = async (siteId: number) => {
        setVerificationLoading(true);
        setVerificationError(null);
        const { data, error } = await sites.verify(siteId);
        if (error) {
            setVerificationError(error);
        } else if (data) {
            if (data.verified) {
                // Refresh site details to get updated verified status
                await loadSiteDetails(siteId, commentFilter);
                await loadSites();
                setShowVerification(false);
                setVerificationInfo(null);
            } else {
                setVerificationError(data.error || 'Verification failed');
            }
        }
        setVerificationLoading(false);
    };

    const openVerification = async (siteId: number) => {
        setShowVerification(true);
        await loadVerificationInfo(siteId);
    };

    const handlePostCreateVerify = async () => {
        if (!newlyCreatedSiteId) return;
        setPostCreateVerifying(true);
        setPostCreateVerifyError(null);
        const { data, error } = await sites.verify(newlyCreatedSiteId);
        if (error) {
            setPostCreateVerifyError(error);
        } else if (data) {
            if (data.verified) {
                setPostCreateVerified(true);
                await loadSites();
            } else {
                setPostCreateVerifyError(data.error || 'Verification failed. Make sure the file is accessible.');
            }
        }
        setPostCreateVerifying(false);
    };

    const goToIntegrationInstructions = () => {
        setShowVerifyInstructions(false);
        setPostCreateVerificationInfo(null);
        setPostCreateVerified(false);
        setPostCreateVerifyError(null);
        setShowIntegrationInstructions(true);
    };

    const closeAllOnboardingDialogs = () => {
        setShowVerifyInstructions(false);
        setShowIntegrationInstructions(false);
        setPostCreateVerificationInfo(null);
        setNewlyCreatedSiteId(null);
        setNewlyCreatedSiteDomain('');
        setPostCreateVerified(false);
        setPostCreateVerifyError(null);
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

    // Site detail view
    if (selectedSite) {
        const siteDetailTabs = [
            { id: 'overview' as const, label: 'Overview', icon: Settings },
            { id: 'pages' as const, label: 'Pages', icon: FileText },
            { id: 'comments' as const, label: 'Comments', icon: MessageSquare, count: selectedSite.stats?.pending_comments },
        ];

        return (
            <div className="flex flex-col h-full space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedSite(null); setShowVerification(false); setVerificationInfo(null); setSiteDetailTab('overview'); }} className="h-8 w-8 p-0 rounded-full">
                            <ChevronLeft className="h-5 w-5 text-slate-500" />
                        </Button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-2xl font-bold text-slate-800">{selectedSite.name}</h2>
                                {selectedSite.verified ? (
                                    <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                        <ShieldCheck className="h-3 w-3" /> Verified
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full animate-pulse">
                                        <ShieldAlert className="h-3 w-3" /> Unverified
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-sm text-slate-500">{selectedSite.domain}</p>
                                <a href={`https://${selectedSite.domain}`} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-600">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            </div>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={() => handleDeleteSite(selectedSite.id)}>
                        <Trash2 className="h-3.5 w-3.5" /> Delete Site
                    </Button>
                </div>

                {/* Tabs */}
                <div className="flex bg-white rounded-lg p-1 border border-slate-200 w-fit">
                    {siteDetailTabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = siteDetailTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setSiteDetailTab(tab.id)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all",
                                    isActive
                                        ? "bg-blue-50 text-blue-600 shadow-sm"
                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                                {tab.count !== undefined && tab.count > 0 && (
                                    <span className="ml-1 bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-full">
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Tab Content */}
                {siteDetailTab === 'overview' && (
                    <div className="space-y-6">
                        {/* Verification Alert - Show prominently if unverified */}
                        {!selectedSite.verified && (
                            <Card className="border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50">
                                <CardContent className="p-5">
                                    <div className="flex items-start gap-4">
                                        <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                                            <ShieldAlert className="h-5 w-5 text-amber-600" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-slate-800 mb-1">Verify Your Domain</h3>
                                            <p className="text-sm text-slate-600 mb-3">
                                                Your site is not verified. CommentKit will only work on localhost until you verify domain ownership.
                                            </p>
                                            {!showVerification ? (
                                                <Button size="sm" className="gap-2" onClick={() => openVerification(selectedSite.id)}>
                                                    <ShieldCheck className="h-4 w-4" /> Start Verification
                                                </Button>
                                            ) : verificationLoading && !verificationInfo ? (
                                                <div className="flex items-center gap-2 text-slate-500">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Loading...
                                                </div>
                                            ) : verificationInfo ? (
                                                <div className="space-y-3 mt-4 pt-4 border-t border-amber-200">
                                                    <div className="flex gap-3">
                                                        <div className="shrink-0 h-6 w-6 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center text-sm font-semibold">1</div>
                                                        <div className="flex-1">
                                                            <p className="text-sm text-slate-700">Create a file at:</p>
                                                            <code className="block bg-white px-3 py-2 rounded mt-1 text-sm font-mono text-slate-700 border border-amber-200">
                                                                {verificationInfo.verification_file_path}
                                                            </code>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-3">
                                                        <div className="shrink-0 h-6 w-6 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center text-sm font-semibold">2</div>
                                                        <div className="flex-1">
                                                            <p className="text-sm text-slate-700">Add this token as the file content:</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <code className="flex-1 bg-white px-3 py-2 rounded font-mono text-sm text-slate-700 select-all border border-amber-200 truncate">
                                                                    {verificationInfo.verification_token}
                                                                </code>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className={cn(
                                                                        "transition-colors shrink-0",
                                                                        copiedItem === 'verify-token' && "text-green-600 border-green-300"
                                                                    )}
                                                                    onClick={() => copyToClipboard(verificationInfo.verification_token, 'verify-token')}
                                                                >
                                                                    {copiedItem === 'verify-token' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {verificationError && (
                                                        <div className="bg-red-50 border border-red-200 rounded px-3 py-2">
                                                            <p className="text-sm text-red-700">{verificationError}</p>
                                                        </div>
                                                    )}
                                                    <div className="flex gap-2 pt-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleVerifySite(selectedSite.id)}
                                                            disabled={verificationLoading}
                                                            className="gap-2"
                                                        >
                                                            {verificationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                                                            Verify Now
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => { setShowVerification(false); setVerificationInfo(null); setVerificationError(null); }}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Integration Instructions */}
                        <Card className="border-slate-200">
                            <CardContent className="p-5">
                                <div className="flex items-start gap-4">
                                    <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                                        <Code className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-slate-800 mb-1">Integration</h3>
                                        <p className="text-sm text-slate-600 mb-4">
                                            Add CommentKit to your website with just two lines of code.
                                        </p>
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-xs font-medium text-slate-500 mb-2">1. Add the script</p>
                                                <div className="relative">
                                                    <pre className="bg-slate-900 text-slate-100 px-4 py-3 rounded-lg text-sm font-mono overflow-x-auto">
                                                        <code>{`<script src="${window.location.origin}/commentkit.js"></script>`}</code>
                                                    </pre>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className={cn(
                                                            "absolute top-2 right-2 h-7 transition-colors",
                                                            copiedItem === 'detail-script'
                                                                ? "text-green-400 hover:text-green-400"
                                                                : "text-slate-400 hover:text-white hover:bg-slate-700"
                                                        )}
                                                        onClick={() => copyToClipboard(`<script src="${window.location.origin}/commentkit.js"></script>`, 'detail-script')}
                                                    >
                                                        {copiedItem === 'detail-script' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                                    </Button>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-xs font-medium text-slate-500 mb-2">2. Add the container</p>
                                                <div className="relative">
                                                    <pre className="bg-slate-900 text-slate-100 px-4 py-3 rounded-lg text-sm font-mono overflow-x-auto">
                                                        <code>{`<div data-commentkit></div>`}</code>
                                                    </pre>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className={cn(
                                                            "absolute top-2 right-2 h-7 transition-colors",
                                                            copiedItem === 'detail-container'
                                                                ? "text-green-400 hover:text-green-400"
                                                                : "text-slate-400 hover:text-white hover:bg-slate-700"
                                                        )}
                                                        onClick={() => copyToClipboard(`<div data-commentkit></div>`, 'detail-container')}
                                                    >
                                                        {copiedItem === 'detail-container' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Stats Overview */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="border-slate-200">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-500">Total Comments</p>
                                            <p className="text-2xl font-bold text-slate-800">{selectedSite.stats?.total_comments ?? 0}</p>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                                            <MessageSquare className="h-5 w-5 text-blue-600" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="border-slate-200">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-500">Pending Moderation</p>
                                            <p className="text-2xl font-bold text-orange-600">{selectedSite.stats?.pending_comments ?? 0}</p>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center">
                                            <AlertCircle className="h-5 w-5 text-orange-600" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="border-slate-200">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-500">Total Pages</p>
                                            <p className="text-2xl font-bold text-slate-800">{selectedSite.stats?.total_pages ?? 0}</p>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
                                            <FileText className="h-5 w-5 text-green-600" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {siteDetailTab === 'pages' && (
                    <div className="space-y-4">
                        <Card className="border-slate-200">
                            <CardContent className="p-8 text-center">
                                <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                                <h3 className="text-lg font-medium text-slate-800 mb-1">Pages</h3>
                                <p className="text-slate-500 text-sm">
                                    Pages are automatically created when visitors leave comments. You'll see them listed here.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {siteDetailTab === 'comments' && (
                    <div className="space-y-4">
                        {/* Filter Tabs */}
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

                        {/* Comments List */}
                        <Card className="border-slate-200">
                            {filteredComments.length === 0 ? (
                                <CardContent className="p-8 text-center">
                                    <CheckCircle2 className="h-12 w-12 text-green-300 mx-auto mb-3" />
                                    <h3 className="text-lg font-medium text-slate-800 mb-1">
                                        {commentFilter === 'pending' ? "All caught up!" : "No comments"}
                                    </h3>
                                    <p className="text-slate-500 text-sm">
                                        {commentFilter === 'pending'
                                            ? "No comments need moderation right now."
                                            : "No comments found with this filter."}
                                    </p>
                                </CardContent>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {filteredComments.map((comment) => (
                                        <div key={comment.id} className="p-4 hover:bg-slate-50 transition-colors">
                                            <div className="flex items-start gap-4">
                                                <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold uppercase shrink-0">
                                                    {comment.author_name ? comment.author_name[0] : 'A'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-semibold text-slate-800">{comment.author_name || 'Anonymous'}</span>
                                                        <span className="text-xs text-slate-400">• {new Date(comment.created_at).toLocaleDateString()}</span>
                                                        {comment.status === 'pending' && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">Pending</span>}
                                                        {comment.status === 'spam' && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Spam</span>}
                                                        {comment.status === 'approved' && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Approved</span>}
                                                    </div>
                                                    <p className="text-slate-600 text-sm leading-relaxed mb-3">
                                                        {comment.content}
                                                    </p>
                                                    <div className="flex items-center gap-2">
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
                        </Card>
                    </div>
                )}
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
            <AlertDialog open={showCreateForm} onOpenChange={setShowCreateForm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Create New Site</AlertDialogTitle>
                    </AlertDialogHeader>
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
                        <AlertDialogFooter>
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
                        </AlertDialogFooter>
                    </form>
                </AlertDialogContent>
            </AlertDialog>

            {/* Verification Instructions Dialog (shown after site creation) */}
            <AlertDialog open={showVerifyInstructions} onOpenChange={setShowVerifyInstructions}>
                <AlertDialogContent className="max-w-lg">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-blue-600" />
                            Verify Your Site
                        </AlertDialogTitle>
                    </AlertDialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">
                            To enable CommentKit on <span className="font-semibold text-slate-800">{newlyCreatedSiteDomain}</span>, verify that you own this domain by following these steps:
                        </p>

                        {postCreateVerificationInfo && (
                            <div className="space-y-4">
                                {/* Step 1 */}
                                <div className="flex gap-3">
                                    <div className="shrink-0 h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                                        1
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <p className="text-sm text-slate-700">
                                            Create a file at this path on your website:
                                        </p>
                                        <code className="block bg-slate-100 px-3 py-2 rounded text-sm font-mono text-slate-700">
                                            {postCreateVerificationInfo.verification_file_path}
                                        </code>
                                    </div>
                                </div>

                                {/* Step 2 */}
                                <div className="flex gap-3">
                                    <div className="shrink-0 h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                                        2
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <p className="text-sm text-slate-700">
                                            Add this verification token as the file content:
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 bg-slate-100 px-3 py-2 rounded text-sm font-mono text-slate-700 select-all truncate">
                                                {postCreateVerificationInfo.verification_token}
                                            </code>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className={cn(
                                                    "transition-colors",
                                                    copiedItem === 'token' && "text-green-600 border-green-300"
                                                )}
                                                onClick={() => copyToClipboard(postCreateVerificationInfo.verification_token, 'token')}
                                            >
                                                {copiedItem === 'token' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Step 3 */}
                                <div className="flex gap-3">
                                    <div className="shrink-0 h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                                        3
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <p className="text-sm text-slate-700">
                                            Click "Verify" below to check if the file is accessible.
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4">
                                    <p className="text-xs text-amber-700">
                                        <strong>Note:</strong> Your site must be verified before CommentKit will work on non-localhost domains.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Success message */}
                        {postCreateVerified && (
                            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-3">
                                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-green-800">Site verified successfully!</p>
                                    <p className="text-xs text-green-600">CommentKit is now enabled for {newlyCreatedSiteDomain}</p>
                                </div>
                            </div>
                        )}

                        {/* Error message */}
                        {postCreateVerifyError && !postCreateVerified && (
                            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                <p className="text-sm text-red-700">{postCreateVerifyError}</p>
                            </div>
                        )}
                    </div>
                    <AlertDialogFooter>
                        {postCreateVerified ? (
                            <Button onClick={goToIntegrationInstructions}>
                                Next
                            </Button>
                        ) : (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={goToIntegrationInstructions}
                                    disabled={postCreateVerifying}
                                >
                                    Skip
                                </Button>
                                <Button
                                    onClick={handlePostCreateVerify}
                                    disabled={postCreateVerifying}
                                    className="gap-2"
                                >
                                    {postCreateVerifying ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Verifying...
                                        </>
                                    ) : postCreateVerifyError ? (
                                        'Retry'
                                    ) : (
                                        'Verify'
                                    )}
                                </Button>
                            </>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Integration Instructions Dialog */}
            <AlertDialog open={showIntegrationInstructions} onOpenChange={setShowIntegrationInstructions}>
                <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Globe className="h-5 w-5 text-blue-600" />
                            Add CommentKit to Your Site
                        </AlertDialogTitle>
                    </AlertDialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">
                            Add the following code to your website to enable comments on <span className="font-semibold text-slate-800">{newlyCreatedSiteDomain}</span>:
                        </p>

                        {/* Step 1: Add Script */}
                        <div className="flex gap-3">
                            <div className="shrink-0 h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                                1
                            </div>
                            <div className="flex-1 space-y-2">
                                <p className="text-sm text-slate-700 font-medium">
                                    Add the CommentKit script to your HTML
                                </p>
                                <p className="text-xs text-slate-500">
                                    Place this in the <code className="bg-slate-100 px-1 rounded">&lt;head&gt;</code> or before the closing <code className="bg-slate-100 px-1 rounded">&lt;/body&gt;</code> tag:
                                </p>
                                <div className="relative">
                                    <pre className="bg-slate-900 text-slate-100 px-4 py-3 rounded-lg text-sm font-mono overflow-x-auto break-all whitespace-pre-wrap">
                                        <code>{`<script src="${window.location.origin}/commentkit.js"></script>`}</code>
                                    </pre>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className={cn(
                                            "absolute top-2 right-2 h-7 transition-colors",
                                            copiedItem === 'script'
                                                ? "text-green-400 hover:text-green-400"
                                                : "text-slate-400 hover:text-white hover:bg-slate-700"
                                        )}
                                        onClick={() => copyToClipboard(`<script src="${window.location.origin}/commentkit.js"></script>`, 'script')}
                                    >
                                        {copiedItem === 'script' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Step 2: Add Container */}
                        <div className="flex gap-3">
                            <div className="shrink-0 h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                                2
                            </div>
                            <div className="flex-1 space-y-2">
                                <p className="text-sm text-slate-700 font-medium">
                                    Add a container element where you want comments to appear
                                </p>
                                <div className="relative">
                                    <pre className="bg-slate-900 text-slate-100 px-4 py-3 rounded-lg text-sm font-mono overflow-x-auto break-all whitespace-pre-wrap">
                                        <code>{`<div data-commentkit></div>`}</code>
                                    </pre>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className={cn(
                                            "absolute top-2 right-2 h-7 transition-colors",
                                            copiedItem === 'container'
                                                ? "text-green-400 hover:text-green-400"
                                                : "text-slate-400 hover:text-white hover:bg-slate-700"
                                        )}
                                        onClick={() => copyToClipboard(`<div data-commentkit></div>`, 'container')}
                                    >
                                        {copiedItem === 'container' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-4">
                            <p className="text-xs text-green-700">
                                <strong>That's it!</strong> CommentKit will automatically initialize when it finds the container element.
                            </p>
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <Button onClick={closeAllOnboardingDialogs}>
                            Done
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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
                                {site.verified ? (
                                    <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                        <ShieldCheck className="h-3 w-3" /> Verified
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                                        <ShieldAlert className="h-3 w-3" /> Unverified
                                    </span>
                                )}
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
