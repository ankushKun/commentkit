import { Hono } from 'hono';
import { Database } from '../db';
import type { Env, Variables } from '../types';
import { generateCsrfToken } from '../middleware/csrf';

const widget = new Hono<{ Bindings: Env; Variables: Variables }>();

// HMAC signing for origin tokens
async function signOriginToken(domain: string, timestamp: number, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(`${domain}:${timestamp}`);
    const keyData = encoder.encode(secret);

    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, data);
    const signatureArray = Array.from(new Uint8Array(signature));
    return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verify HMAC signature
async function verifyOriginToken(token: string, secret: string): Promise<{ valid: boolean; domain?: string; error?: string }> {
    try {
        // Token format: base64(domain:timestamp:signature)
        const decoded = atob(token);
        const [domain, timestampStr, signature] = decoded.split(':');

        if (!domain || !timestampStr || !signature) {
            return { valid: false, error: 'Invalid token format' };
        }

        const timestamp = parseInt(timestampStr, 10);

        // Check if token is expired (1 hour)
        const now = Date.now();
        const tokenAge = now - timestamp;
        if (tokenAge > 3600000) { // 1 hour in ms
            return { valid: false, error: 'Token expired' };
        }

        // Verify signature
        const expectedSignature = await signOriginToken(domain, timestamp, secret);
        if (signature !== expectedSignature) {
            return { valid: false, error: 'Invalid signature' };
        }

        return { valid: true, domain };
    } catch (e) {
        return { valid: false, error: 'Token verification failed' };
    }
}

// GET /api/v1/widget/init - Initialize widget with signed origin token
// This is called by bundle.js (running on customer's page, not in iframe)
// The Origin header on this request is SET BY THE BROWSER and cannot be spoofed by JS
widget.get('/init', async (c) => {
    const origin = c.req.header('Origin');

    // In development, allow requests without origin
    if (!origin) {
        if (c.env.ENVIRONMENT === 'development') {
            const devDomain = c.req.query('domain') || 'localhost';
            const timestamp = Date.now();
            const signature = await signOriginToken(devDomain, timestamp, c.env.JWT_SECRET);
            const token = btoa(`${devDomain}:${timestamp}:${signature}`);

            return c.json({
                token,
                domain: devDomain,
                expires_in: 3600
            });
        }
        return c.json({ error: 'Origin header required' }, 400);
    }

    try {
        const url = new URL(origin);
        const domain = url.hostname;

        const isDevelopment = c.env.ENVIRONMENT === 'development';
        const isLocalhost = domain === 'localhost' || domain === '127.0.0.1' || domain.endsWith('.local');

        console.log('[Widget Init] Environment:', c.env.ENVIRONMENT, 'Domain:', domain, 'isDev:', isDevelopment, 'isLocalhost:', isLocalhost);

        // In development, allow localhost without database check
        if (isDevelopment && isLocalhost) {
            const timestamp = Date.now();
            const signature = await signOriginToken(domain, timestamp, c.env.JWT_SECRET);
            const token = btoa(`${domain}:${timestamp}:${signature}`);
            const csrfToken = await generateCsrfToken(origin, c.env.JWT_SECRET);

            console.log('[Widget Init] Development mode - allowing localhost:', domain);

            return c.json({
                token,
                csrfToken,
                domain,
                site_id: 1,  // Fake site ID for development
                verified: true,
                expires_in: 3600
            });
        }

        const db = new Database(c.env.DB);
        const site = await db.getSiteByDomain(domain);

        if (!site) {
            return c.json({
                error: 'Domain not registered',
                verified: false
            }, 404);
        }

        if (!site.verified) {
            return c.json({
                error: 'Domain not verified',
                verified: false
            }, 403);
        }

        // Create a signed token that proves this domain
        // The token includes: domain, timestamp, and HMAC signature
        const timestamp = Date.now();
        const signature = await signOriginToken(domain, timestamp, c.env.JWT_SECRET);
        const token = btoa(`${domain}:${timestamp}:${signature}`);

        // Generate CSRF token for this origin
        const csrfToken = await generateCsrfToken(origin, c.env.JWT_SECRET);

        return c.json({
            token,
            csrfToken,  // Return CSRF token to client
            domain,
            site_id: site.id,
            verified: true,
            expires_in: 3600  // Token valid for 1 hour
        });
    } catch (e) {
        console.error('[Widget Init] Error:', e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        return c.json({
            error: 'Invalid origin',
            details: c.env.ENVIRONMENT === 'development' ? errorMessage : undefined
        }, 400);
    }
});

// GET /api/v1/widget/verify-site - Public endpoint to check if a site is verified
// Used by the widget to determine if it should load on non-localhost domains
widget.get('/verify-site', async (c) => {
    const domain = c.req.query('domain');

    if (!domain) {
        return c.json({ error: 'Domain parameter is required' }, 400);
    }

    const db = new Database(c.env.DB);
    const site = await db.getSiteByDomain(domain);

    if (!site) {
        return c.json({
            verified: false,
            error: 'This domain is not registered with CommentKit.',
        });
    }

    if (!site.verified) {
        return c.json({
            verified: false,
            error: 'This site has not been verified. The site owner must verify domain ownership to enable comments.',
        });
    }

    return c.json({
        verified: true,
        site_id: site.id,
    });
});

// Export for use in comments.ts
export { widget, verifyOriginToken };
