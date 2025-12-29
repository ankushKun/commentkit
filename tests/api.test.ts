/**
 * Thread Engine API Tests
 *
 * Prerequisites:
 * 1. Run `wrangler d1 execute thread-engine-db --local --file=migrations/0001_init.sql`
 * 2. Start dev server: `bun run dev`
 * 3. Run tests: `bun test`
 */
import { describe, it, expect } from 'bun:test';

const BASE_URL = 'http://localhost:8787';

// Helper to make requests
async function api(path: string, options?: RequestInit) {
    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });
    return {
        status: res.status,
        json: await res.json().catch(() => null),
        headers: res.headers,
    };
}

describe('Thread Engine API', () => {
    // ==========================================
    // Health Check
    // ==========================================
    describe('GET /health', () => {
        it('should return health status', async () => {
            const { status, json } = await api('/health');
            expect(status).toBe(200);
            expect(json.status).toBe('ok');
            expect(json.version).toBe('1.0.0');
            expect(json.timestamp).toBeDefined();
        });
    });

    // ==========================================
    // Auth Routes
    // ==========================================
    describe('Auth', () => {
        describe('POST /api/v1/auth/login', () => {
            it('should request magic link with valid email', async () => {
                const { status, json } = await api('/api/v1/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email: 'test@example.com' }),
                });
                expect(status).toBe(200);
                expect(json.message).toContain('Magic link sent');
            });

            it('should reject invalid email', async () => {
                const { status } = await api('/api/v1/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email: 'not-an-email' }),
                });
                expect(status).toBe(400);
            });

            it('should reject missing email', async () => {
                const { status } = await api('/api/v1/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({}),
                });
                expect(status).toBe(400);
            });
        });

        describe('GET /api/v1/auth/verify', () => {
            it('should reject missing token', async () => {
                const { status, json } = await api('/api/v1/auth/verify');
                expect(status).toBe(400);
                expect(json.error).toBe('Missing token');
            });

            it('should reject invalid token', async () => {
                const { status, json } = await api('/api/v1/auth/verify?token=invalid-token');
                expect(status).toBe(400);
                expect(json.error).toContain('Invalid or expired');
            });
        });

        describe('GET /api/v1/auth/me', () => {
            it('should return 401 without auth', async () => {
                const { status, json } = await api('/api/v1/auth/me');
                expect(status).toBe(401);
                expect(json.error).toContain('Not authenticated');
            });
        });

        describe('POST /api/v1/auth/logout', () => {
            it('should succeed even without auth', async () => {
                const { status, json } = await api('/api/v1/auth/logout', {
                    method: 'POST',
                });
                expect(status).toBe(200);
                expect(json.message).toContain('Logged out');
            });
        });
    });

    // ==========================================
    // Page & Comments Routes
    // ==========================================
    describe('Comments', () => {
        describe('GET /api/v1/sites/:siteId/pages/:slug', () => {
            it('should return 400 for invalid siteId', async () => {
                const { status, json } = await api('/api/v1/sites/invalid/pages/test-page');
                expect(status).toBe(400);
                expect(json.error).toContain('Invalid site_id');
            });

            it('should return 404 for non-existent site', async () => {
                const { status, json } = await api('/api/v1/sites/99999/pages/test-page');
                expect(status).toBe(404);
                expect(json.error).toContain('Site not found');
            });
        });

        describe('POST /api/v1/sites/:siteId/pages/:slug', () => {
            it('should return 400 for invalid siteId', async () => {
                const { status } = await api('/api/v1/sites/invalid/pages/test-page', {
                    method: 'POST',
                    body: JSON.stringify({ content: 'Test comment' }),
                });
                expect(status).toBe(400);
            });

            it('should return 404 for non-existent site', async () => {
                const { status, json } = await api('/api/v1/sites/99999/pages/test-page', {
                    method: 'POST',
                    body: JSON.stringify({
                        content: 'Test comment',
                        author_name: 'Anonymous',
                    }),
                });
                expect(status).toBe(404);
                expect(json.error).toContain('Site not found');
            });
        });
    });

    // ==========================================
    // Page Likes Routes
    // ==========================================
    describe('Page Likes', () => {
        describe('GET /api/v1/pages/:pageId/likes', () => {
            it('should return 400 for invalid pageId', async () => {
                const { status, json } = await api('/api/v1/pages/invalid/likes');
                expect(status).toBe(400);
                expect(json.error).toContain('Invalid page_id');
            });

            it('should return like stats for any pageId', async () => {
                const { status, json } = await api('/api/v1/pages/1/likes');
                expect(status).toBe(200);
                expect(json.total_likes).toBeDefined();
                expect(json.user_liked).toBeDefined();
            });
        });

        describe('POST /api/v1/pages/:pageId/likes', () => {
            it('should return 401 without auth', async () => {
                const { status, json } = await api('/api/v1/pages/1/likes', {
                    method: 'POST',
                });
                expect(status).toBe(401);
                expect(json.error).toContain('Authentication required');
            });

            it('should return 400 for invalid pageId', async () => {
                const { status, json } = await api('/api/v1/pages/invalid/likes', {
                    method: 'POST',
                });
                expect(status).toBe(400);
                expect(json.error).toContain('Invalid page_id');
            });
        });

        describe('DELETE /api/v1/pages/:pageId/likes', () => {
            it('should return 401 without auth', async () => {
                const { status, json } = await api('/api/v1/pages/1/likes', {
                    method: 'DELETE',
                });
                expect(status).toBe(401);
                expect(json.error).toContain('Authentication required');
            });

            it('should return 400 for invalid pageId', async () => {
                const { status, json } = await api('/api/v1/pages/invalid/likes', {
                    method: 'DELETE',
                });
                expect(status).toBe(400);
                expect(json.error).toContain('Invalid page_id');
            });
        });
    });

    // ==========================================
    // Comment Likes Routes
    // ==========================================
    describe('Comment Likes', () => {
        describe('GET /api/v1/comments/:commentId/likes', () => {
            it('should return 400 for invalid commentId', async () => {
                const { status, json } = await api('/api/v1/comments/invalid/likes');
                expect(status).toBe(400);
                expect(json.error).toContain('Invalid comment_id');
            });

            it('should return like stats for any commentId', async () => {
                const { status, json } = await api('/api/v1/comments/1/likes');
                expect(status).toBe(200);
                expect(json.total_likes).toBeDefined();
                expect(json.user_liked).toBeDefined();
            });
        });

        describe('POST /api/v1/comments/:commentId/likes', () => {
            it('should return 401 without auth', async () => {
                const { status, json } = await api('/api/v1/comments/1/likes', {
                    method: 'POST',
                });
                expect(status).toBe(401);
                expect(json.error).toContain('Authentication required');
            });

            it('should return 400 for invalid commentId', async () => {
                const { status, json } = await api('/api/v1/comments/invalid/likes', {
                    method: 'POST',
                });
                expect(status).toBe(400);
                expect(json.error).toContain('Invalid comment_id');
            });
        });

        describe('DELETE /api/v1/comments/:commentId/likes', () => {
            it('should return 401 without auth', async () => {
                const { status, json } = await api('/api/v1/comments/1/likes', {
                    method: 'DELETE',
                });
                expect(status).toBe(401);
                expect(json.error).toContain('Authentication required');
            });

            it('should return 400 for invalid commentId', async () => {
                const { status, json } = await api('/api/v1/comments/invalid/likes', {
                    method: 'DELETE',
                });
                expect(status).toBe(400);
                expect(json.error).toContain('Invalid comment_id');
            });
        });
    });

    // ==========================================
    // 404 Handler
    // ==========================================
    describe('404 Handler', () => {
        it('should return 404 for unknown routes', async () => {
            const { status, json } = await api('/api/v1/unknown-route');
            expect(status).toBe(404);
            expect(json.error).toBe('Not found');
        });
    });

    // ==========================================
    // CORS
    // ==========================================
    describe('CORS', () => {
        it('should handle OPTIONS preflight', async () => {
            const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
                method: 'OPTIONS',
            });
            expect(res.status).toBe(200);
            expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
            expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
        });

        it('should include CORS headers in responses', async () => {
            const res = await fetch(`${BASE_URL}/health`);
            expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
        });
    });
});
