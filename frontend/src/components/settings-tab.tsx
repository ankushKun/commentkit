import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { auth as authApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar } from '@/components/ui/avatar';
import { User, Mail, Save, Loader2 } from 'lucide-react';

export function SettingsTab() {
    const { user } = useAuth();
    const [displayName, setDisplayName] = useState(user?.display_name || '');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);

        const { data, error } = await authApi.updateProfile({ display_name: displayName });

        if (data && !error) {
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            // Reload page to refresh user data
            setTimeout(() => window.location.reload(), 1000);
        } else {
            setMessage({ type: 'error', text: error || 'Failed to update profile' });
        }

        setSaving(false);
    };

    return (
        <div className="space-y-8 max-w-4xl">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
                <p className="text-base text-slate-600 mt-2">
                    Manage your account settings and preferences
                </p>
            </div>

            {/* Profile Section */}
            <Card className="border-slate-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Profile
                    </CardTitle>
                    <CardDescription>
                        Update your personal information
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Avatar */}
                    <div className="flex items-center gap-6">
                        <Avatar
                            emailHash={user?.email_hash}
                            name={user?.display_name || user?.email}
                            size="lg"
                            className="ring-4 ring-slate-100"
                        />
                        <div>
                            <p className="text-sm font-medium text-slate-900">Profile Picture</p>
                            <p className="text-sm text-slate-600 mt-1">
                                Powered by <a href="https://gravatar.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Gravatar</a>
                            </p>
                        </div>
                    </div>

                    {/* Display Name */}
                    <div className="space-y-2">
                        <Label htmlFor="display-name" className="text-sm font-medium text-slate-900">
                            Display Name
                        </Label>
                        <Input
                            id="display-name"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Enter your display name"
                            className="max-w-md"
                        />
                        <p className="text-sm text-slate-600">
                            This is how your name will appear in comments and throughout the dashboard
                        </p>
                    </div>

                    {/* Email (read-only) */}
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm font-medium text-slate-900">
                            Email Address
                        </Label>
                        <div className="flex items-center gap-2 max-w-md">
                            <Input
                                id="email"
                                value={user?.email || ''}
                                disabled
                                className="bg-slate-50"
                            />
                            <div className="shrink-0 text-green-600 bg-green-50 px-3 py-2 rounded-md border border-green-200 text-sm font-medium">
                                Verified
                            </div>
                        </div>
                        <p className="text-sm text-slate-600">
                            Your email address cannot be changed
                        </p>
                    </div>

                    {/* Save Button */}
                    <div className="flex items-center gap-3 pt-2">
                        <Button
                            onClick={handleSave}
                            disabled={saving || displayName === (user?.display_name || '')}
                            className="gap-2"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" />
                                    Save Changes
                                </>
                            )}
                        </Button>

                        {message && (
                            <div className={`text-sm font-medium ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                {message.text}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Account Info */}
            <Card className="border-slate-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Account Information
                    </CardTitle>
                    <CardDescription>
                        Additional details about your account
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="font-medium text-slate-900">Account Type</p>
                            <p className="text-slate-600 mt-1">
                                {user?.is_superadmin ? 'Super Admin' : 'Standard User'}
                            </p>
                        </div>
                        <div>
                            <p className="font-medium text-slate-900">Member Since</p>
                            <p className="text-slate-600 mt-1">
                                {user?.email ? 'Active' : 'Unknown'}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
