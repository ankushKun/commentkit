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

    // Check if script is served from localhost (development mode)
    const isLocalDev = scriptOrigin.includes('localhost') || scriptOrigin.includes('127.0.0.1');

    const CONFIG = {
        // Where the widget iframe is served from (frontend)
        baseUrl: scriptOrigin || window.COMMENTKIT_BASE_URL || '',
        // Where API calls go (backend) - defaults to production unless in local dev
        apiUrl: currentScript?.getAttribute('data-api-url')
            || window.COMMENTKIT_API_URL
            || (isLocalDev ? 'http://localhost:8787' : 'https://commentkit.ankushkun.workers.dev'),
    };

    // Check if current page is localhost/development
    function isLocalhost() {
        const hostname = window.location.hostname;
        return hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '0.0.0.0' ||
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.endsWith('.local');
    }

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
                isLocalhost: isLocalhost(),   // Whether we're on localhost
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
            this.csrfToken = null;  // Will be set by server in init()
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
                expandedReplies: new Set(),  // Track which comments have expanded replies
                guestCommentSent: false, // Guest comment awaiting moderation
            };
            this.commentMap = new Map();  // Store comment data by ID for quick access
            this.scrollAnchor = null;  // Element to anchor scroll position to
            this.isRefreshing = false;  // Track if we're refreshing vs initial load
            this.originToken = null;    // Signed token proving page origin

            this.init();
        }

        async init() {
            this.injectStyles();

            // Call /widget/init to get a signed origin token
            // This request's Origin header is set by the browser and cannot be spoofed
            // The server verifies the domain and returns a cryptographically signed token
            try {
                const initResponse = await fetch(`${this.config.apiBase}/api/v1/widget/init`, {
                    method: 'GET',
                    credentials: 'include'
                });
                const initData = await initResponse.json();

                if (!initResponse.ok || !initData.token) {
                    const rawError = initData.error;
                    if (rawError && rawError.includes('not registered')) {
                        this.state.error = 'Comments are not enabled for this domain yet.';
                        this.state.errorDetail = 'If you are the site owner, please add this domain in your CommentKit dashboard.';
                        this.state.errorType = 'warning';
                    } else if (rawError && rawError.includes('not verified')) {
                        this.state.error = 'This site is not verified with CommentKit.';
                        this.state.errorDetail = 'Site owners must verify domain ownership to enable comments.';
                        this.state.errorType = 'error';
                    } else {
                        this.state.error = rawError || 'Failed to initialize CommentKit.';
                        this.state.errorType = 'error';
                    }
                    this.state.loading = false;
                    this.render();
                    return;
                }

                // Store the signed origin token - will be passed to iframe and used in API calls
                this.originToken = initData.token;

                // Store the CSRF token from server (cryptographically signed, origin-specific)
                this.csrfToken = initData.csrfToken || this.generateCsrfToken(); // Fallback for older servers

            } catch (e) {
                console.error('[CommentKit] Failed to initialize:', e);
                this.state.error = 'Failed to connect to CommentKit. Please try again later.';
                this.state.loading = false;
                this.render();
                return;
            }

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

                .ck-like-btn.liked {
                    border-color: #fecaca;
                    background: #fef2f2;
                    color: var(--ck-danger);
                }

                .ck-like-btn.liked svg {
                    fill: currentColor;
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

                .ck-warning {
                    background: #fffbeb;
                    color: #92400e;
                    padding: 16px;
                    border-radius: var(--ck-radius);
                    margin-bottom: 24px;
                    border: 1px solid #fcd34d;
                    font-size: 0.95rem;
                }
                
                .ck-footer {
                    margin-top: 56px;
                    padding-top: 24px;
                    border-top: 1px solid var(--ck-border);
                    text-align: center;
                    font-size: 0.8rem;
                    color: #9ca3af;
                }
                
                .ck-footer a:hover {
                    color: #9ca3af;
                }

                /* Magic link sent state */
                .ck-login-sent {
                    background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
                    border: 1px solid #dbeafe;
                    border-radius: var(--ck-radius);
                    padding: 24px;
                    text-align: center;
                }

                .ck-login-sent .ck-email-icon {
                    width: 48px;
                    height: 48px;
                    background: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 16px;
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
                }

                .ck-login-sent .ck-email-icon svg {
                    color: var(--ck-primary);
                }

                .ck-login-sent p {
                    margin: 0 0 8px 0;
                    color: var(--ck-text);
                    font-size: 0.95rem;
                    line-height: 1.5;
                }

                .ck-login-sent p:last-of-type {
                    margin-bottom: 0;
                    color: var(--ck-text-muted);
                    font-size: 0.875rem;
                }

                .ck-login-sent .ck-email-address {
                    font-weight: 600;
                    color: var(--ck-primary);
                }

                .ck-link-btn {
                    background: transparent;
                    border: none;
                    color: var(--ck-text-muted);
                    font-size: 0.85rem;
                    cursor: pointer;
                    padding: 8px 16px;
                    margin-top: 16px;
                    border-radius: var(--ck-radius);
                    transition: all 0.2s;
                    font-family: inherit;
                    font-weight: 500;
                }

                .ck-link-btn:hover {
                    background: rgba(0, 0, 0, 0.05);
                    color: var(--ck-text);
                }

                /* Simple Flat Threading */
                .ck-comment {
                    position: relative;
                    margin-bottom: 24px;
                    animation: ck-fade-in 0.3s ease-out;
                }

                /* Disable animation during refresh to prevent all comments from re-animating */
                .ck-refreshing .ck-comment {
                    animation: none;
                }

                .ck-replies {
                    margin-top: 16px;
                    margin-left: 56px; /* Align with parent comment content */
                }

                /* Reply count indicator */
                .ck-reply-count {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    margin-top: 12px;
                    padding: 6px 12px;
                    background: var(--ck-bg-muted);
                    border: 1px solid var(--ck-border);
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--ck-text);
                    transition: all 0.2s;
                }

                .ck-reply-count:hover {
                    background: #e5e7eb;
                }

                .ck-reply-count .ck-reply-avatar {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: #eff6ff;
                    color: var(--ck-primary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 0.7rem;
                    border: 1px solid #dbeafe;
                }

                /* Inline reply form */
                .ck-inline-reply-form {
                    animation: ck-fade-in 0.3s ease-out;
                }

                .ck-inline-reply-form .ck-form {
                    padding: 16px;
                    background: var(--ck-bg-muted);
                    border-radius: var(--ck-radius);
                    border: 1px solid var(--ck-border);
                }

                .ck-inline-reply-form .ck-user-info {
                    margin-bottom: 12px;
                }

                .ck-inline-reply-form .ck-form-group {
                    margin-bottom: 12px;
                }

                .ck-inline-reply-form textarea {
                    min-height: 80px;
                }

                /* Toast notification */
                @keyframes ck-toast-in {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(100px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }

                @keyframes ck-toast-out {
                    from {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0) scale(1);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(-50%) translateY(20px) scale(0.95);
                    }
                }

                .ck-toast {
                    position: fixed;
                    bottom: 24px;
                    left: 50%;
                    transform: translateX(-50%) translateY(100px);
                    background: #1f2937;
                    color: white;
                    padding: 12px 20px;
                    border-radius: var(--ck-radius);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    font-size: 0.9rem;
                    font-weight: 500;
                    z-index: 10000;
                    opacity: 0;
                    pointer-events: none;
                    max-width: 90%;
                    text-align: center;
                }

                .ck-toast.show {
                    animation: ck-toast-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    pointer-events: auto;
                }

                .ck-toast.hide {
                    animation: ck-toast-out 0.25s cubic-bezier(0.4, 0, 1, 1) forwards;
                    pointer-events: none;
                }

                .ck-toast a {
                    color: #93c5fd;
                    text-decoration: none;
                    margin-left: 8px;
                    font-weight: 600;
                }

                .ck-toast a:hover {
                    color: #bfdbfe;
                    text-decoration: underline;
                }

                @media (max-width: 640px) {
                    @keyframes ck-toast-in {
                        from {
                            opacity: 0;
                            transform: translateY(100px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }

                    @keyframes ck-toast-out {
                        from {
                            opacity: 1;
                            transform: translateY(0) scale(1);
                        }
                        to {
                            opacity: 0;
                            transform: translateY(20px) scale(0.95);
                        }
                    }

                    .ck-toast {
                        bottom: 16px;
                        left: 16px;
                        right: 16px;
                        transform: translateY(100px);
                        max-width: none;
                    }
                }

                /* Login Modal */
                @keyframes ck-modal-overlay-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes ck-modal-overlay-out {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }

                @keyframes ck-modal-content-in {
                    from {
                        opacity: 0;
                        transform: translate(-50%, -48%) scale(0.96);
                    }
                    to {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1);
                    }
                }

                @keyframes ck-modal-content-out {
                    from {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1);
                    }
                    to {
                        opacity: 0;
                        transform: translate(-50%, -48%) scale(0.96);
                    }
                }

                .ck-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    z-index: 10001;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                }

                .ck-modal-overlay.show {
                    animation: ck-modal-overlay-in 0.2s ease-out forwards;
                }

                .ck-modal-overlay.hide {
                    animation: ck-modal-overlay-out 0.2s ease-out forwards;
                }

                .ck-modal-content {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.02);
                    max-width: 440px;
                    width: calc(100% - 32px);
                    max-height: calc(100vh - 64px);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    opacity: 0;
                }

                .ck-modal-overlay.show .ck-modal-content {
                    animation: ck-modal-content-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }

                .ck-modal-overlay.hide .ck-modal-content {
                    animation: ck-modal-content-out 0.2s ease-out forwards;
                }

                .ck-modal-header {
                    padding: 32px 32px 24px;
                    border-bottom: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    background: linear-gradient(to bottom, #ffffff 0%, #fafafa 100%);
                    flex-shrink: 0;
                }

                .ck-modal-title {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #111827;
                    margin: 0;
                    line-height: 1.3;
                    letter-spacing: -0.025em;
                }

                .ck-modal-close {
                    background: transparent;
                    border: none;
                    color: #9ca3af;
                    cursor: pointer;
                    padding: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 6px;
                    transition: all 0.15s ease;
                    margin-top: -2px;
                }

                .ck-modal-close:hover {
                    background: #f3f4f6;
                    color: #4b5563;
                    transform: scale(1.05);
                }

                .ck-modal-close:active {
                    transform: scale(0.95);
                }

                .ck-modal-body {
                    padding: 32px;
                    overflow-y: auto;
                    flex: 1 1 auto;
                    min-height: 0;
                }

                .ck-modal-body .ck-form-group {
                    margin-bottom: 24px;
                }

                .ck-modal-body .ck-form-group label {
                    display: block;
                    font-size: 0.875rem;
                    font-weight: 600;
                    margin-bottom: 10px;
                    color: #374151;
                }

                .ck-modal-body .ck-form-group input {
                    width: 100%;
                    padding: 12px 14px;
                    border: 1.5px solid #e5e7eb;
                    border-radius: 8px;
                    font-size: 1rem;
                    font-family: inherit;
                    color: var(--ck-text);
                    background: white;
                    transition: all 0.2s;
                    box-sizing: border-box;
                }

                .ck-modal-body .ck-form-group input:focus {
                    outline: none;
                    border-color: var(--ck-primary);
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }

                .ck-modal-body button.ck-btn,
                .ck-modal-body .ck-btn {
                    width: 100%;
                    padding: 12px 24px;
                    font-size: 1rem;
                    font-weight: 600;
                    box-sizing: border-box;
                    display: inline-flex;
                    justify-content: center;
                    align-items: center;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .ck-modal-body button.ck-btn-primary,
                .ck-modal-body button.ck-btn.ck-btn-primary,
                .ck-modal-body .ck-btn.ck-btn-primary {
                    background-color: #3b82f6 !important;
                    color: #ffffff !important;
                    border: 1px solid transparent !important;
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important;
                }

                .ck-modal-body button.ck-btn-primary:hover:not(:disabled),
                .ck-modal-body button.ck-btn.ck-btn-primary:hover:not(:disabled),
                .ck-modal-body .ck-btn.ck-btn-primary:hover:not(:disabled) {
                    background-color: #2563eb !important;
                    transform: translateY(-1px);
                }

                .ck-modal-body button.ck-btn-primary:active,
                .ck-modal-body button.ck-btn.ck-btn-primary:active,
                .ck-modal-body .ck-btn.ck-btn-primary:active {
                    transform: translateY(0);
                }

                .ck-modal-body button.ck-btn-primary:disabled,
                .ck-modal-body button.ck-btn.ck-btn-primary:disabled,
                .ck-modal-body .ck-btn.ck-btn-primary:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                    transform: none;
                }

                .ck-modal-body p {
                    line-height: 1.6;
                }

                /* Modal-specific login sent styling */
                .ck-modal-body .ck-login-sent {
                    background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
                    border: 1px solid #dbeafe;
                    border-radius: 12px;
                    padding: 32px 24px;
                    text-align: center;
                }

                .ck-modal-body .ck-login-sent .ck-email-icon {
                    width: 56px;
                    height: 56px;
                    background: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 20px;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
                }

                .ck-modal-body .ck-login-sent .ck-email-icon svg {
                    color: var(--ck-primary);
                }

                .ck-modal-body .ck-login-sent p {
                    margin: 0 0 12px 0;
                    color: #1f2937;
                    font-size: 0.95rem;
                    line-height: 1.6;
                }

                .ck-modal-body .ck-login-sent p strong {
                    font-size: 1.125rem;
                    font-weight: 700;
                    color: #111827;
                }

                .ck-modal-body .ck-login-sent p:last-of-type {
                    margin-bottom: 0;
                    color: #6b7280;
                    font-size: 0.875rem;
                }

                .ck-modal-body .ck-login-sent .ck-email-address {
                    font-weight: 600;
                    color: var(--ck-primary);
                }

                .ck-modal-body .ck-link-btn {
                    margin-top: 20px;
                    font-weight: 500;
                }

                /* Mobile responsive modal */
                @media (max-width: 640px) {
                    .ck-modal-content {
                        max-width: 100%;
                        width: calc(100% - 32px);
                        max-height: calc(100vh - 32px);
                        border-radius: 12px;
                    }

                    .ck-modal-header {
                        padding: 24px 24px 20px;
                    }

                    .ck-modal-title {
                        font-size: 1.375rem;
                        line-height: 1.4;
                    }

                    .ck-modal-close {
                        padding: 4px;
                        margin-top: 0;
                    }

                    .ck-modal-close svg {
                        width: 18px;
                        height: 18px;
                    }

                    .ck-modal-body {
                        padding: 24px;
                    }

                    .ck-modal-body .ck-form-group {
                        margin-bottom: 20px;
                    }

                    .ck-modal-body .ck-form-group label {
                        font-size: 0.8125rem;
                        margin-bottom: 8px;
                    }

                    .ck-modal-body .ck-form-group input {
                        padding: 11px 12px;
                        font-size: 16px;
                    }

                    .ck-modal-body button.ck-btn,
                    .ck-modal-body .ck-btn {
                        padding: 11px 20px;
                        font-size: 0.9375rem;
                    }

                    .ck-modal-body p {
                        font-size: 0.8125rem;
                        margin: 0 0 24px 0 !important;
                    }

                    .ck-modal-body .ck-login-sent {
                        padding: 24px 16px;
                    }

                    .ck-modal-body .ck-login-sent .ck-email-icon {
                        width: 48px;
                        height: 48px;
                        margin-bottom: 16px;
                    }

                    .ck-modal-body .ck-login-sent .ck-email-icon svg {
                        width: 20px;
                        height: 20px;
                    }

                    .ck-modal-body .ck-login-sent p strong {
                        font-size: 1rem;
                    }
                }

                @media (max-width: 380px) {
                    .ck-modal-content {
                        width: calc(100% - 24px);
                        margin: 0 12px;
                    }

                    .ck-modal-header {
                        padding: 20px 20px 16px;
                    }

                    .ck-modal-title {
                        font-size: 1.25rem;
                    }

                    .ck-modal-body {
                        padding: 20px;
                    }
                }

                /* Landscape mobile optimization */
                @media (max-height: 600px) and (orientation: landscape) {
                    .ck-modal-content {
                        max-height: calc(100vh - 16px);
                        margin: 8px auto;
                    }

                    .ck-modal-header {
                        padding: 20px 24px 16px;
                    }

                    .ck-modal-title {
                        font-size: 1.25rem;
                    }

                    .ck-modal-body {
                        padding: 20px 24px;
                    }

                    .ck-modal-body .ck-form-group {
                        margin-bottom: 16px;
                    }

                    .ck-modal-body p {
                        margin: 0 0 20px 0 !important;
                    }
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
                parentOrigin: window.location.origin,  // Required for postMessage validation
                apiBase: this.config.apiBase,          // Where API calls should go
                csrfToken: this.csrfToken,             // CSRF token for mutation requests
                originToken: this.originToken || '',   // Signed token proving page origin (anti-spoofing)
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
                        // Show confirmation for guest comments
                        if (!this.state.user) {
                            this.state.guestCommentSent = true;
                        }
                        this.refreshComments();
                        break;
                    case 'authStateChanged':
                        this.state.user = event.data.user || null;
                        this.state.authLoading = false;
                        this.state.loginSent = false;
                        this.state.guestCommentSent = false;
                        this.state.authMode = 'guest';
                        this.hideLoginModal(); // Close modal on successful auth
                        this.render();
                        break;
                    case 'loginEmailSent':
                        this.state.loginSent = true;
                        this.state.loginEmail = event.data.email;
                        this.state.authLoading = false;
                        this.updateModalBody(); // Update modal to show email sent message
                        this.render();
                        break;
                    case 'error':
                        let message = event.data.message;
                        let type = 'error';
                        let detail = null;

                        if (message && message.includes('Site not found')) {
                            message = 'Comments are not enabled for this domain yet.';
                            detail = 'If you are the site owner, please add this domain in your CommentKit dashboard.';
                            type = 'warning';
                        }

                        this.state.error = message;
                        this.state.errorDetail = detail;
                        this.state.errorType = type;

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

        refreshComments() {
            // Refresh comments without showing loading state
            this.isRefreshing = true;
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

        togglePageLike(pageId, shouldLike) {
            return new Promise((resolve, reject) => {
                const messageId = Date.now() + Math.random();
                const handler = (event) => {
                    if (event.data.type === 'commentkit' && event.data.messageId === messageId) {
                        window.removeEventListener('message', handler);
                        if (event.data.error) {
                            reject(new Error(event.data.error));
                        } else {
                            resolve(event.data.data);
                        }
                    }
                };
                window.addEventListener('message', handler);

                this.sendToIframe({
                    action: 'togglePageLike',
                    messageId,
                    pageId,
                    shouldLike,
                });

                // Timeout after 5 seconds
                setTimeout(() => {
                    window.removeEventListener('message', handler);
                    reject(new Error('Timeout'));
                }, 5000);
            });
        }

        toggleCommentLike(commentId, shouldLike) {
            return new Promise((resolve, reject) => {
                const messageId = Date.now() + Math.random();
                const handler = (event) => {
                    if (event.data.type === 'commentkit' && event.data.messageId === messageId) {
                        window.removeEventListener('message', handler);
                        if (event.data.error) {
                            reject(new Error(event.data.error));
                        } else {
                            resolve(event.data.data);
                        }
                    }
                };
                window.addEventListener('message', handler);

                this.sendToIframe({
                    action: 'toggleCommentLike',
                    messageId,
                    commentId,
                    shouldLike,
                });

                // Timeout after 5 seconds
                setTimeout(() => {
                    window.removeEventListener('message', handler);
                    reject(new Error('Timeout'));
                }, 5000);
            });
        }


        // Generate Gravatar avatar HTML with fallback to initials
        renderAvatar(emailHash, name, cssClass = 'ck-avatar') {
            const displayName = name || 'Anonymous';
            const initials = displayName.charAt(0).toUpperCase();

            if (emailHash) {
                // Try Gravatar, fallback to initials on error
                const gravatarUrl = `https://www.gravatar.com/avatar/${emailHash}?d=404&s=64`;
                return `
                    <div class="${cssClass}" style="position: relative;">
                        <img src="${gravatarUrl}" 
                             alt="${this.escapeHtml(displayName)}" 
                             style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"
                        />
                        <div style="display: none; width: 100%; height: 100%; position: absolute; top: 0; left: 0; align-items: center; justify-content: center; background: #eff6ff; color: var(--ck-primary); font-weight: 700; border-radius: 50%;">
                            ${initials}
                        </div>
                    </div>
                `;
            }

            // No email hash, just show initials
            return `<div class="${cssClass}">${initials}</div>`;
        }

        render() {
            // Save scroll anchor if needed (element-based scroll preservation)
            let scrollAnchorData = null;
            if (this.scrollAnchor) {
                // Find the anchor element before re-render
                const anchorElement = this.container.querySelector(`.ck-comment[data-id="${this.scrollAnchor}"]`);
                if (anchorElement) {
                    const rect = anchorElement.getBoundingClientRect();
                    scrollAnchorData = {
                        commentId: this.scrollAnchor,
                        offsetFromTop: rect.top + window.pageYOffset
                    };
                }
            }

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
                const isWarning = this.state.errorType === 'warning';

                this.container.innerHTML = `
                    <div class="ck-widget">
                        <div class="${isWarning ? 'ck-warning' : 'ck-error'}">
                            ${this.escapeHtml(this.state.error)}
                            ${this.state.errorDetail ? `<div style="margin-top: 8px; font-size: 0.9em; opacity: 0.9;">${this.escapeHtml(this.state.errorDetail)}</div>` : ''}
                        </div>
                    </div>
                `;
                return;
            }

            const pageData = this.state.pageData || { comment_count: 0, likes: 0, comments: [] };
            const commentTree = this.buildTree(this.state.comments);

            this.container.innerHTML = `
                <div class="ck-widget${this.isRefreshing ? ' ck-refreshing' : ''}">
                    <div class="ck-header">
                        <div class="ck-title">
                            Discussion
                            ${pageData.comment_count > 0 ? `<span class="ck-count">${pageData.comment_count}</span>` : ''}
                        </div>
                        <button class="ck-like-btn ${pageData.user_liked ? 'liked' : ''}">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                            <span>${pageData.likes > 0 ? pageData.likes : 'Like Page'}</span>
                        </button>
                    </div>

                    ${this.renderForm()}
                    ${this.renderComments(commentTree)}

                    <div class="ck-footer">
                        Powered by <a href="https://commentkit.ankush.one" target="_blank">CommentKit</a>
                    </div>
                </div>
            `;

            this.attachEventListeners();

            // Restore scroll position relative to anchor element
            if (scrollAnchorData) {
                requestAnimationFrame(() => {
                    const anchorElement = this.container.querySelector(`.ck-comment[data-id="${scrollAnchorData.commentId}"]`);
                    if (anchorElement) {
                        const rect = anchorElement.getBoundingClientRect();
                        const newOffsetFromTop = rect.top + window.pageYOffset;
                        const currentScroll = window.pageYOffset;
                        const scrollDelta = newOffsetFromTop - scrollAnchorData.offsetFromTop;
                        window.scrollTo(0, currentScroll + scrollDelta);
                    }
                    this.scrollAnchor = null;
                });
            }

            // Reset refreshing flag after render
            this.isRefreshing = false;
        }

        renderForm() {
            const { user, authMode, loginSent, loginEmail, guestCommentSent } = this.state;

            // If guest comment was sent, show confirmation
            if (guestCommentSent && !user) {
                return `
                    <div class="ck-form">
                        <div class="ck-login-sent">
                            <div class="ck-email-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                </svg>
                            </div>
                            <p><strong>Comment submitted!</strong></p>
                            <p>Your comment has been received and is awaiting approval.</p>
                            <p>Site owners will review it before it appears publicly.</p>
                            <button type="button" class="ck-link-btn" id="ck-dismiss-guest-message">Post another comment</button>
                        </div>
                    </div>
                `;
            }

            // If user is authenticated, show simplified form
            if (user) {
                const displayName = user.display_name || user.email.split('@')[0];
                return `
                    <div class="ck-form">
                        <h3>Leave a Comment</h3>
                        <div class="ck-user-info">
                            ${this.renderAvatar(user.email_hash, displayName)}
                            <div class="ck-user-details">
                                <div class="ck-user-name">${this.escapeHtml(displayName)}</div>
                                <div class="ck-user-email">${this.escapeHtml(user.email)}</div>
                            </div>
                            <button type="button" class="ck-logout-btn" id="ck-logout">Sign out</button>
                        </div>
                        <form id="ck-comment-form">
                            <div class="ck-form-group">
                                <textarea id="ck-content" name="content" required placeholder="Share your thoughts..."></textarea>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button type="submit" class="ck-btn ck-btn-primary">Post Comment</button>
                            </div>
                        </form>
                    </div>
                `;
            }

            // If magic link was sent, show confirmation
            if (loginSent) {
                return `
                    <div class="ck-form">
                        <div class="ck-login-sent">
                            <div class="ck-email-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                                </svg>
                            </div>
                            <p><strong>Check your email</strong></p>
                            <p>We sent a login link to <span class="ck-email-address">${this.escapeHtml(loginEmail)}</span></p>
                            <p>Click the link in the email to sign in.</p>
                            <button type="button" class="ck-link-btn" id="ck-back-to-form">Use a different email</button>
                        </div>
                    </div>
                `;
            }

            // Show auth toggle and appropriate form
            return `
                <div class="ck-form">
                    <h3>Leave a Comment</h3>
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
                            <input type="email" id="ck-email" name="email" placeholder="your@email.com" pattern="[^\\s@]+@[^\\s@]+\\.[^\\s@]+" title="Please enter a valid email address (e.g., user@example.com)">
                        </div>
                    </div>
                    <div class="ck-form-group">
                        <label for="ck-content">Comment *</label>
                        <textarea id="ck-content" name="content" required placeholder="Share your thoughts..."></textarea>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button type="submit" class="ck-btn ck-btn-primary">Post Comment</button>
                    </div>
                </form>
            `;
        }

        renderLoginForm() {
            return `
                <form id="ck-login-form">
                    <div class="ck-form-group">
                        <label for="ck-login-email">Email address</label>
                        <input type="email" id="ck-login-email" name="email" required placeholder="your@email.com" pattern="[^\\s@]+@[^\\s@]+\\.[^\\s@]+" title="Please enter a valid email address (e.g., user@example.com)">
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
            const timeAgo = this.formatTimeAgo(comment.created_at);
            const isLiked = comment.user_liked || false;
            const hasReplies = comment.replies && comment.replies.length > 0;
            const replyCount = hasReplies ? comment.replies.length : 0;
            const isExpanded = this.state.expandedReplies.has(comment.id);

            return `
                <div class="ck-comment" data-id="${comment.id}">
                    <div class="ck-comment-inner">
                        ${this.renderAvatar(comment.author_email_hash, comment.author_name)}
                        <div class="ck-comment-content">
                            <div class="ck-comment-header">
                                <span class="ck-comment-author">${this.escapeHtml(comment.author_name)}</span>
                                <span class="ck-comment-date">${timeAgo}</span>
                            </div>
                            <div class="ck-comment-body">${this.escapeHtml(comment.content)}</div>
                            <div class="ck-comment-actions">
                                <button class="ck-comment-action ${isLiked ? 'liked' : ''}" data-id="${comment.id}">
                                    ${comment.likes > 0 ? `<span>${comment.likes}</span>` : ''}
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                    </svg>
                                </button>
                                <button class="ck-comment-action ck-reply-btn" data-id="${comment.id}">
                                    Reply
                                </button>
                            </div>
                            ${hasReplies && !isExpanded ? `
                                <button class="ck-reply-count" data-id="${comment.id}" aria-label="Toggle replies">
                                    ${this.renderAvatar(comment.replies[0].author_email_hash, comment.replies[0].author_name, 'ck-reply-avatar')}
                                    <span>${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}</span>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    ${hasReplies && isExpanded ? `
                        <div class="ck-replies">
                            ${comment.replies.map(r => this.renderComment(r, depth + 1)).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }

        renderInlineReplyForm(parentId) {
            const { user } = this.state;

            if (user) {
                const displayName = user.display_name || user.email.split('@')[0];
                return `
                    <div class="ck-inline-reply-form" style="margin-left: 56px; margin-top: 16px; margin-bottom: 16px;">
                        <div class="ck-form">
                            <div class="ck-user-info">
                                ${this.renderAvatar(user.email_hash, displayName)}
                                <div class="ck-user-details">
                                    <div class="ck-user-name">${this.escapeHtml(displayName)}</div>
                                </div>
                            </div>
                            <form class="ck-reply-form" data-parent-id="${parentId}">
                                <div class="ck-form-group">
                                    <textarea class="ck-reply-textarea" name="content" required placeholder="Write a reply..."></textarea>
                                </div>
                                <div style="display: flex; gap: 8px;">
                                    <button type="submit" class="ck-btn ck-btn-primary">Post Reply</button>
                                    <button type="button" class="ck-cancel-inline-reply ck-btn ck-btn-secondary">Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="ck-inline-reply-form" style="margin-left: 56px; margin-top: 16px; margin-bottom: 16px;">
                    <div class="ck-form">
                        <form class="ck-reply-form" data-parent-id="${parentId}">
                            <div class="ck-form-row">
                                <div class="ck-form-group">
                                    <label>Name *</label>
                                    <input type="text" name="name" required placeholder="Your name">
                                </div>
                                <div class="ck-form-group">
                                    <label>Email (optional)</label>
                                    <input type="email" name="email" placeholder="your@email.com" pattern="[^\\s@]+@[^\\s@]+\\.[^\\s@]+" title="Please enter a valid email address (e.g., user@example.com)">
                                </div>
                            </div>
                            <div class="ck-form-group">
                                <label>Reply *</label>
                                <textarea class="ck-reply-textarea" name="content" required placeholder="Write a reply..."></textarea>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button type="submit" class="ck-btn ck-btn-primary">Post Reply</button>
                                <button type="button" class="ck-cancel-inline-reply ck-btn ck-btn-secondary">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
        }

        attachEventListeners() {
            // Top-level comment form submission
            const form = this.container.querySelector('#ck-comment-form');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();

                    // Use native HTML5 form validation
                    if (!form.checkValidity()) {
                        form.reportValidity();
                        return;
                    }

                    const formData = new FormData(form);
                    const email = formData.get('email');

                    const commentData = {
                        content: formData.get('content'),
                        parent_id: null, // Top-level comments have no parent
                    };
                    // Include guest fields only if not authenticated
                    if (!this.state.user) {
                        commentData.author_name = formData.get('name');
                        commentData.author_email = email || undefined;
                    }
                    // Set scroll anchor to first visible comment
                    this.scrollAnchor = this.findFirstVisibleComment();
                    this.postComment(commentData);
                    form.reset();
                });
            }

            // Reply buttons
            this.container.querySelectorAll('.ck-reply-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const commentId = parseInt(btn.dataset.id);

                    // Remove any existing reply forms
                    const existingForms = this.container.querySelectorAll('.ck-inline-reply-form');
                    existingForms.forEach(f => f.remove());

                    this.state.replyTo = commentId;

                    // Find the comment element and insert reply form after the comment-inner
                    const commentDiv = this.container.querySelector(`.ck-comment[data-id="${commentId}"]`);
                    if (commentDiv) {
                        const commentInner = commentDiv.querySelector('.ck-comment-inner');
                        const replyFormHTML = this.renderInlineReplyForm(commentId);

                        // Create a temporary container to parse HTML
                        const temp = document.createElement('div');
                        temp.innerHTML = replyFormHTML;
                        const replyFormElement = temp.firstElementChild;

                        // Insert after comment-inner
                        commentInner.insertAdjacentElement('afterend', replyFormElement);

                        // Attach event listeners to the new form
                        this.attachInlineReplyFormListeners(replyFormElement, commentId);

                        // Focus textarea
                        setTimeout(() => {
                            replyFormElement.querySelector('.ck-reply-textarea')?.focus();
                        }, 0);
                    }
                });
            });

            // Reply count toggle
            this.container.querySelectorAll('.ck-reply-count').forEach(btn => {
                btn.addEventListener('click', () => {
                    const commentId = parseInt(btn.dataset.id);
                    const commentDiv = this.container.querySelector(`.ck-comment[data-id="${commentId}"]`);

                    if (this.state.expandedReplies.has(commentId)) {
                        // Collapse
                        this.state.expandedReplies.delete(commentId);
                        const repliesDiv = commentDiv.querySelector('.ck-replies');
                        if (repliesDiv) repliesDiv.remove();
                        btn.style.display = 'inline-flex';
                    } else {
                        // Expand
                        this.state.expandedReplies.add(commentId);
                        const comment = this.commentMap.get(commentId);
                        if (comment && comment.replies && comment.replies.length > 0) {
                            const repliesHTML = `
                                <div class="ck-replies">
                                    ${comment.replies.map(r => this.renderComment(r, 1)).join('')}
                                </div>
                            `;
                            const temp = document.createElement('div');
                            temp.innerHTML = repliesHTML;
                            const repliesElement = temp.firstElementChild;

                            // Insert before the closing of comment div
                            commentDiv.appendChild(repliesElement);

                            // Attach event listeners to nested comments
                            this.attachEventListeners();

                            // Hide the reply count button
                            btn.style.display = 'none';
                        }
                    }
                });
            });

            // Auth mode toggle
            const guestModeBtn = this.container.querySelector('#ck-mode-guest');
            if (guestModeBtn) {
                guestModeBtn.addEventListener('click', () => {
                    this.state.authMode = 'guest';
                    this.state.guestCommentSent = false;
                    this.render();
                });
            }

            const loginModeBtn = this.container.querySelector('#ck-mode-login');
            if (loginModeBtn) {
                loginModeBtn.addEventListener('click', () => {
                    this.state.authMode = 'login';
                    this.state.guestCommentSent = false;
                    this.render();
                });
            }

            // Login form submission
            const loginForm = this.container.querySelector('#ck-login-form');
            if (loginForm) {
                loginForm.addEventListener('submit', (e) => {
                    e.preventDefault();

                    // Use native HTML5 form validation
                    if (!loginForm.checkValidity()) {
                        loginForm.reportValidity();
                        return;
                    }

                    const formData = new FormData(loginForm);
                    const email = formData.get('email');

                    this.state.authLoading = true;
                    this.render();
                    this.sendToIframe({
                        action: 'login',
                        email: email,
                        redirectUrl: window.location.href,  // Redirect back to this page after auth
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

            // Dismiss guest comment confirmation
            const dismissGuestBtn = this.container.querySelector('#ck-dismiss-guest-message');
            if (dismissGuestBtn) {
                dismissGuestBtn.addEventListener('click', () => {
                    this.state.guestCommentSent = false;
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

            // Page like button
            const pageLikeBtn = this.container.querySelector('.ck-like-btn');
            if (pageLikeBtn) {
                pageLikeBtn.addEventListener('click', async () => {
                    if (!this.state.user) {
                        // Show toast and open login modal
                        this.showToast('Sign in to like this page', {
                            text: 'Sign in',
                            callback: () => {
                                this.showLoginModal();
                            }
                        });
                        return;
                    }

                    const pageData = this.state.pageData;
                    if (!pageData) return;

                    // Optimistic UI update
                    const isCurrentlyLiked = pageData.user_liked;
                    pageData.user_liked = !isCurrentlyLiked;
                    pageData.likes += isCurrentlyLiked ? -1 : 1;

                    // Update button immediately
                    pageLikeBtn.classList.toggle('liked', pageData.user_liked);
                    const likesSpan = pageLikeBtn.querySelector('span');
                    if (likesSpan) {
                        likesSpan.textContent = pageData.likes > 0 ? pageData.likes : 'Like Page';
                    }

                    // Make API call
                    try {
                        const response = await this.togglePageLike(pageData.page_id, !isCurrentlyLiked);
                        if (response && response.total_likes !== undefined) {
                            // Update with server response
                            pageData.likes = response.total_likes;
                            pageData.user_liked = response.user_liked;
                            pageLikeBtn.classList.toggle('liked', pageData.user_liked);
                            if (likesSpan) {
                                likesSpan.textContent = pageData.likes > 0 ? pageData.likes : 'Like Page';
                            }
                        }
                    } catch (error) {
                        // Revert on error
                        pageData.user_liked = isCurrentlyLiked;
                        pageData.likes += isCurrentlyLiked ? 1 : -1;
                        pageLikeBtn.classList.toggle('liked', pageData.user_liked);
                        if (likesSpan) {
                            likesSpan.textContent = pageData.likes > 0 ? pageData.likes : 'Like Page';
                        }
                    }
                });
            }

            // Comment like buttons
            this.container.querySelectorAll('.ck-comment-action').forEach(btn => {
                // Skip if it's a reply button (which also has ck-comment-action class)
                if (btn.classList.contains('ck-reply-btn')) return;

                btn.addEventListener('click', async () => {
                    if (!this.state.user) {
                        // Show toast and open login modal
                        this.showToast('Sign in to like comments', {
                            text: 'Sign in',
                            callback: () => {
                                this.showLoginModal();
                            }
                        });
                        return;
                    }

                    const commentId = parseInt(btn.dataset.id);
                    const comment = this.commentMap.get(commentId);
                    if (!comment) return;

                    // Optimistic UI update
                    const isCurrentlyLiked = comment.user_liked;
                    comment.user_liked = !isCurrentlyLiked;
                    comment.likes += isCurrentlyLiked ? -1 : 1;

                    // Update button immediately
                    btn.classList.toggle('liked', comment.user_liked);
                    const svgHtml = `<svg width="16" height="16" viewBox="0 0 24 24" fill="${comment.user_liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;

                    if (comment.likes > 0) {
                        btn.innerHTML = `<span>${comment.likes}</span> ${svgHtml}`;
                    } else {
                        btn.innerHTML = svgHtml;
                    }

                    // Make API call
                    try {
                        const response = await this.toggleCommentLike(commentId, !isCurrentlyLiked);
                        if (response && response.total_likes !== undefined) {
                            // Update with server response
                            comment.likes = response.total_likes;
                            comment.user_liked = response.user_liked;
                            btn.classList.toggle('liked', comment.user_liked);
                            const newSvgHtml = `<svg width="16" height="16" viewBox="0 0 24 24" fill="${comment.user_liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
                            if (comment.likes > 0) {
                                btn.innerHTML = `<span>${comment.likes}</span> ${newSvgHtml}`;
                            } else {
                                btn.innerHTML = newSvgHtml;
                            }
                        }
                    } catch (error) {
                        // Revert on error
                        comment.user_liked = isCurrentlyLiked;
                        comment.likes += isCurrentlyLiked ? 1 : -1;
                        btn.classList.toggle('liked', comment.user_liked);
                        const revertSvgHtml = `<svg width="16" height="16" viewBox="0 0 24 24" fill="${comment.user_liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
                        if (comment.likes > 0) {
                            btn.innerHTML = `<span>${comment.likes}</span> ${revertSvgHtml}`;
                        } else {
                            btn.innerHTML = revertSvgHtml;
                        }
                    }
                });
            });
        }

        attachInlineReplyFormListeners(formElement, parentId) {
            const form = formElement.querySelector('.ck-reply-form');
            const cancelBtn = formElement.querySelector('.ck-cancel-inline-reply');

            // Form submission
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();

                    // Use native HTML5 form validation
                    if (!form.checkValidity()) {
                        form.reportValidity();
                        return;
                    }

                    const formData = new FormData(form);
                    const email = formData.get('email');

                    const commentData = {
                        content: formData.get('content'),
                        parent_id: parentId,
                    };
                    // Include guest fields only if not authenticated
                    if (!this.state.user) {
                        commentData.author_name = formData.get('name');
                        commentData.author_email = email || undefined;
                    }
                    // Set scroll anchor to the parent comment being replied to
                    this.scrollAnchor = parentId;
                    this.postComment(commentData);
                    this.state.replyTo = null;
                    // Expand the parent comment to show the new reply
                    this.state.expandedReplies.add(parentId);
                    // Remove the reply form
                    formElement.remove();
                });
            }

            // Cancel button
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    this.state.replyTo = null;
                    formElement.remove();
                });
            }
        }

        findFirstVisibleComment() {
            // Find the first comment that's currently visible in the viewport
            const comments = this.container.querySelectorAll('.ck-comment[data-id]');
            const viewportTop = window.pageYOffset;
            const viewportBottom = viewportTop + window.innerHeight;

            for (const comment of comments) {
                const rect = comment.getBoundingClientRect();
                const commentTop = rect.top + window.pageYOffset;
                const commentBottom = commentTop + rect.height;

                // Check if comment is at least partially visible in viewport
                if (commentBottom > viewportTop && commentTop < viewportBottom) {
                    return parseInt(comment.dataset.id);
                }
            }

            // If no visible comment found, return null
            return null;
        }

        buildTree(comments) {
            const map = new Map();
            const roots = [];

            // Helper to parse dates securely for sorting
            const getDate = (d) => new Date(d.includes('Z') || d.includes('+') ? d : d.replace(' ', 'T') + 'Z');

            comments.forEach(c => map.set(c.id, { ...c, replies: [] }));
            comments.forEach(c => {
                const comment = map.get(c.id);
                if (c.parent_id && map.has(c.parent_id)) {
                    map.get(c.parent_id).replies.push(comment);
                } else {
                    roots.push(comment);
                }
            });

            // Sort roots: Newest first
            roots.sort((a, b) => getDate(b.created_at) - getDate(a.created_at));

            // Sort replies: Oldest first (chronological)
            map.forEach(c => {
                if (c.replies.length > 0) {
                    c.replies.sort((a, b) => getDate(a.created_at) - getDate(b.created_at));
                }
            });

            // Store in instance for quick access
            this.commentMap = map;

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

        showToast(message, action = null) {
            // Helper to dismiss a toast with animation
            const dismissToast = (toastElement) => {
                toastElement.classList.remove('show');
                toastElement.classList.add('hide');
                setTimeout(() => toastElement.remove(), 250);
            };

            // Remove any existing toast with animation
            const existingToast = document.querySelector('.ck-toast');
            if (existingToast) {
                dismissToast(existingToast);
            }

            // Create toast element
            const toast = document.createElement('div');
            toast.className = 'ck-toast';

            if (action) {
                toast.innerHTML = `${this.escapeHtml(message)} <a href="#" class="ck-toast-action">${this.escapeHtml(action.text)}</a>`;
            } else {
                toast.textContent = message;
            }

            document.body.appendChild(toast);

            // Handle action click
            if (action) {
                const actionLink = toast.querySelector('.ck-toast-action');
                if (actionLink) {
                    actionLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        dismissToast(toast);
                        setTimeout(() => action.callback(), 250);
                    });
                }
            }

            // Trigger show animation
            requestAnimationFrame(() => {
                toast.classList.add('show');
            });

            // Auto-dismiss after 4 seconds
            setTimeout(() => {
                dismissToast(toast);
            }, 4000);
        }

        showLoginModal() {
            // Remove any existing modal
            const existingModal = document.querySelector('.ck-modal-overlay');
            if (existingModal) {
                this.hideLoginModal();
            }

            // Create modal overlay
            const modal = document.createElement('div');
            modal.className = 'ck-modal-overlay';
            modal.innerHTML = `
                <div class="ck-modal-content">
                    <div class="ck-modal-header">
                        <h3 class="ck-modal-title">Sign in to CommentKit</h3>
                        <button type="button" class="ck-modal-close">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div class="ck-modal-body">
                        ${this.state.loginSent ? this.renderLoginSentMessage() : this.renderLoginModalForm()}
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Close on overlay click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideLoginModal();
                }
            });

            // Close button
            const closeBtn = modal.querySelector('.ck-modal-close');
            closeBtn.addEventListener('click', () => {
                this.hideLoginModal();
            });

            // Close on ESC key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    this.hideLoginModal();
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);

            // Attach login form handler
            const loginForm = modal.querySelector('#ck-modal-login-form');
            if (loginForm) {
                loginForm.addEventListener('submit', (e) => {
                    e.preventDefault();

                    // Use native HTML5 form validation
                    if (!loginForm.checkValidity()) {
                        loginForm.reportValidity();
                        return;
                    }

                    const formData = new FormData(loginForm);
                    const email = formData.get('email');

                    this.state.authLoading = true;
                    this.updateModalBody();
                    this.sendToIframe({
                        action: 'login',
                        email: email,
                        redirectUrl: window.location.href,
                    });
                });
            }

            // Back button (if login sent)
            const backBtn = modal.querySelector('#ck-modal-back');
            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    this.state.loginSent = false;
                    this.updateModalBody();
                });
            }

            // Trigger show animation
            requestAnimationFrame(() => {
                modal.classList.add('show');

                // Focus email input after animation starts
                setTimeout(() => {
                    const emailInput = modal.querySelector('#ck-modal-email');
                    if (emailInput) {
                        emailInput.focus();
                    }
                }, 150);
            });

            // Prevent body scroll
            document.body.style.overflow = 'hidden';
        }

        hideLoginModal() {
            const modal = document.querySelector('.ck-modal-overlay');
            if (modal) {
                modal.classList.remove('show');
                modal.classList.add('hide');
                setTimeout(() => {
                    modal.remove();
                    document.body.style.overflow = '';
                }, 200);
            }
        }

        updateModalBody() {
            const modal = document.querySelector('.ck-modal-overlay');
            if (!modal) return;

            const modalBody = modal.querySelector('.ck-modal-body');
            if (this.state.loginSent) {
                modalBody.innerHTML = this.renderLoginSentMessage();
                const backBtn = modalBody.querySelector('#ck-modal-back');
                if (backBtn) {
                    backBtn.addEventListener('click', () => {
                        this.state.loginSent = false;
                        this.updateModalBody();
                    });
                }
            } else {
                modalBody.innerHTML = this.renderLoginModalForm();
                const loginForm = modalBody.querySelector('#ck-modal-login-form');
                if (loginForm) {
                    loginForm.addEventListener('submit', (e) => {
                        e.preventDefault();

                        // Use native HTML5 form validation
                        if (!loginForm.checkValidity()) {
                            loginForm.reportValidity();
                            return;
                        }

                        const formData = new FormData(loginForm);
                        const email = formData.get('email');

                        this.state.authLoading = true;
                        this.updateModalBody();
                        this.sendToIframe({
                            action: 'login',
                            email: email,
                            redirectUrl: window.location.href,
                        });
                    });

                    // Focus email input when switching back to form
                    setTimeout(() => {
                        const emailInput = loginForm.querySelector('#ck-modal-email');
                        if (emailInput) {
                            emailInput.focus();
                        }
                    }, 0);
                }
            }
        }

        renderLoginModalForm() {
            return `
                <form id="ck-modal-login-form">
                    <div class="ck-form-group">
                        <label for="ck-modal-email">Email address</label>
                        <input type="email" id="ck-modal-email" name="email" required placeholder="your@email.com" autocomplete="email" pattern="[^\\s@]+@[^\\s@]+\\.[^\\s@]+" title="Please enter a valid email address (e.g., user@example.com)">
                    </div>
                    <p style="font-size: 0.875rem; color: #6b7280; margin: 0 0 28px 0; line-height: 1.6;">
                        We'll send you a magic link to sign in. No password needed.
                    </p>
                    <button type="submit" class="ck-btn ck-btn-primary" ${this.state.authLoading ? 'disabled' : ''}>
                        ${this.state.authLoading ? 'Sending...' : 'Send Login Link'}
                    </button>
                </form>
            `;
        }

        renderLoginSentMessage() {
            return `
                <div class="ck-login-sent">
                    <div class="ck-email-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                        </svg>
                    </div>
                    <p><strong>Check your email</strong></p>
                    <p>We sent a login link to <span class="ck-email-address">${this.escapeHtml(this.state.loginEmail)}</span></p>
                    <p>Click the link in the email to sign in.</p>
                    <button type="button" class="ck-link-btn" id="ck-modal-back">Use a different email</button>
                </div>
            `;
        }
    }

    // Auto-initialize all containers
    function autoInit() {
        // Find all elements with data-commentkit attribute
        const containers = document.querySelectorAll('[data-commentkit]');

        containers.forEach(container => {
            // Skip if already initialized
            if (container.dataset.ckInitialized) return;

            // Get configuration from data attributes
            const pageId = container.dataset.pageId || container.dataset.commentkit || window.location.href;
            const pageTitle = container.dataset.pageTitle || document.title;
            const pageUrl = container.dataset.pageUrl || window.location.href;
            const theme = container.dataset.theme || 'auto';

            // Initialize this container
            CommentKit.init({
                container: container,
                pageId: pageId,
                pageTitle: pageTitle,
                pageUrl: pageUrl,
                theme: theme,
            });

            // Mark as initialized
            container.dataset.ckInitialized = 'true';
        });
    }

    // Support dynamic initialization
    window.CommentKit = CommentKit;

    // Auto-init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }

    // Watch for dynamically added containers
    if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // Check if the added node itself has data-commentkit
                        if (node.hasAttribute && node.hasAttribute('data-commentkit')) {
                            autoInit();
                        }
                        // Check if any children have data-commentkit
                        if (node.querySelectorAll) {
                            const newContainers = node.querySelectorAll('[data-commentkit]');
                            if (newContainers.length > 0) {
                                autoInit();
                            }
                        }
                    }
                });
            });

        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
})();
