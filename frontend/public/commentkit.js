/**
 * CommentKit - Embeddable Comment System
 * Add comments to any website with a simple script tag
 * 
 * CommentKit uses an iframe-based architecture where:
 * - The iframe loads from the CommentKit domain (your worker)
 * - User authentication happens inside the iframe
 * - Sessions persist across all websites using CommentKit
 * - No need to re-authenticate on different sites
 * - Site is automatically identified by domain
 * - Page is automatically identified by URL
 *
 * BASIC USAGE (Recommended):
 *   <div id="commentkit"></div>
 *   <script src="https://your-worker.workers.dev/static/commentkit.js"></script>
 *
 * USAGE WITH CUSTOM PAGE ID:
 *   <div id="commentkit"></div>
 *   <script src="https://your-worker.workers.dev/static/commentkit.js"
 *           data-page-id="my-custom-page-id">
 *   </script>
 *
 * ADVANCED USAGE WITH CONFIGURATION:
 *   <div id="commentkit"></div>
 *   <script>
 *     var commentkit_config = function () {
 *       // Optional: Override page identifier (defaults to current URL)
 *       this.page.identifier = 'unique-page-id';
 *       
 *       // Optional: Page title (defaults to document.title)
 *       this.page.title = 'My Page Title';
 *       
 *       // Optional: Canonical URL (defaults to window.location.href)
 *       this.page.url = 'https://example.com/my-page';
 *     };
 *   </script>
 *   <script src="https://your-worker.workers.dev/static/commentkit.js"></script>
 *
 * MANUAL INITIALIZATION:
 *   CommentKit.init({
 *     container: '#commentkit',
 *     pageId: 'optional-page-id',        // Optional: custom page identifier
 *     pageTitle: 'Optional Page Title',  // Optional: defaults to document.title
 *     pageUrl: 'https://example.com/page', // Optional: defaults to current URL
 *     theme: 'auto' // 'light', 'dark', or 'auto'
 *   });
 */

(function () {
    'use strict';

    // Get the script element to read data attributes
    const currentScript = document.currentScript;

    // Configuration
    const CONFIG = {
        // Base URL - will be the worker URL
        baseUrl: currentScript ? new URL(currentScript.src).origin : window.COMMENTKIT_BASE_URL || '',
    };

    // CommentKit namespace
    const CommentKit = {
        version: '1.0.0',
        instances: [],

        /**
         * Initialize CommentKit
         * @param {Object} options - Configuration options
         * @param {string|HTMLElement} options.container - CSS selector or element for the widget
         * @param {string} [options.pageId] - Optional page identifier (defaults to current URL)
         * @param {string} [options.pageTitle] - Optional page title (defaults to document.title)
         * @param {string} [options.pageUrl] - Optional page URL (defaults to window.location.href)
         * @param {string} [options.theme] - Theme: 'light', 'dark', or 'auto'
         */
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

            // Get domain from current page
            const domain = window.location.hostname;

            // Use pageId if provided, otherwise use full URL for identification
            const pageId = options.pageId || window.location.href;
            const pageTitle = options.pageTitle || document.title;
            const pageUrl = options.pageUrl || window.location.href;
            const theme = options.theme || 'auto';

            // Create iframe
            const iframe = document.createElement('iframe');
            iframe.id = 'commentkit-frame-' + Date.now();
            iframe.className = 'commentkit-frame';

            // Build iframe URL with parameters
            const params = new URLSearchParams({
                domain: domain,
                pageId: pageId,
                pageTitle: pageTitle,
                pageUrl: pageUrl,
                theme: theme,
                origin: window.location.origin
            });

            // Widget is served from the same origin as commentkit.js
            const widgetUrl = new URL('/widget', CONFIG.baseUrl);
            iframe.src = widgetUrl.toString() + '?' + params.toString();

            // Style the iframe - starts with min height, then expands to content
            iframe.style.cssText = `
                width: 100%;
                height: 400px;
                border: none;
                background: transparent;
                display: block;
                overflow: hidden;
            `;

            // Clear container and add iframe
            container.innerHTML = '';
            container.appendChild(iframe);

            // Set up message listener for height adjustments
            const instance = {
                id: iframe.id,
                iframe: iframe,
                container: container,
                options: options
            };

            this._setupMessageListener(instance);
            this.instances.push(instance);

            return instance;
        },

        /**
         * Set up postMessage listener for iframe communication
         */
        _setupMessageListener: function (instance) {
            window.addEventListener('message', function (event) {
                // Verify origin
                if (event.origin !== CONFIG.baseUrl) {
                    return;
                }

                const data = event.data;
                if (!data || data.type !== 'commentkit') {
                    return;
                }

                console.log('[CommentKit] Received message:', data);

                switch (data.action) {
                    case 'resize':
                        // Adjust iframe height based on content
                        if (data.height) {
                            console.log('[CommentKit] Updating iframe height to:', data.height);
                            instance.iframe.style.height = data.height + 'px';
                        }
                        break;

                    case 'ready':
                        // Widget is ready
                        console.log('[CommentKit] Widget ready');
                        instance.container.classList.add('commentkit-ready');
                        break;

                    case 'error':
                        console.error('[CommentKit]', data.message);
                        break;
                }
            });
        },

        /**
         * Destroy a CommentKit instance
         */
        destroy: function (instance) {
            if (instance && instance.container) {
                instance.container.innerHTML = '';
                const index = this.instances.indexOf(instance);
                if (index > -1) {
                    this.instances.splice(index, 1);
                }
            }
        }
    };

    // Auto-initialize if script has data attributes
    function autoInit() {
        if (!currentScript) return;

        const containerId = currentScript.getAttribute('data-container') || '#commentkit';
        const theme = currentScript.getAttribute('data-theme');
        const dataPageId = currentScript.getAttribute('data-page-id');

        // Check for commentkit_config function (similar to disqus_config)
        let configOptions = {};
        if (typeof window.commentkit_config === 'function') {
            const config = {
                page: {
                    identifier: null,
                    title: null,
                    url: null
                }
            };
            window.commentkit_config.call(config);

            configOptions = {
                pageId: config.page.identifier,
                pageTitle: config.page.title,
                pageUrl: config.page.url
            };
        }

        // Data attribute can override config function
        if (dataPageId) {
            configOptions.pageId = dataPageId;
        }

        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                CommentKit.init({
                    container: containerId,
                    theme: theme,
                    ...configOptions
                });
            });
        } else {
            CommentKit.init({
                container: containerId,
                theme: theme,
                ...configOptions
            });
        }
    }

    // Export to global scope
    window.CommentKit = CommentKit;

    // Auto-initialize
    autoInit();
})();
