import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function FeatureCard({ title, description }: { title: string; description: string }) {
    return (
        <div className="p-4 rounded-lg border bg-card">
            <h3 className="font-semibold mb-1">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
    );
}

export function LoginForm() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const result = await login(email);

        if (result.success) {
            setSent(true);
        } else {
            setError(result.error || 'Failed to send magic link');
        }

        setLoading(false);
    };

    const loginCard = sent ? (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="text-2xl">Check your email</CardTitle>
                <CardDescription>
                    We sent a magic link to <strong>{email}</strong>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">
                    Click the link in the email to sign in. The link expires in 15 minutes.
                </p>
                <Button
                    variant="ghost"
                    className="mt-4"
                    onClick={() => {
                        setSent(false);
                        setEmail('');
                    }}
                >
                    Use a different email
                </Button>
            </CardContent>
        </Card>
    ) : (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="text-2xl">Get Started</CardTitle>
                <CardDescription>
                    Enter your email to receive a magic link
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? 'Sending...' : 'Send magic link'}
                    </Button>
                </form>
                <p className="text-xs text-muted-foreground mt-4 text-center">
                    No password needed. We'll email you a secure login link.
                </p>
            </CardContent>
        </Card>
    );

    return (
        <div className="w-full max-w-4xl mx-auto">
            {/* Hero Section */}
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold mb-4">CommentKit</h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                    Add comments and reactions to any website in minutes.
                    A lightweight, fast, and privacy-focused commenting platform.
                </p>
            </div>

            {/* Main Content: Features + Login */}
            <div className="grid md:grid-cols-2 gap-8 items-start">
                {/* Features */}
                <div className="space-y-6">
                    <div>
                        <h2 className="text-lg font-semibold mb-4">Why CommentKit?</h2>
                        <div className="space-y-3">
                            <FeatureCard
                                title="Easy Integration"
                                description="Add comments to your blog, docs, or any static site with a simple embed code."
                            />
                            <FeatureCard
                                title="Fast & Lightweight"
                                description="Built on Cloudflare Workers for global edge performance. No heavy JavaScript bundles."
                            />
                            <FeatureCard
                                title="Full Moderation"
                                description="Approve, reject, or mark comments as spam. Keep your community healthy."
                            />
                            <FeatureCard
                                title="Likes & Reactions"
                                description="Let visitors like pages and comments to boost engagement."
                            />
                        </div>
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold mb-3">How it works</h2>
                        <ol className="space-y-2 text-sm text-muted-foreground">
                            <li className="flex gap-2">
                                <span className="font-semibold text-foreground">1.</span>
                                Create an account and register your site
                            </li>
                            <li className="flex gap-2">
                                <span className="font-semibold text-foreground">2.</span>
                                Get your API key from the dashboard
                            </li>
                            <li className="flex gap-2">
                                <span className="font-semibold text-foreground">3.</span>
                                Embed the comment widget on your pages
                            </li>
                            <li className="flex gap-2">
                                <span className="font-semibold text-foreground">4.</span>
                                Moderate and manage comments from your dashboard
                            </li>
                        </ol>
                    </div>
                </div>

                {/* Login Card */}
                <div>
                    {loginCard}
                </div>
            </div>

            {/* Footer */}
            <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
                <p>Built with Cloudflare Workers, D1, and Hono</p>
            </div>
        </div>
    );
}
