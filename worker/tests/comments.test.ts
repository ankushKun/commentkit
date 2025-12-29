import { describe, it, expect } from 'bun:test';
import { api } from './helpers';

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

describe('Comment Management', () => {
    describe('GET /api/v1/sites/:siteId/comments', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/sites/1/comments');
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });

    describe('DELETE /api/v1/sites/comments/:id', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/sites/comments/1', {
                method: 'DELETE',
            });
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });

    describe('PATCH /api/v1/sites/comments/:id', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/sites/comments/1', {
                method: 'PATCH',
                body: JSON.stringify({ content: 'Updated comment' }),
            });
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });

    describe('PATCH /api/v1/sites/comments/:id/status', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/sites/comments/1/status', {
                method: 'PATCH',
                body: JSON.stringify({ status: 'approved' }),
            });
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });

        it('should return 400 for invalid status', async () => {
            const { status } = await api('/api/v1/sites/comments/1/status', {
                method: 'PATCH',
                body: JSON.stringify({ status: 'invalid-status' }),
            });
            expect(status).toBe(400);
        });
    });
});
