import { describe, it, expect } from 'bun:test';
import { api } from './helpers';

describe('Superadmin', () => {
    // Analytics
    describe('GET /api/v1/superadmin/stats', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/superadmin/stats');
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });

    describe('GET /api/v1/superadmin/activity', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/superadmin/activity');
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });

    // User Management
    describe('GET /api/v1/superadmin/users', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/superadmin/users');
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });

    describe('GET /api/v1/superadmin/users/:id', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/superadmin/users/1');
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });

    describe('PATCH /api/v1/superadmin/users/:id/admin', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/superadmin/users/1/admin', {
                method: 'PATCH',
                body: JSON.stringify({ is_superadmin: true }),
            });
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });

    describe('DELETE /api/v1/superadmin/users/:id', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/superadmin/users/1', {
                method: 'DELETE',
            });
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });

    // Site Management
    describe('GET /api/v1/superadmin/sites', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/superadmin/sites');
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });

    describe('GET /api/v1/superadmin/sites/:id', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/superadmin/sites/1');
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });

    describe('PATCH /api/v1/superadmin/sites/:id/owner', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/superadmin/sites/1/owner', {
                method: 'PATCH',
                body: JSON.stringify({ new_owner_id: 2 }),
            });
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });

    describe('DELETE /api/v1/superadmin/sites/:id', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/superadmin/sites/1', {
                method: 'DELETE',
            });
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });

    // Comment Management
    describe('GET /api/v1/superadmin/comments', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/superadmin/comments');
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });

    describe('GET /api/v1/superadmin/comments/:id', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/superadmin/comments/1');
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });

    describe('PATCH /api/v1/superadmin/comments/:id/status', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/superadmin/comments/1/status', {
                method: 'PATCH',
                body: JSON.stringify({ status: 'approved' }),
            });
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });

    describe('POST /api/v1/superadmin/comments/bulk-status', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/superadmin/comments/bulk-status', {
                method: 'POST',
                body: JSON.stringify({ comment_ids: [1, 2], status: 'approved' }),
            });
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });

    describe('DELETE /api/v1/superadmin/comments/:id', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/superadmin/comments/1', {
                method: 'DELETE',
            });
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });

    describe('POST /api/v1/superadmin/comments/bulk-delete', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/superadmin/comments/bulk-delete', {
                method: 'POST',
                body: JSON.stringify({ comment_ids: [1, 2] }),
            });
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });
});
