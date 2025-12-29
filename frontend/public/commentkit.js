/**
 * CommentKit - Embeddable Comment System
 * Renders natively in the host page, uses hidden iframe for cross-domain auth & API calls
 * 
 * USAGE:
 *   <div id="commentkit"></div>
 *   <script src="https://your-frontend.com/commentkit.js"></script>
 */

(function () {
    'use strict';

    const currentScript = document.currentScript;
    const scriptOrigin = currentScript ? new URL(currentScript.src).origin : '';
    const CONFIG = {
        // Where the widget iframe is served from (frontend)
        baseUrl: scriptOrigin || window.COMMENTKIT_BASE_URL || '',
        // Where API calls go (backend) - can be configured separately
        apiUrl: currentScript?.getAttribute('data-api-url') || window.COMMENTKIT_API_URL || scriptOrigin || '',
    };

    const CommentKit = {
        version: '2.0.0',
        instances: [],

        init: function (options) {
            if (!options.container) {
                console.error('[CommentKit] Container is required');
                return null;
            }

            const container = typeof options.container === 'string'
                ? document.querySelector(options.container)
                : options.container;

            if (!container) {
                console.error('[CommentKit] Container element not found:', options.container);
                return null;
            }

            const domain = window.location.hostname;
            const pageId = options.pageId || window.location.href;
            const pageTitle = options.pageTitle || document.title;
            const pageUrl = options.pageUrl || window.location.href;
            const theme = options.theme || 'auto';

            const instance = new CommentWidget(container, {
                domain,
                pageId,
                pageTitle,
                pageUrl,
                theme,
                widgetBase: CONFIG.baseUrl,  // Where widget iframe is served
                apiBase: CONFIG.apiUrl,       // Where API calls go
            });

            this.instances.push(instance);
            return instance;
        },
    };

    // Main Comment Widget Class
    class CommentWidget {
        constructor(container, config) {
            this.container = container;
            this.config = config;
            this.iframe = null;
            this.csrfToken = this.generateCsrfToken();
            this.state = {
                loading: true,
                error: null,
                comments: [],
                pageData: null,
                replyTo: null,
                user: null,              // Authenticated user
                authMode: 'guest',       // 'guest' | 'login'
                loginEmail: '',          // Email entered for login
                loginSent: false,        // Magic link sent
                authLoading: false,      // Auth action in progress
            };

            this.init();
        }

        init() {
            this.injectStyles();
            this.setupMessageListener();
            this.createHiddenIframe();
            this.render();
            // loadComments() will be called when bridge sends 'bridgeReady'
        }

        injectStyles() {
            // Remove existing styles to force update (useful for dev/HMR)
            const existing = document.getElementById('commentkit-styles');
            if (existing) existing.remove();

            const style = document.createElement('style');
            style.id = 'commentkit-styles';
            style.textContent = `
                .ck-widget {
                    --ck-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
                    --ck-primary: #3b82f6;
                    --ck-primary-hover: #2563eb;
                    --ck-text: #1f2937;
                    --ck-text-muted: #6b7280;
                    --ck-border: #e5e7eb;
                    --ck-bg: white;
                    --ck-bg-muted: #f9fafb;
                    --ck-danger: #ef4444;
                    --ck-radius: 8px;
                    
                    font-family: var(--ck-font-family);
                    color: var(--ck-text);
                    line-height: 1.5;
                    max-width: 100%;
                }

                .ck-widget * {
                    box-sizing: border-box;
                }

                /* Header */
                .ck-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                    padding-bottom: 16px;
                    border-bottom: 1px solid var(--ck-border);
                }

                .ck-title {
                    font-size: 1.125rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    color: #111827;
                }

                .ck-count {
                    background: var(--ck-bg-muted);
                    color: var(--ck-text-muted);
                    font-size: 0.75rem;
                    font-weight: 600;
                    padding: 2px 10px;
                    border-radius: 12px;
                    border: 1px solid var(--ck-border);
                }

                .ck-like-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    border: 1px solid var(--ck-border);
                    border-radius: 20px;
                    background: white;
                    color: var(--ck-text-muted);
                    cursor: pointer;
                    font-size: 0.875rem;
                    font-weight: 500;
                    transition: all 0.2s ease;
                }

                .ck-like-btn:hover {
                    border-color: #d1d5db;
                    background: var(--ck-bg-muted);
                    color: var(--ck-text);
                }

                /* Forms */
                .ck-form {
                    padding: 0;
                    margin-bottom: 32px;
                }

                .ck-form h3 {
                    font-size: 1rem;
                    margin: 0 0 16px 0;
                    font-weight: 600;
                    color: #374151;
                }

                .ck-form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                    margin-bottom: 16px;
                }

                @media (max-width: 640px) {
                    .ck-form-row { grid-template-columns: 1fr; }
                }

                .ck-form-group {
                    margin-bottom: 16px;
                }

                .ck-form-group label {
                    display: block;
                    font-size: 0.875rem;
                    font-weight: 500;
                    margin-bottom: 6px;
                    color: #4b5563;
                }

                .ck-form-group input, 
                .ck-form-group textarea {
                    width: 100%;
                    padding: 12px;
                    border: 1px solid var(--ck-border);
                    border-radius: var(--ck-radius);
                    font-size: 0.95rem;
                    font-family: inherit;
                    color: var(--ck-text);
                    background: var(--ck-bg-muted);
                    transition: all 0.2s;
                }

                .ck-form-group input:focus, 
                .ck-form-group textarea:focus {
                    outline: none;
                    background: white;
                    border-color: var(--ck-primary);
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
                }

                .ck-form-group textarea {
                    min-height: 120px;
                    resize: vertical;
                    line-height: 1.6;
                }

                /* Buttons */
                .ck-btn {
                    display: inline-flex;
                    justify-content: center;
                    align-items: center;
                    padding: 10px 24px;
                    border-radius: var(--ck-radius);
                    font-size: 0.95rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 1px solid transparent;
                    line-height: 1.25rem;
                }

                .ck-btn-primary {
                    background: var(--ck-primary);
                    color: white;
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                }

                .ck-btn-primary:hover {
                    background: var(--ck-primary-hover);
                    transform: translateY(-1px);
                }

                .ck-btn-primary:active {
                    transform: translateY(0);
                }

                .ck-btn-primary:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                    transform: none;
                }

                .ck-btn-secondary {
                    background: white;
                    border-color: var(--ck-border);
                    color: #374151;
                }

                .ck-btn-secondary:hover {
                    background: #f3f4f6;
                }

                /* User Info Card */
                .ck-user-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 20px;
                    padding: 4px;
                }

                .ck-user-info .ck-avatar {
                    width: 40px;
                    height: 40px;
                    font-size: 0.9rem;
                    box-shadow: none;
                    border: 1px solid var(--ck-border);
                }

                .ck-user-details {
                    flex: 1;
                }

                .ck-user-name {
                    font-weight: 600;
                    font-size: 0.95rem;
                    color: var(--ck-text);
                }

                .ck-user-email {
                    font-size: 0.85rem;
                    color: var(--ck-text-muted);
                }

                .ck-logout-btn {
                    background: transparent;
                    border: none;
                    color: var(--ck-text-muted);
                    font-size: 0.85rem;
                    cursor: pointer;
                    padding: 4px 8px;
                    text-decoration: underline;
                    transition: color 0.2s;
                    font-family: inherit;
                }

                .ck-logout-btn:hover {
                    color: var(--ck-danger);
                }
                
                /* Auth Toggle */
                .ck-auth-toggle {
                    display: flex;
                    gap: 4px;
                    margin-bottom: 20px;
                    background: var(--ck-bg-muted);
                    padding: 4px;
                    border-radius: var(--ck-radius);
                    border: 1px solid var(--ck-border);
                }

                .ck-auth-toggle button {
                    flex: 1;
                    padding: 8px 12px;
                    border: none;
                    background: transparent;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: #6b7280;
                    transition: all 0.15s;
                }

                .ck-auth-toggle button.active {
                    background: white;
                    color: var(--ck-primary);
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                }

                /* Comments List */
                .ck-comments {
                    margin-top: 40px;
                }

                .ck-comment {
                    margin-bottom: 32px;
                    animation: ck-fade-in 0.3s ease-out;
                }
                
                @keyframes ck-fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .ck-comment-inner {
                    display: flex;
                    gap: 16px;
                }

                .ck-avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: #eff6ff;
                    color: var(--ck-primary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 0.95rem;
                    flex-shrink: 0;
                    border: 1px solid #dbeafe;
                }

                .ck-comment-content {
                    flex: 1;
                    min-width: 0;
                }

                .ck-comment-header {
                    display: flex;
                    align-items: baseline;
                    gap: 10px;
                    margin-bottom: 6px;
                }

                .ck-comment-author {
                    font-weight: 700;
                    font-size: 0.95rem;
                    color: #111827;
                }

                .ck-comment-date {
                    color: #9ca3af;
                    font-size: 0.8rem;
                }

                .ck-comment-body {
                    color: #374151;
                    font-size: 1rem;
                    line-height: 1.6;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    margin-bottom: 12px;
                }

                .ck-comment-actions {
                    display: flex;
                    gap: 16px;
                }

                .ck-comment-action {
                    background: none;
                    border: none;
                    color: #6b7280;
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    padding: 0;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    transition: color 0.15s;
                }

                .ck-comment-action:hover {
                    color: var(--ck-primary);
                }
                
                .ck-comment-action.liked {
                    color: var(--ck-danger);
                }

                /* Threaded Replies */
                .ck-replies {
                    margin-top: 24px;
                    margin-left: 20px;
                    padding-left: 24px;
                    border-left: 2px solid #f3f4f6;
                }

                /* States */
                .ck-empty, .ck-loading {
                    text-align: center;
                    padding: 60px 20px;
                    color: var(--ck-text-muted);
                }

                .ck-spinner {
                    width: 24px;
                    height: 24px;
                    border: 2px solid #e5e7eb;
                    border-top-color: var(--ck-primary);
                    border-radius: 50%;
                    animation: ck-spin 0.8s linear infinite;
                    margin: 0 auto 16px;
                }

                @keyframes ck-spin { to { transform: rotate(360deg); } }

                .ck-error {
                    background: #fef2f2;
                    color: #b91c1c;
                    padding: 16px;
                    border-radius: var(--ck-radius);
                    margin-bottom: 24px;
                    border: 1px solid #fecaca;
                    font-size: 0.95rem;
                }
                
                .ck-footer {
                    margin-top: 56px;
                    padding-top: 24px;
                    border-top: 1px solid var(--ck-border);
                    text-align: center;
                    font-size: 0.8px;
                    color: #9ca3af;
                }
                
                .ck-footer a {
                    color: #d1d5db;
                    text-decoration: none;
                    transition: color 0.15s;
                }
                
                .ck-footer a:hover {
                    color: #9ca3af;
                }
            `;
            document.head.appendChild(style);
        }

        createHiddenIframe() {
            this.iframe = document.createElement('iframe');
            this.iframe.style.cssText = 'display: none;';

            // Build iframe URL with required security parameters
            const iframeParams = new URLSearchParams({
                domain: this.config.domain,
                pageId: this.config.pageId,
                parentOrigin: window.location.origin,  // Required for origin validation
                apiBase: this.config.apiBase,          // Where API calls should go
                csrfToken: this.csrfToken,             // CSRF token for mutation requests
            });

            // Widget iframe is served from widgetBase, but API calls go to apiBase
            this.iframe.src = `${this.config.widgetBase}/widget?${iframeParams}`;
            document.body.appendChild(this.iframe);
        }

        setupMessageListener() {
            window.addEventListener('message', (event) => {
                // Messages come from the widget iframe (widgetBase), not the API server
                if (event.origin !== this.config.widgetBase) return;
                if (!event.data || event.data.type !== 'commentkit') return;

                console.log('[CommentKit] Received:', event.data);

                switch (event.data.action) {
                    case 'commentsLoaded':
                        this.state.pageData = event.data.data;
                        this.state.comments = event.data.data.comments || [];
                        this.state.loading = false;
                        this.state.error = null;
                        this.render();
                        break;
                    case 'bridgeReady':
                        console.log('[CommentKit] Bridge ready, user:', event.data.user?.email || 'guest');
                        this.state.user = event.data.user || null;
                        this.loadComments();
                        break;
                    case 'commentPosted':
                        this.state.loginSent = false;
                        this.state.authMode = 'guest';
                        this.loadComments();
                        break;
                    case 'authStateChanged':
                        this.state.user = event.data.user || null;
                        this.state.authLoading = false;
                        this.state.loginSent = false;
                        this.state.authMode = 'guest';
                        this.render();
                        break;
                    case 'loginEmailSent':
                        this.state.loginSent = true;
                        this.state.loginEmail = event.data.email;
                        this.state.authLoading = false;
                        this.render();
                        break;
                    case 'error':
                        this.state.error = event.data.message;
                        this.state.loading = false;
                        this.state.authLoading = false;
                        this.render();
                        break;
                }
            });
        }

        loadComments() {
            this.state.loading = true;
            this.render();
            this.sendToIframe({
                action: 'loadComments',
                domain: this.config.domain,
                pageId: this.config.pageId,
                pageTitle: this.config.pageTitle,
                pageUrl: this.config.pageUrl,
            });
        }

        postComment(data) {
            this.sendToIframe({
                action: 'postComment',
                domain: this.config.domain,
                pageId: this.config.pageId,
                pageTitle: this.config.pageTitle,
                pageUrl: this.config.pageUrl,
                csrfToken: this.csrfToken,  // Include CSRF token for server validation
                ...data,
            });
        }

        sendToIframe(message) {
            if (this.iframe && this.iframe.contentWindow) {
                this.iframe.contentWindow.postMessage(
                    { type: 'commentkit', ...message },
                    this.config.widgetBase  // Post to iframe's origin
                );
            }
        }

        render() {
            if (this.state.loading) {
                this.container.innerHTML = `
                    <div class="ck-widget">
                        <div class="ck-loading">
                            <div class="ck-spinner"></div>
                            <p>Loading conversation...</p>
                        </div>
                    </div>
                `;
                return;
            }

            if (this.state.error) {
                this.container.innerHTML = `
                    <div class="ck-widget">
                        <div class="ck-error">${this.escapeHtml(this.state.error)}</div>
                    </div>
                `;
                return;
            }

            const pageData = this.state.pageData || { comment_count: 0, likes: 0, comments: [] };
            const commentTree = this.buildTree(this.state.comments);

            this.container.innerHTML = `
                <div class="ck-widget">
                    <div class="ck-header">
                        <div class="ck-title">
                            Discussion
                            ${pageData.comment_count > 0 ? `<span class="ck-count">${pageData.comment_count}</span>` : ''}
                        </div>
                        <button class="ck-like-btn">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                            <span>${pageData.likes > 0 ? pageData.likes : 'Like Page'}</span>
                        </button>
                    </div>

                    ${this.renderForm()}
                    ${this.renderComments(commentTree)}

                    <div class="ck-footer">
                        Powered by <a href="${this.config.apiBase}" target="_blank">CommentKit</a>
                    </div>
                </div>
            `;

            this.attachEventListeners();
        }

        renderForm() {
            const { user, authMode, loginSent, loginEmail, replyTo } = this.state;

            // If user is authenticated, show simplified form
            if (user) {
                const displayName = user.display_name || user.email.split('@')[0];
                const initials = displayName.charAt(0).toUpperCase();
                return `
                    <div class="ck-form">
                        <h3>${replyTo ? 'Write a Reply' : 'Leave a Comment'}</h3>
                        <div class="ck-user-info">
                            <div class="ck-avatar">${initials}</div>
                            <div class="ck-user-details">
                                <div class="ck-user-name">${this.escapeHtml(displayName)}</div>
                                <div class="ck-user-email">${this.escapeHtml(user.email)}</div>
                            </div>
                            <button type="button" class="ck-logout-btn" id="ck-logout">Sign out</button>
                        </div>
                        <form id="ck-comment-form">
                            <div class="ck-form-group">
                                <textarea id="ck-content" name="content" required placeholder="${replyTo ? 'Write a reply...' : 'Share your thoughts...'}"></textarea>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button type="submit" class="ck-btn ck-btn-primary">Post Comment</button>
                                ${replyTo ? '<button type="button" id="ck-cancel-reply" class="ck-btn ck-btn-secondary">Cancel</button>' : ''}
                            </div>
                        </form>
                    </div>
                `;
            }

            // If magic link was sent, show confirmation
            if (loginSent) {
                return `
                    <div class="ck-form">
                        <h3>Check your email</h3>
                        <div class="ck-login-sent">
                            <p>We sent a login link to <span class="email">${this.escapeHtml(loginEmail)}</span></p>
                            <p>Click the link in the email to sign in.</p>
                            <button type="button" class="ck-link-btn" id="ck-back-to-form">Use a different email</button>
                        </div>
                    </div>
                `;
            }

            // Show auth toggle and appropriate form
            return `
                <div class="ck-form">
                    <h3>${replyTo ? 'Write a Reply' : 'Leave a Comment'}</h3>
                    <div class="ck-auth-toggle">
                        <button type="button" id="ck-mode-guest" class="${authMode === 'guest' ? 'active' : ''}">Comment as Guest</button>
                        <button type="button" id="ck-mode-login" class="${authMode === 'login' ? 'active' : ''}">Sign in to Comment</button>
                    </div>
                    ${authMode === 'guest' ? this.renderGuestForm() : this.renderLoginForm()}
                </div>
            `;
        }

        renderGuestForm() {
            return `
                <form id="ck-comment-form">
                    <div class="ck-form-row">
                        <div class="ck-form-group">
                            <label for="ck-name">Name *</label>
                            <input type="text" id="ck-name" name="name" required placeholder="Your name">
                        </div>
                        <div class="ck-form-group">
                            <label for="ck-email">Email (optional)</label>
                            <input type="email" id="ck-email" name="email" placeholder="your@email.com">
                        </div>
                    </div>
                    <div class="ck-form-group">
                        <label for="ck-content">Comment *</label>
                        <textarea id="ck-content" name="content" required placeholder="${this.state.replyTo ? 'Write a reply...' : 'Share your thoughts...'}"></textarea>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button type="submit" class="ck-btn ck-btn-primary">Post Comment</button>
                        ${this.state.replyTo ? '<button type="button" id="ck-cancel-reply" class="ck-btn ck-btn-secondary">Cancel</button>' : ''}
                    </div>
                </form>
            `;
        }

        renderLoginForm() {
            return `
                <form id="ck-login-form">
                    <div class="ck-form-group">
                        <label for="ck-login-email">Email address</label>
                        <input type="email" id="ck-login-email" name="email" required placeholder="your@email.com">
                    </div>
                    <p style="font-size: 0.85rem; color: #6b7280; margin-bottom: 12px;">
                        We'll send you a magic link to sign in. No password needed.
                    </p>
                    <button type="submit" class="ck-btn ck-btn-primary" ${this.state.authLoading ? 'disabled' : ''}>
                        ${this.state.authLoading ? 'Sending...' : 'Send Login Link'}
                    </button>
                </form>
            `;
        }

        renderComments(comments) {
            if (comments.length === 0) {
                return `
                    <div class="ck-empty">
                        <p style="font-size: 1.1rem; margin-bottom: 4px;">No comments yet</p>
                        <p>Be the first to share your thoughts!</p>
                    </div>
                `;
            }

            return `<div class="ck-comments">${comments.map(c => this.renderComment(c)).join('')}</div>`;
        }

        renderComment(comment, depth = 0) {
            const initials = comment.author_name ? comment.author_name.charAt(0).toUpperCase() : '?';
            const timeAgo = this.formatTimeAgo(comment.created_at);
            const isLiked = false; // TODO: Track user likes

            return `
                <div class="ck-comment" data-id="${comment.id}">
                    <div class="ck-comment-inner">
                        <div class="ck-avatar">${initials}</div>
                        <div class="ck-comment-content">
                            <div class="ck-comment-header">
                                <span class="ck-comment-author">${this.escapeHtml(comment.author_name)}</span>
                                <span class="ck-comment-date">${timeAgo}</span>
                            </div>
                            <div class="ck-comment-body">${this.escapeHtml(comment.content)}</div>
                            <div class="ck-comment-actions">
                                <button class="ck-comment-action ${isLiked ? 'liked' : ''}">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                    </svg>
                                    ${comment.likes > 0 ? comment.likes : 'Like'}
                                </button>
                                ${depth === 0 ? `
                                    <button class="ck-comment-action ck-reply-btn" data-id="${comment.id}">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                        </svg>
                                        Reply
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    ${comment.replies && comment.replies.length > 0 ? `
                        <div class="ck-replies">
                            ${comment.replies.map(r => this.renderComment(r, depth + 1)).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }

        attachEventListeners() {
            // Comment form submission
            const form = this.container.querySelector('#ck-comment-form');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const formData = new FormData(form);
                    const commentData = {
                        content: formData.get('content'),
                        parent_id: this.state.replyTo,
                    };
                    // Include guest fields only if not authenticated
                    if (!this.state.user) {
                        commentData.author_name = formData.get('name');
                        commentData.author_email = formData.get('email');
                    }
                    this.postComment(commentData);
                    form.reset();
                    this.state.replyTo = null;
                });
            }

            // Cancel reply
            const cancelBtn = this.container.querySelector('#ck-cancel-reply');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    this.state.replyTo = null;
                    this.render();
                });
            }

            // Reply buttons
            this.container.querySelectorAll('.ck-reply-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.state.replyTo = parseInt(btn.dataset.id);
                    this.render();
                    this.container.querySelector('#ck-content')?.focus();
                });
            });

            // Auth mode toggle
            const guestModeBtn = this.container.querySelector('#ck-mode-guest');
            if (guestModeBtn) {
                guestModeBtn.addEventListener('click', () => {
                    this.state.authMode = 'guest';
                    this.render();
                });
            }

            const loginModeBtn = this.container.querySelector('#ck-mode-login');
            if (loginModeBtn) {
                loginModeBtn.addEventListener('click', () => {
                    this.state.authMode = 'login';
                    this.render();
                });
            }

            // Login form submission
            const loginForm = this.container.querySelector('#ck-login-form');
            if (loginForm) {
                loginForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const formData = new FormData(loginForm);
                    this.state.authLoading = true;
                    this.render();
                    this.sendToIframe({
                        action: 'login',
                        email: formData.get('email'),
                    });
                });
            }

            // Back to form (from login sent state)
            const backBtn = this.container.querySelector('#ck-back-to-form');
            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    this.state.loginSent = false;
                    this.render();
                });
            }

            // Logout button
            const logoutBtn = this.container.querySelector('#ck-logout');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => {
                    this.sendToIframe({ action: 'logout' });
                });
            }
        }

        buildTree(comments) {
            const map = new Map();
            const roots = [];

            comments.forEach(c => map.set(c.id, { ...c, replies: [] }));
            comments.forEach(c => {
                const comment = map.get(c.id);
                if (c.parent_id && map.has(c.parent_id)) {
                    map.get(c.parent_id).replies.push(comment);
                } else {
                    roots.push(comment);
                }
            });

            return roots;
        }

        formatTimeAgo(date) {
            // SQLite stores timestamps as UTC without 'Z' suffix, so we need to append it
            // to ensure JavaScript parses it as UTC and converts to local time
            const utcDate = date.includes('Z') || date.includes('+') ? date : date.replace(' ', 'T') + 'Z';
            const d = new Date(utcDate);
            const now = new Date();
            const diffMs = now - d;
            const diffSecs = Math.floor(diffMs / 1000);
            const diffMins = Math.floor(diffSecs / 60);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            // Same day: relative time
            if (d.getDate() === now.getDate() &&
                d.getMonth() === now.getMonth() &&
                d.getFullYear() === now.getFullYear()) {
                if (diffMins < 1) return 'just now';
                if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
                return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            }

            // Yesterday
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            if (d.getDate() === yesterday.getDate() &&
                d.getMonth() === yesterday.getMonth() &&
                d.getFullYear() === yesterday.getFullYear()) {
                return 'Yesterday';
            }

            // 2-6 days ago
            if (diffDays <= 6) {
                return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
            }

            // More than 6 days: show short date and time
            const dateStr = d.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
            const timeStr = d.toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit'
            });
            return `${dateStr}, ${timeStr}`;
        }

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        generateCsrfToken() {
            // Generate a cryptographically random token for CSRF protection
            const array = new Uint8Array(32);
            crypto.getRandomValues(array);
            return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        }
    }

    // Auto-initialize
    function autoInit() {
        if (!currentScript) return;

        const containerId = currentScript.getAttribute('data-container') || '#commentkit';
        const pageId = currentScript.getAttribute('data-page-id');
        const theme = currentScript.getAttribute('data-theme');

        let configOptions = {};
        if (typeof window.commentkit_config === 'function') {
            const config = { page: { identifier: null, title: null, url: null } };
            window.commentkit_config.call(config);
            configOptions = {
                pageId: config.page.identifier,
                pageTitle: config.page.title,
                pageUrl: config.page.url,
            };
        }

        if (pageId) configOptions.pageId = pageId;
        if (theme) configOptions.theme = theme;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                CommentKit.init({ container: containerId, ...configOptions });
            });
        } else {
            CommentKit.init({ container: containerId, ...configOptions });
        }
    }

    window.CommentKit = CommentKit;
    autoInit();
})();
