import { Hono } from 'hono';
import { cors } from './middleware';
import { auth, comments, likes, sites, superadmin, widget } from './routes';
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
app.route('/api/v1/admin/sites', sites);
app.route('/api/v1/superadmin', superadmin);
app.route('/api/v1', likes);
app.route('/api/v1/widget', widget);

// 404 handler
app.notFound((c) => {
    return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
    console.error('Error:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
});

// Export custom fetch handler that serves static assets and routes to Hono
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        // Serve static files from /static/* path using ASSETS binding
        if (url.pathname.startsWith('/static/')) {
            // Remove /static prefix and serve from assets
            const assetPath = url.pathname.slice('/static'.length);
            const assetUrl = new URL(assetPath || '/', url.origin);
            return env.ASSETS.fetch(assetUrl);
        }

        // Handle all other requests with Hono app
        return app.fetch(request, env, ctx);
    },
};
