// Type definitions for CommentKit

export interface Site {
    id: number;
    name: string;
    domain: string;
    api_key: string;
    owner_id: number | null;
    settings: string;
    verified: number;
    verification_token: string | null;
    verified_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface Page {
    id: number;
    site_id: number;
    slug: string;
    title: string | null;
    url: string | null;
    created_at: string;
}

export interface User {
    id: number;
    email: string;
    email_verified: number;
    email_hash: string | null;
    display_name: string | null;
    avatar_url: string | null;
    is_superadmin: number;
    created_at: string;
    updated_at: string;
}

export interface Comment {
    id: number;
    site_id: number;
    page_id: number;
    user_id: number | null;
    author_name: string | null;
    author_email: string | null;
    author_email_hash: string | null;
    parent_id: number | null;
    content: string;
    status: 'pending' | 'approved' | 'rejected' | 'spam';
    ip_address: string | null;
    user_agent: string | null;
    is_edited: number;
    created_at: string;
    updated_at: string;
}

export interface Session {
    id: number;
    user_id: number;
    token_hash: string;
    expires_at: string;
    created_at: string;
}

export interface MagicLink {
    id: number;
    email: string;
    token: string;
    expires_at: string;
    used: number;
    created_at: string;
}

export interface Reaction {
    id: number;
    comment_id: number;
    user_id: number;
    reaction: 'like' | 'love' | 'laugh' | 'sad' | 'angry';
    created_at: string;
}

export interface PageLike {
    id: number;
    page_id: number;
    user_id: number;
    created_at: string;
}

export interface LikeStats {
    total_likes: number;
    user_liked: boolean;
}

// API Response types
export interface CommentResponse {
    id: number;
    author_name: string;
    author_email_hash: string | null;
    content: string;
    parent_id: number | null;
    likes: number;
    user_liked: boolean;
    created_at: string;
    replies: CommentResponse[];
}

export interface PageResponse {
    page_id: number;
    slug: string;
    title: string | null;
    comment_count: number;
    likes: number;
    user_liked: boolean;
    comments: CommentResponse[];
}

// Environment bindings
export interface Env {
    DB: D1Database;
    ASSETS: Fetcher;
    JWT_SECRET: string;
    RESEND_API_KEY?: string;
    ENVIRONMENT: string;
    BASE_URL: string;
    FRONTEND_URL?: string;
    ALLOWED_ORIGINS?: string;
    // Privacy settings
    COLLECT_IP_ADDRESS?: string;  // 'true' or 'false' (default: 'false')
    COLLECT_USER_AGENT?: string;  // 'true' or 'false' (default: 'false')
}

// Auth context
export interface AuthUser {
    id: number;
    email: string;
    email_hash: string | null;
    display_name: string | null;
    is_superadmin: boolean;
    created_at: string;
    updated_at: string;
}

// Dashboard types
export interface PageWithStats extends Page {
    comment_count: number;
    pending_count: number;
    latest_comment_at: string | null;
}

export interface ActivityItem {
    id: number;
    type: 'comment' | 'reply';
    author_name: string | null;
    content: string;
    page_title: string | null;
    page_slug: string;
    status: string;
    created_at: string;
}

export interface AnalyticsData {
    summary: {
        total_comments: number;
        approved: number;
        pending: number;
        spam: number;
        rejected: number;
    };
    daily_comments: { date: string; count: number; approved: number; pending: number }[];
    top_pages: { slug: string; title: string | null; comment_count: number }[];
    top_commenters: { author_name: string; comment_count: number }[];
}
