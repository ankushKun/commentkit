import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    MessageSquare,
    Zap,
    Shield,
    Code,
    Heart,
    Mail,
    CheckCircle2,
    ArrowRight,
    Globe
} from 'lucide-react';
import logo from "../../icon.png"

function FeatureCard({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
    return (
        <div className="flex gap-4 p-4 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all">
            <div className="shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
                <Icon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
                <h3 className="font-semibold text-slate-800 mb-0.5">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
            </div>
        </div>
    );
}

function StepItem({ number, title, description }: { number: number; title: string; description: string }) {
    return (
        <div className="flex gap-4">
            <div className="shrink-0 h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                {number}
            </div>
            <div className="pt-0.5">
                <p className="font-medium text-slate-800">{title}</p>
                <p className="text-sm text-slate-500">{description}</p>
            </div>
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
        <Card className="w-full border-slate-200 shadow-lg">
            <CardHeader className="text-center pb-2">
                <div className="h-16 w-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                    <Mail className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="text-2xl text-slate-800">Check your inbox</CardTitle>
                <CardDescription className="text-base">
                    We sent a magic link to <span className="font-semibold text-slate-700">{email}</span>
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <p className="text-sm text-slate-600">
                        Click the link in the email to sign in instantly. No password needed.
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                        The link expires in 15 minutes
                    </p>
                </div>
                <Button
                    variant="ghost"
                    className="w-full text-slate-500 hover:text-slate-700"
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
        <Card className="w-full border-slate-200 shadow-lg">
            <CardHeader className="text-center pb-4">
                {/* <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/25">
                    <MessageSquare className="h-7 w-7 text-white" />
                </div> */}
                <img src={logo} alt="CommentKit" className="h-18 w-18 mx-auto" />
                <CardTitle className="text-2xl text-slate-800">Welcome to CommentKit</CardTitle>
                <CardDescription className="text-base">
                    Sign in to manage comments on your sites
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-slate-700">Email address</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !loading) {
                                    e.currentTarget.form?.requestSubmit();
                                }
                            }}
                            required
                            className="h-11"
                        />
                    </div>
                    {error && (
                        <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}
                    <Button type="submit" className="w-full h-11 text-base gap-2" disabled={loading}>
                        {loading ? 'Sending...' : (
                            <>
                                Continue with Email
                                <ArrowRight className="h-4 w-4" />
                            </>
                        )}
                    </Button>
                </form>
                <div className="flex items-center gap-2 justify-center mt-4 text-xs text-slate-400">
                    <Shield className="h-3.5 w-3.5" />
                    <span>Passwordless sign-in via magic link</span>
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-0">
            {/* Hero Section */}
            <div className="text-center mb-8 md:mb-12">
                <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium mb-4 sm:mb-6">
                    <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Simple. Fast. Privacy-focused.
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-3 sm:mb-4">
                    Comments for your website,
                    <br className="hidden sm:block" />
                    <span className="sm:hidden"> </span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                        in just 2 lines of code
                    </span>
                </h1>
                <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed px-2">
                    Add a beautiful, fast comment section to any website.
                    No heavy bundles, no complex setup. Just drop in the code and go.
                </p>
            </div>

            {/* Main Content: Login first on mobile, then features */}
            <div className="grid lg:grid-cols-5 gap-6 md:gap-8 items-start">
                {/* Login Card - Shows first on mobile */}
                <div className="lg:col-span-2 lg:order-2 lg:sticky lg:top-8 order-first lg:order-none">
                    {loginCard}

                    {/* Social Proof / Trust */}
                    <div className="mt-4 sm:mt-6 text-center">
                        <div className="flex items-center justify-center gap-1 text-slate-400">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-sm">Free to get started</span>
                        </div>
                    </div>
                </div>

                {/* Features - Left Side */}
                <div className="lg:col-span-3 lg:order-1 space-y-6 md:space-y-8">
                    {/* Feature Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <FeatureCard
                            icon={Code}
                            title="Dead Simple Setup"
                            description="Just add a script tag and a div. CommentKit auto-initializes and handles the rest."
                        />
                        <FeatureCard
                            icon={Zap}
                            title="Lightning Fast"
                            description="Built on Cloudflare's edge network for instant loading anywhere in the world."
                        />
                        <FeatureCard
                            icon={Shield}
                            title="Domain Verification"
                            description="Secure your comments with domain ownership verification. Full spam protection."
                        />
                        <FeatureCard
                            icon={Heart}
                            title="Likes & Engagement"
                            description="Let visitors like comments and pages. Build an engaged community."
                        />
                    </div>

                    {/* How it Works */}
                    <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 shadow-sm">
                        <h2 className="text-base sm:text-lg font-bold text-slate-800 mb-4 sm:mb-5 flex items-center gap-2">
                            <Globe className="h-5 w-5 text-blue-600" />
                            Get started in minutes
                        </h2>
                        <div className="space-y-4 sm:space-y-5">
                            <StepItem
                                number={1}
                                title="Register your site"
                                description="Add your domain and verify ownership with a simple file upload."
                            />
                            <StepItem
                                number={2}
                                title="Add the code to your site"
                                description="Copy the script tag and container div into your HTML."
                            />
                            <StepItem
                                number={3}
                                title="Manage from your dashboard"
                                description="Moderate comments, view activity, and keep your community healthy."
                            />
                        </div>
                    </div>

                    {/* Code Preview */}
                    <div className="bg-slate-900 rounded-xl p-3 sm:p-5 shadow-lg overflow-hidden">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="flex gap-1.5">
                                <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-red-400" />
                                <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-yellow-400" />
                                <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-green-400" />
                            </div>
                            <span className="text-slate-500 text-xs ml-2">index.html</span>
                        </div>
                        <pre className="text-xs sm:text-sm font-mono overflow-x-auto whitespace-pre-wrap break-all sm:whitespace-pre sm:break-normal">
                            <code>
                                <span className="text-slate-500">{'<!-- Add this to your page -->'}</span>
                                {'\n'}
                                <span className="text-pink-400">{'<script'}</span>
                                <span className="text-sky-300">{' src'}</span>
                                <span className="text-slate-300">{'='}</span>
                                <span className="text-amber-300">{"\"https://commentkit.ankush.one/bundle.js\""}</span>
                                <span className="text-pink-400">{'></script>'}</span>
                                {'\n'}
                                <span className="text-pink-400">{'<div'}</span>
                                <span className="text-sky-300">{' data-commentkit'}</span>
                                <span className="text-pink-400">{'></div>'}</span>
                                {'\n\n'}
                                <span className="text-green-400">{'<!-- That\'s it! Comments appear automatically -->'}</span>
                            </code>
                        </pre>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-12 md:mt-16 pt-6 md:pt-8 border-t border-slate-200 text-center">
                <p className="text-xs sm:text-sm text-slate-400">
                    Built with Cloudflare Workers, D1, and Hono
                </p>
            </div>
        </div>
    );
}
