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
    ChevronRight
} from 'lucide-react';
import { cn, formatTimeAgo } from '@/lib/utils';

export function OverviewTab() {
    const { currentSite, refreshSites } = useSite();
    const [loading, setLoading] = useState(true);
    const [pendingComments, setPendingComments] = useState<Comment[]>([]);
    const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
    const [recentPages, setRecentPages] = useState<PageWithStats[]>([]);

    const loadData = async () => {
        if (!currentSite) return;
        setLoading(true);

        // Load all data in parallel
        const [siteData, activityData, pagesData] = await Promise.all([
            sitesApi.get(currentSite.id, { comment_status: 'pending', comment_limit: 5 }),
            sitesApi.getActivity(currentSite.id, 10),
            sitesApi.getPages(currentSite.id, { limit: 5, sort: 'latest_comment' })
        ]);

        if (siteData.data) {
            setPendingComments(siteData.data.comments || []);
        }

        if (activityData.data) {
            setRecentActivity(activityData.data.activity || []);
        }

        if (pagesData.data) {
            setRecentPages(pagesData.data.pages || []);
        }

        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [currentSite]);

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

    if (!currentSite) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center space-y-3">
                    <AlertCircle className="h-12 w-12 text-slate-400 mx-auto" />
                    <div className="text-lg font-medium text-slate-900">No site selected</div>
                    <p className="text-slate-600">Please select a site from the dropdown to view your overview</p>
                </div>
            </div>
        );
    }

    const stats = currentSite.stats;

    return (
        <div className="space-y-8">
            {/* Welcome Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Overview</h1>
                <p className="text-base text-slate-600 mt-2">
                    Activity and moderation for <span className="font-semibold text-slate-900">{currentSite.name}</span>
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="hover:shadow-md transition-shadow border-slate-200">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-slate-600">Total Comments</p>
                                <p className="text-3xl font-bold text-slate-900">{stats.total_comments}</p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center">
                                <MessageSquare className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow border-slate-200">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-slate-600">Needs Moderation</p>
                                <p className="text-3xl font-bold text-orange-600">{stats.pending_comments}</p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-orange-50 flex items-center justify-center">
                                <Clock className="h-6 w-6 text-orange-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow border-slate-200">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-slate-600">Total Pages</p>
                                <p className="text-3xl font-bold text-slate-900">{stats.total_pages}</p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center">
                                <FileText className="h-6 w-6 text-green-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow border-slate-200">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-slate-600">Total Likes</p>
                                <p className="text-3xl font-bold text-slate-900">{stats.total_likes}</p>
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
                                <CardContent className="p-5">
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
