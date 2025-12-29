// Type definitions for CommentKit

export interface Site {
    id: number;
    name: string;
    domain: string;
    api_key: string;
    owner_id: number | null;
    settings: string;
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
    JWT_SECRET: string;
    RESEND_API_KEY?: string;
    ENVIRONMENT: string;
    BASE_URL: string;
    FRONTEND_URL?: string;
}

// Auth context
export interface AuthUser {
    id: number;
    email: string;
    display_name: string | null;
    is_superadmin: boolean;
}
