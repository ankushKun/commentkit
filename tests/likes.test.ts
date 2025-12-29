import { describe, it, expect } from 'bun:test';
import { api } from './helpers';

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
