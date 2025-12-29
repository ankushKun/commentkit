import { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';

// Types
interface Comment {
    id: number;
    author_name: string;
    author_email_hash: string | null;
    content: string;
    parent_id: number | null;
    likes: number;
    user_liked: boolean;
    created_at: string;
    replies: Comment[];
}

interface PageData {
    page_id: number;
    slug: string;
    title: string | null;
    comment_count: number;
    likes: number;
    user_liked: boolean;
    comments: Comment[];
}

interface WidgetConfig {
    apiBase: string;
    domain: string;
    pageId: string;
    pageTitle: string;
    pageUrl: string;
    theme: 'light' | 'dark' | 'auto';
    parentOrigin: string;
}

// Utility functions
function timeAgo(date: string): string {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    const intervals = [
        { label: 'year', seconds: 31536000 },
        { label: 'month', seconds: 2592000 },
        { label: 'week', seconds: 604800 },
        { label: 'day', seconds: 86400 },
        { label: 'hour', seconds: 3600 },
        { label: 'minute', seconds: 60 },
    ];

    for (const interval of intervals) {
        const count = Math.floor(seconds / interval.seconds);
        if (count >= 1) {
            return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
        }
    }
    return 'just now';
}

function getInitials(name: string): string {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
}

function buildCommentTree(comments: Comment[]): Comment[] {
    const map = new Map<number, Comment>();
    const roots: Comment[] = [];

    // Create map
    comments.forEach((c) => {
        map.set(c.id, { ...c, replies: [] });
    });

    // Build tree
    comments.forEach((c) => {
        const comment = map.get(c.id)!;
        if (c.parent_id && map.has(c.parent_id)) {
            map.get(c.parent_id)!.replies.push(comment);
        } else {
            roots.push(comment);
        }
    });

    return roots;
}

// Comment Component
function CommentItem({ comment, onReply, depth = 0 }: { comment: Comment; onReply: (id: number) => void; depth?: number }) {
    const isPending = false; // TODO: Add status to API response

    return (
        <div className={`border-b border-border last:border-0 ${depth > 0 ? 'ml-12 pl-4 border-l-2' : ''}`}>
            <div className="py-4">
                <div className="flex items-start gap-3 mb-2">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                        {getInitials(comment.author_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{comment.author_name}</span>
                            {isPending && (
                                <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                    Pending
                                </span>
                            )}
                            <span className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
                        </div>
                        <p className="text-sm mt-1 whitespace-pre-wrap break-words">{comment.content}</p>
                        <div className="flex items-center gap-3 mt-2">
                            <button className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                                <span>❤️</span>
                                <span>{comment.likes > 0 ? comment.likes : 'Like'}</span>
                            </button>
                            {depth === 0 && (
                                <button
                                    onClick={() => onReply(comment.id)}
                                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                                >
                                    Reply
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {comment.replies.length > 0 && (
                <div>
                    {comment.replies.map((reply) => (
                        <CommentItem key={reply.id} comment={reply} onReply={onReply} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
}

// Comment Form Component
function CommentForm({
    onSubmit,
    replyTo,
    onCancelReply,
}: {
    onSubmit: (data: { name: string; email: string; content: string; parentId?: number }) => Promise<void>;
    replyTo: number | null;
    onCancelReply: () => void;
}) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [content, setContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!name.trim() || !content.trim()) {
            setError('Name and comment are required');
            return;
        }

        setSubmitting(true);
        try {
            await onSubmit({
                name: name.trim(),
                email: email.trim(),
                content: content.trim(),
                parentId: replyTo || undefined,
            });
            setSuccess('Comment posted! It may need approval before appearing.');
            setName('');
            setEmail('');
            setContent('');
            if (replyTo) onCancelReply();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to post comment');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="bg-secondary/50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-3">{replyTo ? 'Write a Reply' : 'Leave a Comment'}</h3>
            {error && <div className="mb-3 p-3 bg-destructive/10 text-destructive text-sm rounded">{error}</div>}
            {success && <div className="mb-3 p-3 bg-green-500/10 text-green-600 dark:text-green-400 text-sm rounded">{success}</div>}
            <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium mb-1">
                            Name *
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                            className="w-full px-3 py-2 rounded border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium mb-1">
                            Email (optional)
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            className="w-full px-3 py-2 rounded border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>
                <div>
                    <label htmlFor="content" className="block text-sm font-medium mb-1">
                        Comment *
                    </label>
                    <textarea
                        id="content"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder={replyTo ? 'Write a reply...' : 'Share your thoughts...'}
                        rows={4}
                        className="w-full px-3 py-2 rounded border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
                        required
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? 'Posting...' : 'Post Comment'}
                    </button>
                    {replyTo && (
                        <button
                            type="button"
                            onClick={onCancelReply}
                            className="px-4 py-2 border border-border rounded text-sm font-medium hover:bg-secondary transition-colors"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}

// Main Widget Component
function CommentWidget({ config }: { config: WidgetConfig }) {
    const [pageData, setPageData] = useState<PageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [replyTo, setReplyTo] = useState<number | null>(null);

    // Notify parent of height changes
    const notifyHeight = useCallback(() => {
        const height = document.body.scrollHeight;
        console.log('[CommentKit Widget] Notifying height:', height);
        window.parent.postMessage(
            {
                type: 'commentkit',
                action: 'resize',
                height: height,
            },
            config.parentOrigin
        );
    }, [config.parentOrigin]);

    // Load comments
    const loadComments = useCallback(async () => {
        try {
            const params = new URLSearchParams({
                domain: config.domain,
                pageId: config.pageId,
                title: config.pageTitle,
                url: config.pageUrl,
            });

            const response = await fetch(`${config.apiBase}/api/v1/sites/comments?${params}`);
            const data = await response.json();

            if (data.error) {
                setError(data.error);
            } else {
                setPageData(data);
                setError(null);
            }
        } catch (err) {
            setError('Failed to load comments');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [config]);

    // Submit comment
    const handleSubmitComment = async (data: { name: string; email: string; content: string; parentId?: number }) => {
        const response = await fetch(`${config.apiBase}/api/v1/sites/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                domain: config.domain,
                pageId: config.pageId,
                author_name: data.name,
                author_email: data.email || undefined,
                content: data.content,
                parent_id: data.parentId,
                page_title: config.pageTitle,
                page_url: config.pageUrl,
            }),
        });

        const result = await response.json();
        if (result.error) {
            throw new Error(result.error);
        }

        // Reload comments
        await loadComments();
    };

    // Initial load
    useEffect(() => {
        loadComments();
    }, [loadComments]);

    // Notify height changes
    useEffect(() => {
        notifyHeight();
        const observer = new ResizeObserver(notifyHeight);
        observer.observe(document.body);
        return () => observer.disconnect();
    }, [notifyHeight]);

    // Notify ready
    useEffect(() => {
        window.parent.postMessage(
            {
                type: 'commentkit',
                action: 'ready',
            },
            config.parentOrigin
        );
    }, [config.parentOrigin]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-3 text-muted-foreground">Loading comments...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
                <p className="font-semibold">Error</p>
                <p className="text-sm">{error}</p>
            </div>
        );
    }

    if (!pageData) {
        return null;
    }

    const commentTree = buildCommentTree(pageData.comments);

    return (
        <div className="w-full p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">Comments</h2>
                    {pageData.comment_count > 0 && (
                        <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">
                            {pageData.comment_count}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border hover:border-primary transition-colors text-sm">
                        <span>❤️</span>
                        <span>{pageData.likes > 0 ? pageData.likes : 'Like'}</span>
                    </button>
                </div>
            </div>

            {/* Comment Form */}
            <CommentForm onSubmit={handleSubmitComment} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />

            {/* Comments List */}
            <div>
                {commentTree.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <p className="text-lg mb-1">No comments yet</p>
                        <p className="text-sm">Be the first to share your thoughts!</p>
                    </div>
                ) : (
                    <div className="space-y-0">
                        {commentTree.map((comment) => (
                            <CommentItem key={comment.id} comment={comment} onReply={setReplyTo} />
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-border text-center text-sm text-muted-foreground">
                Powered by{' '}
                <a href={config.apiBase} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    CommentKit
                </a>
            </div>
        </div>
    );
}

// Initialize widget
function initWidget() {
    const params = new URLSearchParams(window.location.search);
    const config: WidgetConfig = {
        apiBase: 'http://localhost:8787',
        domain: params.get('domain') || '',
        pageId: params.get('pageId') || '',
        pageTitle: decodeURIComponent(params.get('pageTitle') || ''),
        pageUrl: decodeURIComponent(params.get('pageUrl') || ''),
        theme: (params.get('theme') as 'light' | 'dark' | 'auto') || 'auto',
        parentOrigin: params.get('origin') || '*',
    };

    // Apply theme
    if (config.theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else if (config.theme === 'light') {
        document.documentElement.classList.remove('dark');
    }

    const root = document.getElementById('widget-root');
    if (!root) {
        console.error('Widget root element not found');
        return;
    }

    if (!config.domain) {
        root.innerHTML = '<div class="p-4 bg-destructive/10 text-destructive rounded">Error: Missing domain parameter</div>';
        return;
    }

    if (!config.pageId) {
        root.innerHTML = '<div class="p-4 bg-destructive/10 text-destructive rounded">Error: Missing pageId parameter</div>';
        return;
    }

    createRoot(root).render(<CommentWidget config={config} />);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
} else {
    initWidget();
}
