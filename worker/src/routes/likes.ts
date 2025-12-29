import { Hono } from 'hono';
import { Database } from '../db';
import { getAuthUser } from '../middleware';
import type { Env } from '../types';

const likes = new Hono<{ Bindings: Env }>();

// ==========================================
// Page Likes
// ==========================================

// GET /api/v1/pages/:pageId/likes
likes.get('/pages/:pageId/likes', async (c) => {
    const pageId = parseInt(c.req.param('pageId'));
    if (isNaN(pageId)) {
        return c.json({ error: 'Invalid page_id' }, 400);
    }

    const db = new Database(c.env.DB);
    const authUser = await getAuthUser(c);
    const stats = await db.getPageLikeStats(pageId, authUser?.id);

    return c.json(stats);
});

// POST /api/v1/pages/:pageId/likes
likes.post('/pages/:pageId/likes', async (c) => {
    const pageId = parseInt(c.req.param('pageId'));
    if (isNaN(pageId)) {
        return c.json({ error: 'Invalid page_id' }, 400);
    }

    const authUser = await getAuthUser(c);
    if (!authUser) {
        return c.json({ error: 'Authentication required' }, 401);
    }

    const db = new Database(c.env.DB);
    await db.addPageLike(pageId, authUser.id);
    // Get fresh stats (user_liked will be true, but count may have changed)
    const stats = await db.getPageLikeStats(pageId, authUser.id);

    return c.json(stats);
});

// DELETE /api/v1/pages/:pageId/likes
likes.delete('/pages/:pageId/likes', async (c) => {
    const pageId = parseInt(c.req.param('pageId'));
    if (isNaN(pageId)) {
        return c.json({ error: 'Invalid page_id' }, 400);
    }

    const authUser = await getAuthUser(c);
    if (!authUser) {
        return c.json({ error: 'Authentication required' }, 401);
    }

    const db = new Database(c.env.DB);
    await db.removePageLike(pageId, authUser.id);
    // Get fresh stats (user_liked will be false, but count may have changed)
    const stats = await db.getPageLikeStats(pageId, authUser.id);

    return c.json(stats);
});

// ==========================================
// Comment Likes
// ==========================================

// GET /api/v1/comments/:commentId/likes
likes.get('/comments/:commentId/likes', async (c) => {
    const commentId = parseInt(c.req.param('commentId'));
    if (isNaN(commentId)) {
        return c.json({ error: 'Invalid comment_id' }, 400);
    }

    const db = new Database(c.env.DB);
    const authUser = await getAuthUser(c);
    const stats = await db.getCommentLikeStats(commentId, authUser?.id);

    return c.json(stats);
});

// POST /api/v1/comments/:commentId/likes
likes.post('/comments/:commentId/likes', async (c) => {
    const commentId = parseInt(c.req.param('commentId'));
    if (isNaN(commentId)) {
        return c.json({ error: 'Invalid comment_id' }, 400);
    }

    const authUser = await getAuthUser(c);
    if (!authUser) {
        return c.json({ error: 'Authentication required' }, 401);
    }

    const db = new Database(c.env.DB);
    await db.addCommentLike(commentId, authUser.id);
    // Get fresh stats
    const stats = await db.getCommentLikeStats(commentId, authUser.id);

    return c.json(stats);
});

// DELETE /api/v1/comments/:commentId/likes
likes.delete('/comments/:commentId/likes', async (c) => {
    const commentId = parseInt(c.req.param('commentId'));
    if (isNaN(commentId)) {
        return c.json({ error: 'Invalid comment_id' }, 400);
    }

    const authUser = await getAuthUser(c);
    if (!authUser) {
        return c.json({ error: 'Authentication required' }, 401);
    }

    const db = new Database(c.env.DB);
    await db.removeCommentLike(commentId, authUser.id);
    // Get fresh stats
    const stats = await db.getCommentLikeStats(commentId, authUser.id);

    return c.json(stats);
});

export { likes };
