import { useEffect, useState } from 'react';
import {
    superadmin,
    type GlobalStats,
    type AdminUser,
    type AdminSite,
    type Comment,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

type AdminView = 'overview' | 'users' | 'sites' | 'comments';

export function AdminTab() {
    const [view, setView] = useState<AdminView>('overview');
    const [stats, setStats] = useState<GlobalStats | null>(null);
    const [loading, setLoading] = useState(true);

    // Users state
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [usersTotal, setUsersTotal] = useState(0);
    const [userSearch, setUserSearch] = useState('');

    // Sites state
    const [sites, setSites] = useState<AdminSite[]>([]);
    const [sitesTotal, setSitesTotal] = useState(0);
    const [siteSearch, setSiteSearch] = useState('');

    // Comments state
    const [comments, setComments] = useState<Comment[]>([]);
    const [commentsTotal, setCommentsTotal] = useState(0);
    const [commentFilter, setCommentFilter] = useState<string>('all');

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        const { data } = await superadmin.stats();
        if (data) setStats(data);
        setLoading(false);
    };

    const loadUsers = async (search?: string) => {
        const { data } = await superadmin.users({ limit: 50, search });
        if (data) {
            setUsers(data.users);
            setUsersTotal(data.total);
        }
    };

    const loadSites = async (search?: string) => {
        const { data } = await superadmin.sites({ limit: 50, search });
        if (data) {
            setSites(data.sites);
            setSitesTotal(data.total);
        }
    };

    const loadComments = async (status?: string) => {
        const { data } = await superadmin.comments({
            limit: 50,
            status: status === 'all' ? undefined : status,
        });
        if (data) {
            setComments(data.comments);
            setCommentsTotal(data.total);
        }
    };

    const handleViewChange = async (newView: AdminView) => {
        setView(newView);
        if (newView === 'users' && users.length === 0) {
            await loadUsers();
        } else if (newView === 'sites' && sites.length === 0) {
            await loadSites();
        } else if (newView === 'comments' && comments.length === 0) {
            await loadComments();
        }
    };

    const handleToggleAdmin = async (userId: number, currentStatus: boolean) => {
        const action = currentStatus ? 'remove admin privileges from' : 'grant admin privileges to';
        if (!confirm(`Are you sure you want to ${action} this user?`)) return;

        const { error } = await superadmin.setUserAdmin(userId, !currentStatus);
        if (!error) {
            await loadUsers(userSearch || undefined);
        }
    };

    const handleDeleteUser = async (userId: number) => {
        if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return;

        const { error } = await superadmin.deleteUser(userId);
        if (!error) {
            await loadUsers(userSearch || undefined);
            await loadStats();
        }
    };

    const handleDeleteSite = async (siteId: number) => {
        if (!confirm('Are you sure you want to delete this site and all its data? This cannot be undone.')) return;

        const { error } = await superadmin.deleteSite(siteId);
        if (!error) {
            await loadSites(siteSearch || undefined);
            await loadStats();
        }
    };

    const handleModerateComment = async (commentId: number, status: 'approved' | 'rejected' | 'spam') => {
        const { error } = await superadmin.updateCommentStatus(commentId, status);
        if (!error) {
            await loadComments(commentFilter === 'all' ? undefined : commentFilter);
            await loadStats();
        }
    };

    const handleDeleteComment = async (commentId: number) => {
        if (!confirm('Delete this comment?')) return;

        const { error } = await superadmin.deleteComment(commentId);
        if (!error) {
            await loadComments(commentFilter === 'all' ? undefined : commentFilter);
            await loadStats();
        }
    };

    const handleUserSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        await loadUsers(userSearch || undefined);
    };

    const handleSiteSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        await loadSites(siteSearch || undefined);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Loading...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold mb-2">Admin Panel</h2>
                <p className="text-muted-foreground">
                    Platform-wide management and analytics
                </p>
            </div>

            {/* Navigation */}
            <div className="flex gap-2 border-b pb-4">
                <Button
                    variant={view === 'overview' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => handleViewChange('overview')}
                >
                    Overview
                </Button>
                <Button
                    variant={view === 'users' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => handleViewChange('users')}
                >
                    Users ({stats?.total_users || 0})
                </Button>
                <Button
                    variant={view === 'sites' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => handleViewChange('sites')}
                >
                    Sites ({stats?.total_sites || 0})
                </Button>
                <Button
                    variant={view === 'comments' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => handleViewChange('comments')}
                >
                    Comments ({stats?.total_comments || 0})
                </Button>
            </div>

            {/* Overview View */}
            {view === 'overview' && (
                <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Total Users</CardDescription>
                                <CardTitle className="text-3xl">{stats?.total_users || 0}</CardTitle>
                            </CardHeader>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Total Sites</CardDescription>
                                <CardTitle className="text-3xl">{stats?.total_sites || 0}</CardTitle>
                            </CardHeader>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Total Pages</CardDescription>
                                <CardTitle className="text-3xl">{stats?.total_pages || 0}</CardTitle>
                            </CardHeader>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Total Comments</CardDescription>
                                <CardTitle className="text-3xl">{stats?.total_comments || 0}</CardTitle>
                            </CardHeader>
                        </Card>
                        <Card className={stats?.pending_comments ? 'border-orange-500' : ''}>
                            <CardHeader className="pb-2">
                                <CardDescription>Pending Moderation</CardDescription>
                                <CardTitle className="text-3xl">{stats?.pending_comments || 0}</CardTitle>
                            </CardHeader>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Total Likes</CardDescription>
                                <CardTitle className="text-3xl">{stats?.total_likes || 0}</CardTitle>
                            </CardHeader>
                        </Card>
                    </div>
                </div>
            )}

            {/* Users View */}
            {view === 'users' && (
                <div className="space-y-4">
                    <form onSubmit={handleUserSearch} className="flex gap-2">
                        <Input
                            placeholder="Search by email..."
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            className="max-w-sm"
                        />
                        <Button type="submit" variant="secondary">Search</Button>
                        {userSearch && (
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                    setUserSearch('');
                                    loadUsers();
                                }}
                            >
                                Clear
                            </Button>
                        )}
                    </form>

                    <Card>
                        <CardHeader>
                            <CardTitle>Users</CardTitle>
                            <CardDescription>
                                {usersTotal} total users
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {users.map((user) => (
                                    <div
                                        key={user.id}
                                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium truncate">
                                                    {user.display_name || user.email}
                                                </span>
                                                {user.is_admin && (
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                                                        Admin
                                                    </span>
                                                )}
                                                {user.email_verified && (
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                                        Verified
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm text-muted-foreground truncate">
                                                {user.email}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Joined {new Date(user.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button
                                                size="sm"
                                                variant={user.is_admin ? 'outline' : 'secondary'}
                                                onClick={() => handleToggleAdmin(user.id, user.is_admin)}
                                            >
                                                {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => handleDeleteUser(user.id)}
                                                disabled={user.is_admin}
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {users.length === 0 && (
                                    <p className="text-muted-foreground text-center py-8">
                                        No users found
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Sites View */}
            {view === 'sites' && (
                <div className="space-y-4">
                    <form onSubmit={handleSiteSearch} className="flex gap-2">
                        <Input
                            placeholder="Search by name or domain..."
                            value={siteSearch}
                            onChange={(e) => setSiteSearch(e.target.value)}
                            className="max-w-sm"
                        />
                        <Button type="submit" variant="secondary">Search</Button>
                        {siteSearch && (
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                    setSiteSearch('');
                                    loadSites();
                                }}
                            >
                                Clear
                            </Button>
                        )}
                    </form>

                    <Card>
                        <CardHeader>
                            <CardTitle>Sites</CardTitle>
                            <CardDescription>
                                {sitesTotal} total sites
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {sites.map((site) => (
                                    <div
                                        key={site.id}
                                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium">{site.name}</div>
                                            <div className="text-sm text-muted-foreground">
                                                {site.domain}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Owner: {site.owner_email} | Created {new Date(site.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => handleDeleteSite(site.id)}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                ))}
                                {sites.length === 0 && (
                                    <p className="text-muted-foreground text-center py-8">
                                        No sites found
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Comments View */}
            {view === 'comments' && (
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <Select
                            value={commentFilter}
                            onValueChange={(value) => {
                                setCommentFilter(value);
                                loadComments(value === 'all' ? undefined : value);
                            }}
                        >
                            <SelectTrigger className="w-40">
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

                    <Card>
                        <CardHeader>
                            <CardTitle>Comments</CardTitle>
                            <CardDescription>
                                {commentsTotal} total comments
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4 max-h-[600px] overflow-y-auto">
                                {comments.map((comment) => (
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
                                                        className={`text-xs px-2 py-0.5 rounded-full ${
                                                            comment.status === 'approved'
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
                                                        Site #{comment.site_id}
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
                                                        Approve
                                                    </Button>
                                                )}
                                                {comment.status !== 'rejected' && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-orange-600"
                                                        onClick={() => handleModerateComment(comment.id, 'rejected')}
                                                    >
                                                        Reject
                                                    </Button>
                                                )}
                                                {comment.status !== 'spam' && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-red-600"
                                                        onClick={() => handleModerateComment(comment.id, 'spam')}
                                                    >
                                                        Spam
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => handleDeleteComment(comment.id)}
                                                >
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {comments.length === 0 && (
                                    <p className="text-muted-foreground text-center py-8">
                                        No comments found
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
