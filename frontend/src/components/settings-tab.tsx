import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { auth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function SettingsTab() {
    const { user, logout, updateUser } = useAuth();
    const [displayName, setDisplayName] = useState(user?.display_name || '');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSave = async () => {
        if (!displayName.trim()) {
            setMessage({ type: 'error', text: 'Display name cannot be empty' });
            return;
        }

        setSaving(true);
        setMessage(null);

        const { data, error } = await auth.updateProfile({ display_name: displayName.trim() });

        if (error) {
            setMessage({ type: 'error', text: error });
        } else if (data) {
            updateUser(data);
            setMessage({ type: 'success', text: 'Profile updated successfully' });
        }

        setSaving(false);
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h2 className="text-2xl font-bold">Settings</h2>
                <p className="text-muted-foreground">
                    Manage your account settings
                </p>
            </div>

            {/* Profile Settings */}
            <Card>
                <CardHeader>
                    <CardTitle>Profile</CardTitle>
                    <CardDescription>
                        Your public profile information
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            value={user?.email || '?'}
                            disabled
                            className="bg-muted"
                        />
                        <p className="text-xs text-muted-foreground">
                            Your email cannot be changed
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="display-name">Display Name</Label>
                        <Input
                            id="display-name"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Your display name"
                        />
                    </div>
                    {message && (
                        <p className={`text-sm ${message.type === 'error' ? 'text-destructive' : 'text-green-600'}`}>
                            {message.text}
                        </p>
                    )}
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </CardContent>
            </Card>

            {/* Account Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>Account</CardTitle>
                    <CardDescription>
                        Manage your account
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                        <div>
                            <div className="font-medium">Sign out</div>
                            <div className="text-sm text-muted-foreground">
                                Sign out of your account on this device
                            </div>
                        </div>
                        <Button variant="outline" onClick={logout}>
                            Sign out
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* API Integration Help */}
            <Card>
                <CardHeader>
                    <CardTitle>API Integration</CardTitle>
                    <CardDescription>
                        How to integrate CommentKit into your site
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <h4 className="font-medium">1. Create a site</h4>
                        <p className="text-sm text-muted-foreground">
                            Go to "My Sites" and create a new site with your domain.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-medium">2. Get your API key</h4>
                        <p className="text-sm text-muted-foreground">
                            Copy the API key from your site details.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-medium">3. Integrate the widget</h4>
                        <p className="text-sm text-muted-foreground">
                            Add the CommentKit widget to your pages:
                        </p>
                        <pre className="p-4 rounded-lg bg-muted text-xs overflow-x-auto">
                            {`<div id="commentkit"></div>
<script
  src="https://commentkit.io/widget.js"
  data-site-id="YOUR_SITE_ID"
></script>`}
                        </pre>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
