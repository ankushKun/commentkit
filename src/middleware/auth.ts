import type { Context, Next } from 'hono';
import { Database } from '../db';
import type { AuthUser, Env } from '../types';

// Hash function using Web Crypto API
async function hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Extract and validate auth user from request
export async function getAuthUser(c: Context<{ Bindings: Env }>): Promise<AuthUser | null> {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.slice(7);
    if (!token) {
        return null;
    }

    const tokenHash = await hashToken(token);
    const db = new Database(c.env.DB);
    const user = await db.getSessionUser(tokenHash);

    if (!user) {
        return null;
    }

    return {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        is_admin: user.is_admin === 1,
    };
}

// Require authentication middleware
export async function requireAuth(c: Context<{ Bindings: Env }>, next: Next) {
    const user = await getAuthUser(c);
    if (!user) {
        return c.json({ error: 'Authentication required' }, 401);
    }
    // User is authenticated, continue
    await next();
}

// Require superadmin authentication middleware
export async function requireSuperAdmin(c: Context<{ Bindings: Env }>, next: Next) {
    const user = await getAuthUser(c);
    if (!user) {
        return c.json({ error: 'Authentication required' }, 401);
    }
    if (!user.is_admin) {
        return c.json({ error: 'Superadmin access required' }, 403);
    }
    await next();
}

// CORS middleware
export async function cors(c: Context, next: Next) {
    // Handle preflight
    if (c.req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
                'Access-Control-Max-Age': '86400',
            },
        });
    }

    await next();

    // Add CORS headers to response
    c.res.headers.set('Access-Control-Allow-Origin', '*');
    c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
}

// Export hash function for use in auth routes
export { hashToken };
