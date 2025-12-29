import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { sites, type SitePreviewWithStats, type SiteStats } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function OverviewTab() {
    const { consumeBootstrap } = useAuth();
    const [siteList, setSiteList] = useState<SitePreviewWithStats[]>([]);
    const [stats, setStats] = useState<SiteStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            // Try to use cached bootstrap data from auth (saves API call on initial load)
            const bootstrap = consumeBootstrap();
            if (bootstrap) {
                setSiteList(bootstrap.sites);
                setStats(bootstrap.aggregated);
                setLoading(false);
                return;
            }

            // Fallback: fetch from API (e.g., when navigating back to overview)
            const { data } = await sites.overview();
            if (data) {
                setSiteList(data.sites);
                setStats(data.aggregated);
            }
            setLoading(false);
        };

        loadData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Loading...</div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold mb-2">Dashboard Overview</h2>
                <p className="text-muted-foreground">
                    Your sites and engagement at a glance
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Sites</CardDescription>
                        <CardTitle className="text-3xl">{siteList.length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Pages</CardDescription>
                        <CardTitle className="text-3xl">{stats?.total_pages ?? 0}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Comments</CardDescription>
                        <CardTitle className="text-3xl">{stats?.total_comments ?? 0}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className={stats?.pending_comments ? 'border-orange-500' : ''}>
                    <CardHeader className="pb-2">
                        <CardDescription>Pending Moderation</CardDescription>
                        <CardTitle className="text-3xl">
                            {stats?.pending_comments ?? 0}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Sites List Preview */}
            {siteList.length > 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Your Sites</CardTitle>
                        <CardDescription>
                            Quick overview of your registered sites
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {siteList.slice(0, 5).map((site) => (
                                <div
                                    key={site.id}
                                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                                >
                                    <div>
                                        <div className="font-medium">{site.name}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {site.domain}
                                        </div>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {new Date(site.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground mb-4">
                            You haven't created any sites yet.
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Go to "My Sites" to create your first site.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
