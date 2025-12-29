import { describe, it, expect } from 'bun:test';
import { api } from './helpers';

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
