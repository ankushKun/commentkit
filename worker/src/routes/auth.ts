import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { Database } from '../db';
import { getAuthUser, hashToken } from '../middleware';
import type { Env } from '../types';

const auth = new Hono<{ Bindings: Env }>();

// Generate random token
function generateToken(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

// Add minutes to current date
function addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
}

// Add days to current date
function addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// Format date for SQLite
function formatDate(date: Date): string {
    return date.toISOString().replace('T', ' ').slice(0, 19);
}

// POST /api/v1/auth/login - Send magic link
const loginSchema = z.object({
    email: z.string().email(),
});

auth.post('/login', zValidator('json', loginSchema), async (c) => {
    const { email } = c.req.valid('json');

    const db = new Database(c.env.DB);

    // Generate token
    const token = generateToken();
    const expiresAt = formatDate(addMinutes(new Date(), 15));

    // Store magic link
    await db.createMagicLink(email, token, expiresAt);

    // Build verify URL - use frontend URL if available, otherwise API URL
    const frontendUrl = c.env.FRONTEND_URL;
    const verifyUrl = `${frontendUrl}?token=${token}`;

    // Log for development
    console.log(`🔗 Magic link for ${email}: ${verifyUrl}`);

    // TODO: Send email via Resend in production
    // if (c.env.RESEND_API_KEY) {
    //   await sendMagicLinkEmail(email, verifyUrl, c.env.RESEND_API_KEY);
    // }

    return c.json({ message: 'Magic link sent! Check your email.' });
});

// GET /api/v1/auth/verify - Verify magic link token
auth.get('/verify', async (c) => {
    const token = c.req.query('token');
    if (!token) {
        return c.json({ error: 'Missing token' }, 400);
    }

    const db = new Database(c.env.DB);

    // Verify magic link
    const email = await db.verifyMagicLink(token);
    if (!email) {
        return c.json({ error: 'Invalid or expired token' }, 400);
    }

    // Get or create user
    const user = await db.getOrCreateUser(email);

    // Create session
    const sessionToken = generateToken();
    const tokenHash = await hashToken(sessionToken);
    const expiresAt = formatDate(addDays(new Date(), 30));

    await db.createSession(user.id, tokenHash, expiresAt);

    return c.json({
        token: sessionToken,
        user: {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            is_superadmin: user.is_superadmin === 1,
        },
    });
});

// GET /api/v1/auth/me - Get current user with optional bootstrap data
auth.get('/me', async (c) => {
    const user = await getAuthUser(c);
    if (!user) {
        return c.json({ error: 'Not authenticated' }, 401);
    }

    const includeBootstrap = c.req.query('bootstrap') === 'true';

    const userData = {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        is_superadmin: user.is_superadmin,
    };

    if (!includeBootstrap) {
        return c.json(userData);
    }

    // Bootstrap: include initial dashboard data to save an extra API call
    const db = new Database(c.env.DB);
    const { sites, aggregated } = await db.getSitesWithStats(user.id);

    const sitesData = sites.map((site) => ({
        id: site.id,
        name: site.name,
        domain: site.domain,
        api_key_preview: site.api_key.slice(0, 8) + '...',
        created_at: site.created_at,
        updated_at: site.updated_at,
        stats: {
            total_pages: site.total_pages,
            total_comments: site.total_comments,
            pending_comments: site.pending_comments,
            total_likes: site.total_likes,
        },
    }));

    return c.json({
        ...userData,
        bootstrap: {
            sites: sitesData,
            aggregated,
        },
    });
});

// PATCH /api/v1/auth/profile - Update user profile
const updateProfileSchema = z.object({
    display_name: z.string().min(1).max(100).optional(),
});

auth.patch('/profile', zValidator('json', updateProfileSchema), async (c) => {
    const user = await getAuthUser(c);
    if (!user) {
        return c.json({ error: 'Not authenticated' }, 401);
    }

    const body = c.req.valid('json');
    const db = new Database(c.env.DB);

    await db.updateUserProfile(user.id, {
        display_name: body.display_name,
    });

    return c.json({
        id: user.id,
        email: user.email,
        display_name: body.display_name ?? user.display_name,
        is_superadmin: user.is_superadmin,
    });
});

// POST /api/v1/auth/logout - Logout
auth.post('/logout', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        if (token) {
            const tokenHash = await hashToken(token);
            const db = new Database(c.env.DB);
            await db.deleteSession(tokenHash);
        }
    }

    return c.json({ message: 'Logged out successfully' });
});

export { auth };
