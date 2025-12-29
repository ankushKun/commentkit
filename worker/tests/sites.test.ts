import { describe, it, expect } from 'bun:test';
import { api } from './helpers';

describe('Site Management', () => {
    describe('GET /api/v1/admin/sites', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/admin/sites');
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });

    describe('GET /api/v1/admin/sites/:id', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/admin/sites/1');
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });

    describe('POST /api/v1/admin/sites', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/admin/sites', {
                method: 'POST',
                body: JSON.stringify({ name: 'Test Site', domain: 'test.com' }),
            });
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });

        it('should return 400 for missing fields', async () => {
            const { status } = await api('/api/v1/admin/sites', {
                method: 'POST',
                body: JSON.stringify({ name: 'Test Site' }),
            });
            expect(status).toBe(400);
        });
    });

    describe('PATCH /api/v1/admin/sites/:id', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/admin/sites/1', {
                method: 'PATCH',
                body: JSON.stringify({ name: 'Updated Site' }),
            });
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });

    describe('DELETE /api/v1/admin/sites/:id', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/admin/sites/1', {
                method: 'DELETE',
            });
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });

    describe('POST /api/v1/admin/sites/:id/regenerate-key', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/admin/sites/1/regenerate-key', {
                method: 'POST',
            });
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });

    describe('GET /api/v1/admin/sites/:id/stats', () => {
        it('should return 401 without auth', async () => {
            const { status, json } = await api('/api/v1/admin/sites/1/stats');
            expect(status).toBe(401);
            expect(json.error).toContain('Authentication required');
        });
    });
});
