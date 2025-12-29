import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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

    if (sent) {
        return (
            <Card className="w-full max-w-md mx-auto">
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
        );
    }

    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader>
                <CardTitle className="text-2xl">Sign in</CardTitle>
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
            </CardContent>
        </Card>
    );
}
