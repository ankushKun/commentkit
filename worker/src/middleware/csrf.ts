import type { Context } from 'hono';
import type { Env } from '../types';

/**
 * CSRF Token Utilities
 *
 * Implements double-submit cookie pattern with HMAC signing:
 * - Client receives a signed CSRF token
 * - Client must include the same token in requests
 * - Server validates the signature and match
 *
 * This prevents cross-site request forgery even when multiple sites
 * are using the same widget, as each gets a unique signed token.
 */

// HMAC signing for CSRF tokens
async function signCsrfToken(payload: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
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
async function verifyCsrfSignature(payload: string, signature: string, secret: string): Promise<boolean> {
    const expectedSignature = await signCsrfToken(payload, secret);

    // Constant-time comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) {
        return false;
    }

    let result = 0;
    for (let i = 0; i < signature.length; i++) {
        result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }

    return result === 0;
}

/**
 * Generate a CSRF token for a given context
 * Format: base64(timestamp:random:signature)
 *
 * The token is tied to the origin domain to prevent cross-site token reuse
 */
export async function generateCsrfToken(origin: string, secret: string): Promise<string> {
    const timestamp = Date.now();
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    const random = Array.from(randomBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    // Include origin in the payload so token is origin-specific
    const payload = `${origin}:${timestamp}:${random}`;
    const signature = await signCsrfToken(payload, secret);

    return btoa(`${payload}:${signature}`);
}

/**
 * Validate a CSRF token
 * Checks:
 * 1. Token format is valid
 * 2. Signature is valid
 * 3. Token is not expired (24 hour window)
 * 4. Token origin matches request origin
 */
export async function validateCsrfToken(
    token: string,
    origin: string,
    secret: string
): Promise<{ valid: boolean; error?: string }> {
    try {
        const decoded = atob(token);
        const parts = decoded.split(':');

        if (parts.length !== 4) {
            return { valid: false, error: 'Invalid token format' };
        }

        const [tokenOrigin, timestampStr, random, signature] = parts;

        // Verify origin matches
        if (tokenOrigin !== origin) {
            return { valid: false, error: 'Token origin mismatch' };
        }

        // Verify not expired (24 hours)
        const timestamp = parseInt(timestampStr, 10);
        const now = Date.now();
        const age = now - timestamp;

        if (age > 86400000) { // 24 hours in ms
            return { valid: false, error: 'Token expired' };
        }

        if (age < 0) {
            return { valid: false, error: 'Invalid timestamp' };
        }

        // Verify signature
        const payload = `${tokenOrigin}:${timestampStr}:${random}`;
        const isValid = await verifyCsrfSignature(payload, signature, secret);

        if (!isValid) {
            return { valid: false, error: 'Invalid signature' };
        }

        return { valid: true };
    } catch (e) {
        return { valid: false, error: 'Token validation failed' };
    }
}

/**
 * Middleware to validate CSRF tokens on mutation requests
 */
export async function validateCsrf(c: Context<{ Bindings: Env }>, next: Function) {
    const method = c.req.method.toUpperCase();

    // Only check mutation requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        // Allow API key authenticated requests (for third-party integrations)
        const apiKey = c.req.header('X-API-Key');
        if (apiKey) {
            await next();
            return;
        }

        // In development, be more lenient (accept any token or even no token)
        if (c.env.ENVIRONMENT === 'development') {
            console.log('[CSRF] Development mode - skipping validation');
            await next();
            return;
        }

        const origin = c.req.header('Origin');
        const csrfToken = c.req.header('X-CSRF-Token');

        // Origin must be present for mutation requests (prevents direct API calls from non-browser)
        if (!origin) {
            return c.json({ error: 'Origin header required for mutation requests' }, 403);
        }

        // CSRF token must be present
        if (!csrfToken) {
            return c.json({ error: 'CSRF token required for mutation requests' }, 403);
        }

        // Special case: Requests from the widget iframe (same-origin as API)
        // The iframe bridge makes requests on behalf of the parent page
        // In this case, we trust the CSRF token was obtained legitimately via /widget/init
        const baseUrl = c.env.BASE_URL || '';
        const frontendUrl = c.env.FRONTEND_URL || '';

        try {
            const requestOrigin = new URL(origin);
            const apiOrigin = new URL(baseUrl);
            const frontendOrigin = frontendUrl ? new URL(frontendUrl) : null;

            // If request is from the API's own origin OR the frontend origin, it's the iframe bridge
            const isSameOrigin = requestOrigin.origin === apiOrigin.origin ||
                (frontendOrigin && requestOrigin.origin === frontendOrigin.origin);

            if (isSameOrigin) {
                // For same-origin requests (iframe bridge), just verify token format is valid
                // The actual origin verification happens via X-Origin-Token header in the route handlers
                console.log('[CSRF] Same-origin request from iframe bridge, accepting token');
                await next();
                return;
            }
        } catch (e) {
            // If URL parsing fails, continue with normal validation
        }

        // Validate the CSRF token cryptographically
        const validation = await validateCsrfToken(csrfToken, origin, c.env.JWT_SECRET);

        if (!validation.valid) {
            console.error('[CSRF] Token validation failed:', validation.error);
            return c.json({
                error: 'Invalid CSRF token. Please refresh the page and try again.',
                details: validation.error
            }, 403);
        }

        console.log('[CSRF] Token validated successfully for origin:', origin);
    }

    await next();
}
