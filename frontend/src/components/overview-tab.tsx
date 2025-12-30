import { useState, useEffect } from 'react';
import { useSite } from '@/lib/site-context';
import { sites as sitesApi, comments as commentsApi, type Comment, type PageWithStats, type ActivityItem } from '@/lib/api';
import { CommentCard } from '@/components/comment-card';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    MessageSquare,
    Heart,
    FileText,
    AlertCircle,
    TrendingUp,
    Clock,
    CheckCircle2,
    ExternalLink,
    ChevronRight,
    Plus,
    Globe
} from 'lucide-react';
import { cn, formatTimeAgo } from '@/lib/utils';

interface OverviewTabProps {
    onNavigateToSites?: () => void;
}

// Extended types for aggregated views with site information
type CommentWithSite = Comment & { _siteName?: string };
type ActivityItemWithSite = ActivityItem & { _siteName?: string };
type PageWithSite = PageWithStats & { _siteName?: string };

export function OverviewTab({ onNavigateToSites }: OverviewTabProps = {}) {
    const { currentSite, sites, refreshSites } = useSite();
    const [loading, setLoading] = useState(true);
    const [pendingComments, setPendingComments] = useState<CommentWithSite[]>([]);
    const [recentActivity, setRecentActivity] = useState<ActivityItemWithSite[]>([]);
    const [recentPages, setRecentPages] = useState<PageWithSite[]>([]);

    const loadData = async () => {
        if (sites.length === 0) return;
        setLoading(true);

        // Load data from ALL sites and aggregate
        const allSitePromises = sites.map(async (site) => {
            const [siteData, activityData, pagesData] = await Promise.all([
                sitesApi.get(site.id, { comment_status: 'pending', comment_limit: 100 }),
                sitesApi.getActivity(site.id, 100),
                sitesApi.getPages(site.id, { limit: 100, sort: 'latest_comment' })
            ]);

            return {
                siteId: site.id,
                siteName: site.name,
                comments: siteData.data?.comments || [],
                activity: activityData.data?.activity || [],
                pages: pagesData.data?.pages || []
            };
        });

        const allSiteData = await Promise.all(allSitePromises);

        // Aggregate pending comments from all sites and sort by date
        const allPendingComments = allSiteData
            .flatMap(data => data.comments.map(c => ({ ...c, _siteName: data.siteName })))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 10); // Show top 10 most recent

        // Aggregate activity from all sites and sort by date
        const allActivity = allSiteData
            .flatMap(data => data.activity.map(a => ({ ...a, _siteName: data.siteName })))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 10); // Show top 10 most recent

        // Aggregate pages from all sites and sort by latest comment
        const allPages = allSiteData
            .flatMap(data => data.pages.map(p => ({ ...p, _siteName: data.siteName })))
            .sort((a, b) => {
                const aTime = a.latest_comment_at ? new Date(a.latest_comment_at).getTime() : 0;
                const bTime = b.latest_comment_at ? new Date(b.latest_comment_at).getTime() : 0;
                return bTime - aTime;
            })
            .slice(0, 9); // Show top 9 most active

        setPendingComments(allPendingComments);
        setRecentActivity(allActivity);
        setRecentPages(allPages);

        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [sites]);

    const handleQuickModerate = async (commentId: number, action: 'approve' | 'reject') => {
        const { data, error } = await commentsApi.updateStatus(
            commentId,
            action === 'approve' ? 'approved' : 'rejected'
        );

        if (data && !error) {
            await loadData();
            await refreshSites();
        }
    };

    if (sites.length === 0) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center space-y-4">
                    <div className="h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
                        <Globe className="h-8 w-8 text-blue-600" />
                    </div>
                    <div className="space-y-2">
                        <div className="text-xl font-semibold text-slate-900">Welcome to CommentKit</div>
                        <p className="text-slate-600 max-w-sm">
                            Get started by creating your first site to enable comments on your website.
                        </p>
                    </div>
                    <Button onClick={onNavigateToSites} className="gap-2">
                        <Plus className="h-4 w-4" /> Create Your First Site
                    </Button>
                </div>
            </div>
        );
    }

    // Aggregate stats from all sites
    const aggregatedStats = sites.reduce((acc, site) => ({
        total_comments: acc.total_comments + (site.stats?.total_comments || 0),
        pending_comments: acc.pending_comments + (site.stats?.pending_comments || 0),
        total_pages: acc.total_pages + (site.stats?.total_pages || 0),
        total_likes: acc.total_likes + (site.stats?.total_likes || 0),
    }), {
        total_comments: 0,
        pending_comments: 0,
        total_pages: 0,
        total_likes: 0,
    });

    return (
        <div className="space-y-4">
            {/* Welcome Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Overview</h1>
                <p className="text-base text-slate-600 mt-2">
                    Activity and moderation across <span className="font-semibold text-slate-900">All Sites</span> ({sites.length} {sites.length === 1 ? 'site' : 'sites'})
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="hover:shadow-md transition-shadow border-slate-200">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-slate-600">Total Comments</p>
                                <p className="text-3xl font-bold text-slate-900">{aggregatedStats.total_comments}</p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center">
                                <MessageSquare className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow border-slate-200">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-slate-600">Needs Moderation</p>
                                <p className="text-3xl font-bold text-orange-600">{aggregatedStats.pending_comments}</p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-orange-50 flex items-center justify-center">
                                <Clock className="h-6 w-6 text-orange-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow border-slate-200">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-slate-600">Total Pages</p>
                                <p className="text-3xl font-bold text-slate-900">{aggregatedStats.total_pages}</p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center">
                                <FileText className="h-6 w-6 text-green-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow border-slate-200">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-slate-600">Total Likes</p>
                                <p className="text-3xl font-bold text-slate-900">{aggregatedStats.total_likes}</p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-pink-50 flex items-center justify-center">
                                <Heart className="h-6 w-6 text-pink-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Pending Moderation */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-900">Needs Moderation</h2>
                        {pendingComments.length > 0 && (
                            <span className="text-sm text-slate-600">{pendingComments.length} pending</span>
                        )}
                    </div>

                    <div className="space-y-3">
                        {loading ? (
                            <Card className="border-slate-200">
                                <CardContent className="p-8 text-center text-slate-500">
                                    Loading...
                                </CardContent>
                            </Card>
                        ) : pendingComments.length === 0 ? (
                            <Card className="border-slate-200">
                                <CardContent className="p-8 text-center">
                                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                                    <p className="text-slate-900 font-medium">All caught up!</p>
                                    <p className="text-sm text-slate-600 mt-1">No comments need moderation</p>
                                </CardContent>
                            </Card>
                        ) : (
                            pendingComments.map((comment) => (
                                <CommentCard
                                    key={comment.id}
                                    comment={comment}
                                    siteName={comment._siteName}
                                    showActions
                                    onApprove={(id) => handleQuickModerate(id, 'approve')}
                                    onReject={(id) => handleQuickModerate(id, 'reject')}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-slate-900">Recent Activity</h2>

                    <Card className="border-slate-200">
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="p-8 text-center text-slate-500">Loading...</div>
                            ) : recentActivity.length === 0 ? (
                                <div className="p-8 text-center">
                                    <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                                    <p className="text-slate-600">No recent activity</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {recentActivity.map((item, idx) => (
                                        <div key={idx} className="p-4 hover:bg-slate-50 transition-colors">
                                            <div className="flex gap-3">
                                                <Avatar
                                                    emailHash={item.author_email_hash}
                                                    name={item.author_name}
                                                    size="md"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-900">
                                                        {item.author_name || 'Anonymous'} {item.type === 'reply' ? 'replied' : 'commented'} on{' '}
                                                        <span className="text-blue-600">{item.page_title || item.page_slug}</span>
                                                    </p>
                                                    {item._siteName && (
                                                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 mt-1">
                                                            <span>{item._siteName}</span>
                                                        </div>
                                                    )}
                                                    <p className="text-sm text-slate-600 mt-1 line-clamp-2">{item.content}</p>
                                                    <p className="text-xs text-slate-500 mt-1">{formatTimeAgo(item.created_at)}</p>
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

            {/* Recent Pages */}
            <div className="space-y-4">
                <h2 className="text-xl font-bold text-slate-900">Active Pages</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {loading ? (
                        <Card className="border-slate-200">
                            <CardContent className="p-6 text-center text-slate-500">Loading...</CardContent>
                        </Card>
                    ) : recentPages.length === 0 ? (
                        <Card className="border-slate-200">
                            <CardContent className="p-8 text-center">
                                <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-600">No pages yet</p>
                            </CardContent>
                        </Card>
                    ) : (
                        recentPages.map((page) => (
                            <Card key={page.id} className="hover:shadow-md transition-all border-slate-200 group">
                                <CardContent className="p-4">
                                    <div className="space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="font-semibold text-slate-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                                                {page.title || page.slug}
                                            </h3>
                                            {page.url && (
                                                <a
                                                    href={page.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="shrink-0 text-slate-400 hover:text-blue-600 transition-colors"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                            )}
                                        </div>

                                        {page._siteName && (
                                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                                <span>{page._siteName}</span>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-4 text-sm text-slate-600">
                                            <div className="flex items-center gap-1.5">
                                                <MessageSquare className="h-4 w-4" />
                                                <span>{page.comment_count} comments</span>
                                            </div>
                                            {page.pending_count > 0 && (
                                                <div className="flex items-center gap-1.5 text-orange-600">
                                                    <Clock className="h-4 w-4" />
                                                    <span>{page.pending_count} pending</span>
                                                </div>
                                            )}
                                        </div>

                                        {page.latest_comment_at && (
                                            <p className="text-xs text-slate-500">
                                                Last activity {formatTimeAgo(page.latest_comment_at)}
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
