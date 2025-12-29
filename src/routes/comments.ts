import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { Database } from '../db';
import { getAuthUser } from '../middleware';
import type { CommentResponse, Env, PageResponse } from '../types';

const comments = new Hono<{ Bindings: Env }>();

// Hash email for gravatar
async function hashEmail(email: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(email.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// GET /api/v1/sites/:siteId/pages/:slug - Get page comments + likes
comments.get('/:siteId/pages/:slug', async (c) => {
    const siteId = parseInt(c.req.param('siteId'));
    const slug = c.req.param('slug');

    if (isNaN(siteId)) {
        return c.json({ error: 'Invalid site_id' }, 400);
    }

    const db = new Database(c.env.DB);

    // Get site
    const site = await db.getSiteById(siteId);
    if (!site) {
        return c.json({ error: 'Site not found' }, 404);
    }

    // Get page
    const page = await db.getPageBySlug(site.id, slug);
    if (!page) {
        return c.json({ error: 'Page not found' }, 404);
    }

    // Get user ID from auth if present
    const authUser = await getAuthUser(c);
    const userId = authUser?.id;

    // Get comments
    const pageComments = await db.getCommentsByPage(page.id);

    // Get like stats for all comments
    const commentIds = pageComments.map((comment) => comment.id);
    const likeStats = await db.getCommentLikeStatsBatch(commentIds, userId);

    // Get page like stats
    const pageLikes = await db.getPageLikeStats(page.id, userId);
    const commentCount = await db.getCommentCount(page.id);

    // Build response
    const commentResponses: CommentResponse[] = await Promise.all(
        pageComments.map(async (comment) => {
            const stats = likeStats.get(comment.id) ?? { total_likes: 0, user_liked: false };
            return {
                id: comment.id,
                author_name: comment.author_name ?? '',
                author_email_hash: comment.author_email ? await hashEmail(comment.author_email) : null,
                content: comment.content,
                parent_id: comment.parent_id,
                likes: stats.total_likes,
                user_liked: stats.user_liked,
                created_at: comment.created_at,
                replies: [],
            };
        })
    );

    const response: PageResponse = {
        page_id: page.id,
        slug: slug,
        title: page.title,
        comment_count: commentCount,
        likes: pageLikes.total_likes,
        user_liked: pageLikes.user_liked,
        comments: commentResponses,
    };

    return c.json(response);
});

// POST /api/v1/sites/:siteId/pages/:slug - Create comment
const createCommentSchema = z.object({
    author_name: z.string().optional(),
    author_email: z.string().email().optional(),
    content: z.string().min(1),
    parent_id: z.number().optional(),
    page_title: z.string().optional(),
    page_url: z.string().optional(),
});

comments.post('/:siteId/pages/:slug', zValidator('json', createCommentSchema), async (c) => {
    const siteId = parseInt(c.req.param('siteId'));
    const slug = c.req.param('slug');
    const body = c.req.valid('json');

    if (isNaN(siteId)) {
        return c.json({ error: 'Invalid site_id' }, 400);
    }

    const db = new Database(c.env.DB);

    // Get site
    const site = await db.getSiteById(siteId);
    if (!site) {
        return c.json({ error: 'Site not found' }, 404);
    }

    // Get or create page
    const page = await db.getOrCreatePage(site.id, slug, body.page_title, body.page_url);

    // Get auth user if present
    const authUser = await getAuthUser(c);

    // Validate: either authenticated or has author_name
    let userId: number | undefined;
    let authorName: string | undefined;

    if (authUser) {
        userId = authUser.id;
        authorName = authUser.display_name ?? authUser.email;
    } else {
        if (!body.author_name?.trim()) {
            return c.json({ error: 'author_name is required for anonymous comments' }, 400);
        }
        authorName = body.author_name;
    }

    // Get client info
    const ipAddress = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For');
    const userAgent = c.req.header('User-Agent');

    const comment = await db.createComment({
        siteId: site.id,
        pageId: page.id,
        userId,
        authorName,
        authorEmail: body.author_email,
        parentId: body.parent_id,
        content: body.content,
        ipAddress: ipAddress ?? undefined,
        userAgent: userAgent ?? undefined,
    });

    const response: CommentResponse = {
        id: comment.id,
        author_name: comment.author_name ?? '',
        author_email_hash: comment.author_email ? await hashEmail(comment.author_email) : null,
        content: comment.content,
        parent_id: comment.parent_id,
        likes: 0,
        user_liked: false,
        created_at: comment.created_at,
        replies: [],
    };

    return c.json(response, 201);
});

export { comments };
