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
// Supports both Bearer token (for backward compatibility) and HttpOnly cookies (more secure)
export async function getAuthUser(c: Context<{ Bindings: Env }>): Promise<AuthUser | null> {
    let token: string | null = null;

    // First, check for HttpOnly cookie (preferred, more secure)
    const cookies = c.req.header('Cookie');
    if (cookies) {
        const cookieMatch = cookies.match(/ck_auth=([^;]+)/);
        if (cookieMatch && cookieMatch[1]) {
            token = cookieMatch[1];
        }
    }

    // Fall back to Bearer token header (for backward compatibility)
    if (!token) {
        const authHeader = c.req.header('Authorization');
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.slice(7);
        }
    }

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
        email_hash: user.email_hash,
        display_name: user.display_name,
        is_superadmin: user.is_superadmin === 1,
        created_at: user.created_at,
        updated_at: user.updated_at,
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
    if (!user.is_superadmin) {
        return c.json({ error: 'Superadmin access required' }, 403);
    }
    await next();
}

// NOTE: CSRF validation has been moved to middleware/csrf.ts
// Import and use validateCsrf from there instead
// This function is kept for backward compatibility but should not be used

// Get allowed origins from environment
function getAllowedOrigins(env: Env): string[] {
    const origins: string[] = [];

    // Always allow the frontend URL
    if (env.FRONTEND_URL) {
        origins.push(env.FRONTEND_URL);
    }

    // Always allow the base API URL (for same-origin requests)
    if (env.BASE_URL) {
        origins.push(env.BASE_URL);
    }

    // Additional allowed origins from environment
    if (env.ALLOWED_ORIGINS) {
        const additionalOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(o => o);
        origins.push(...additionalOrigins);
    }

    // Development origins
    if (env.ENVIRONMENT === 'development') {
        origins.push('http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173');
    }

    return origins;
}

// Check if origin is allowed (static check against env config)
function isOriginAllowedStatic(origin: string | undefined, env: Env): boolean {
    if (!origin) return false;

    const allowedOrigins = getAllowedOrigins(env);

    // Check if origin matches any allowed origin
    if (allowedOrigins.includes(origin)) {
        return true;
    }

    // In development, allow localhost with any port and .local domains
    if (env.ENVIRONMENT === 'development') {
        try {
            const url = new URL(origin);
            if (url.hostname === 'localhost' ||
                url.hostname === '127.0.0.1' ||
                url.hostname.endsWith('.local') ||
                url.hostname.startsWith('192.168.') ||
                url.hostname.startsWith('10.')) {
                return true;
            }
        } catch {
            return false;
        }
    }

    return false;
}

// Check if origin matches a verified site domain (database check)
async function isOriginVerifiedSite(origin: string | undefined, db: D1Database): Promise<boolean> {
    if (!origin) return false;

    try {
        const url = new URL(origin);
        const domain = url.hostname;

        // Check if domain is a verified site
        const result = await db.prepare(
            'SELECT id FROM sites WHERE domain = ? AND verified = 1 LIMIT 1'
        ).bind(domain).first<{ id: number }>();

        return !!result;
    } catch {
        return false;
    }
}

// CORS middleware with origin validation
export async function cors(c: Context<{ Bindings: Env }>, next: Next) {
    const origin = c.req.header('Origin');
    const env = c.env;

    // First check static allowed origins (fast path)
    let allowed = isOriginAllowedStatic(origin, env);

    // If not in static list, check if it's a verified site domain
    if (!allowed && origin) {
        allowed = await isOriginVerifiedSite(origin, env.DB);
    }

    const allowedOrigin = allowed && origin ? origin : '';

    // Handle preflight
    if (c.req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': allowedOrigin,
                'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-CSRF-Token, X-Origin-Token',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400',
            },
        });
    }

    await next();

    // Add CORS headers to response
    if (allowedOrigin) {
        c.res.headers.set('Access-Control-Allow-Origin', allowedOrigin);
        c.res.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-CSRF-Token, X-Origin-Token');
}

// Generate a cryptographically secure nonce for CSP
function generateNonce(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes));
}

// Security headers middleware
// Adds various security-related headers to all responses
export async function securityHeaders(c: Context<{ Bindings: Env }>, next: Next) {
    // Generate nonce for this request
    const nonce = generateNonce();
    // @ts-expect-error
    c.set('cspNonce', nonce);

    await next();

    // Content Security Policy
    // Note: For API endpoints, we're fairly restrictive
    // The widget iframe needs to be able to load from the base URL
    const baseUrl = c.env.BASE_URL || '';
    const frontendUrl = c.env.FRONTEND_URL || '';

    // Build CSP directives with nonce-based inline script support
    const cspDirectives = [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}'`,  // Only allow scripts with this nonce
        "style-src 'self' 'unsafe-inline'",    // Keep unsafe-inline for styles (lower risk)
        `connect-src 'self' ${baseUrl} ${frontendUrl}`,  // API connections
        `frame-ancestors ${frontendUrl} *`,    // Allow embedding in any frame (widget needs this)
        "img-src 'self' https://www.gravatar.com data:",  // Gravatar for avatars
        "form-action 'self'",
        "base-uri 'self'",
    ];

    c.res.headers.set('Content-Security-Policy', cspDirectives.join('; '));

    // Prevent MIME type sniffing
    c.res.headers.set('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking on non-widget pages (widget needs to be frameable)
    // Note: We don't set X-Frame-Options because the widget needs to be embedded
    // The frame-ancestors CSP directive is the modern replacement

    // Enable XSS filter in browsers that support it
    c.res.headers.set('X-XSS-Protection', '1; mode=block');

    // Referrer policy for privacy
    c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions policy to disable unnecessary features
    c.res.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
}

// Export hash function for use in auth routes
export { hashToken };
