import { useEffect, useState } from 'react';
import { sites, comments as commentsApi, type SitePreview, type SiteDetail, type SiteStats, type Comment } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export function SitesTab() {
    const [siteList, setSiteList] = useState<SitePreview[]>([]);
    const [selectedSite, setSelectedSite] = useState<SiteDetail | null>(null);
    const [siteStats, setSiteStats] = useState<SiteStats | null>(null);
    const [siteComments, setSiteComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);

    // Create form state
    const [newSiteName, setNewSiteName] = useState('');
    const [newSiteDomain, setNewSiteDomain] = useState('');
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState('');

    // Comments filter
    const [commentFilter, setCommentFilter] = useState<string>('all');

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

    const loadSiteDetails = async (siteId: number) => {
        const [detailRes, statsRes, commentsRes] = await Promise.all([
            sites.get(siteId),
            sites.stats(siteId),
            sites.comments(siteId, { limit: 50 }),
        ]);

        if (detailRes.data) setSelectedSite(detailRes.data);
        if (statsRes.data) setSiteStats(statsRes.data);
        if (commentsRes.data) setSiteComments(commentsRes.data.comments);
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
        if (selectedSite) {
            await loadSiteDetails(selectedSite.id);
        }
    };

    const handleDeleteComment = async (commentId: number) => {
        if (!confirm('Delete this comment?')) return;
        await commentsApi.delete(commentId);
        if (selectedSite) {
            await loadSiteDetails(selectedSite.id);
        }
    };

    const filteredComments = siteComments.filter(
        (c) => commentFilter === 'all' || c.status === commentFilter
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Loading...</div>
            </div>
        );
    }

    // Site detail view
    if (selectedSite) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => setSelectedSite(null)}>
                        ← Back to sites
                    </Button>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Site Info */}
                    <Card className="lg:col-span-1">
                        <CardHeader>
                            <CardTitle>{selectedSite.name}</CardTitle>
                            <CardDescription>{selectedSite.domain}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label className="text-xs text-muted-foreground">API Key</Label>
                                <div className="flex gap-2 mt-1">
                                    <Input
                                        value={selectedSite.api_key}
                                        readOnly
                                        className="font-mono text-xs"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => navigator.clipboard.writeText(selectedSite.api_key)}
                                    >
                                        Copy
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div className="p-3 rounded-lg bg-muted">
                                    <div className="text-2xl font-bold">{siteStats?.total_pages || 0}</div>
                                    <div className="text-xs text-muted-foreground">Pages</div>
                                </div>
                                <div className="p-3 rounded-lg bg-muted">
                                    <div className="text-2xl font-bold">{siteStats?.total_comments || 0}</div>
                                    <div className="text-xs text-muted-foreground">Comments</div>
                                </div>
                                <div className="p-3 rounded-lg bg-muted">
                                    <div className="text-2xl font-bold">{siteStats?.pending_comments || 0}</div>
                                    <div className="text-xs text-muted-foreground">Pending</div>
                                </div>
                                <div className="p-3 rounded-lg bg-muted">
                                    <div className="text-2xl font-bold">{siteStats?.total_likes || 0}</div>
                                    <div className="text-xs text-muted-foreground">Likes</div>
                                </div>
                            </div>

                            <div className="space-y-2 pt-4 border-t">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => handleRegenerateKey(selectedSite.id)}
                                >
                                    Regenerate API Key
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => handleDeleteSite(selectedSite.id)}
                                >
                                    Delete Site
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Comments */}
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Comments</CardTitle>
                                    <CardDescription>Moderate comments on this site</CardDescription>
                                </div>
                                <Select value={commentFilter} onValueChange={setCommentFilter}>
                                    <SelectTrigger className="w-32">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="approved">Approved</SelectItem>
                                        <SelectItem value="rejected">Rejected</SelectItem>
                                        <SelectItem value="spam">Spam</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {filteredComments.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">
                                    No comments found
                                </p>
                            ) : (
                                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                                    {filteredComments.map((comment) => (
                                        <div
                                            key={comment.id}
                                            className="p-4 rounded-lg border bg-card"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="font-medium">
                                                            {comment.author_name || 'Anonymous'}
                                                        </span>
                                                        <span
                                                            className={`text-xs px-2 py-0.5 rounded-full ${comment.status === 'approved'
                                                                    ? 'bg-green-100 text-green-700'
                                                                    : comment.status === 'pending'
                                                                        ? 'bg-yellow-100 text-yellow-700'
                                                                        : comment.status === 'spam'
                                                                            ? 'bg-red-100 text-red-700'
                                                                            : 'bg-gray-100 text-gray-700'
                                                                }`}
                                                        >
                                                            {comment.status}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {new Date(comment.created_at).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm">{comment.content}</p>
                                                </div>
                                                <div className="flex gap-1">
                                                    {comment.status !== 'approved' && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-green-600"
                                                            onClick={() => handleModerateComment(comment.id, 'approved')}
                                                        >
                                                            ✓
                                                        </Button>
                                                    )}
                                                    {comment.status !== 'rejected' && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-orange-600"
                                                            onClick={() => handleModerateComment(comment.id, 'rejected')}
                                                        >
                                                            ✗
                                                        </Button>
                                                    )}
                                                    {comment.status !== 'spam' && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-red-600"
                                                            onClick={() => handleModerateComment(comment.id, 'spam')}
                                                        >
                                                            🚫
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-destructive"
                                                        onClick={() => handleDeleteComment(comment.id)}
                                                    >
                                                        🗑
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    // Sites list view
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">My Sites</h2>
                    <p className="text-muted-foreground">
                        Manage your registered sites
                    </p>
                </div>
                <Button onClick={() => setShowCreateForm(true)}>
                    + Create Site
                </Button>
            </div>

            {/* Create Form Modal */}
            {showCreateForm && (
                <Card>
                    <CardHeader>
                        <CardTitle>Create New Site</CardTitle>
                        <CardDescription>
                            Register a new site to enable comments
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreateSite} className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
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
                            </div>
                            {createError && (
                                <p className="text-sm text-destructive">{createError}</p>
                            )}
                            <div className="flex gap-2">
                                <Button type="submit" disabled={createLoading}>
                                    {createLoading ? 'Creating...' : 'Create Site'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setShowCreateForm(false)}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Sites Grid */}
            {siteList.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground mb-4">
                            You haven't created any sites yet.
                        </p>
                        <Button onClick={() => setShowCreateForm(true)}>
                            Create your first site
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {siteList.map((site) => (
                        <Card
                            key={site.id}
                            className="cursor-pointer hover:border-primary transition-colors"
                            onClick={() => loadSiteDetails(site.id)}
                        >
                            <CardHeader>
                                <CardTitle className="text-lg">{site.name}</CardTitle>
                                <CardDescription>{site.domain}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xs text-muted-foreground">
                                    API Key: {site.api_key_preview}...
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    Created {new Date(site.created_at).toLocaleDateString()}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
