import { Hono } from 'hono';
import { cors } from './middleware';
import { auth, comments, likes } from './routes';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('*', cors);

// Health check
app.get('/health', (c) => {
    return c.json({
        status: 'ok',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});

// Mount routes
app.route('/api/v1/auth', auth);
app.route('/api/v1/sites', comments);
app.route('/api/v1', likes);

// 404 handler
app.notFound((c) => {
    return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
    console.error('Error:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
});

export default app;
