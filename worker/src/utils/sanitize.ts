/**
 * Content Sanitization Utilities
 *
 * Implements a strict allowlist-based approach to prevent XSS attacks.
 * By default, ALL HTML is stripped and only plain text is allowed.
 *
 * This is defense-in-depth:
 * - Backend sanitizes and strips HTML
 * - Frontend escapes when rendering
 * - CSP prevents inline scripts
 */

/**
 * Strip all HTML tags and decode HTML entities
 * This is the safest approach - treat all user content as plain text
 */
export function stripAllHtml(input: string): string {
    if (typeof input !== 'string') {
        return '';
    }

    // Remove null bytes (can cause issues in some contexts)
    let sanitized = input.replace(/\0/g, '');

    // Limit length to prevent abuse (10,000 characters)
    if (sanitized.length > 10000) {
        sanitized = sanitized.slice(0, 10000);
    }

    // Strip all HTML tags using a comprehensive regex
    // This removes <anything> including self-closing tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');

    // Decode HTML entities to prevent double-escaping
    // When frontend escapes, we don't want &lt; to become &amp;lt;
    sanitized = decodeHtmlEntities(sanitized);

    // Remove any remaining HTML-like patterns that might have been obfuscated
    // e.g., &lt;script&gt; -> <script>
    sanitized = sanitized.replace(/<[^>]*>/g, '');

    // Normalize whitespace
    sanitized = sanitized.trim();

    return sanitized;
}

/**
 * Decode HTML entities to plain text
 * Prevents double-encoding when frontend escapes content
 */
function decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&#x27;': "'",
        '&#x2F;': '/',
        '&#47;': '/',
    };

    return text.replace(/&(?:amp|lt|gt|quot|#39|#x27|#x2F|#47);/g, (match) => {
        return entities[match] || match;
    });
}

/**
 * Sanitize author name (extra strict)
 * - Strips all HTML
 * - Limits length
 * - Removes control characters
 */
export function sanitizeAuthorName(input: string): string {
    if (typeof input !== 'string') {
        return 'Anonymous';
    }

    let sanitized = stripAllHtml(input);

    // Remove control characters (except newlines/tabs which will be normalized)
    sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

    // Limit length for names (100 characters)
    if (sanitized.length > 100) {
        sanitized = sanitized.slice(0, 100);
    }

    // Normalize whitespace to single spaces
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    // If empty after sanitization, return default
    if (!sanitized) {
        return 'Anonymous';
    }

    return sanitized;
}

/**
 * Sanitize comment content
 * - Strips all HTML tags
 * - Preserves line breaks
 * - Limits length
 */
export function sanitizeCommentContent(input: string): string {
    if (typeof input !== 'string') {
        return '';
    }

    let sanitized = stripAllHtml(input);

    // Preserve intentional line breaks (convert multiple newlines to max 2)
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

    // Remove other control characters but keep newlines and tabs
    sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

    // Limit length (10,000 characters)
    if (sanitized.length > 10000) {
        sanitized = sanitized.slice(0, 10000);
    }

    sanitized = sanitized.trim();

    return sanitized;
}

/**
 * Validate and sanitize email addresses
 * Returns null if invalid
 */
export function sanitizeEmail(input: string): string | null {
    if (typeof input !== 'string') {
        return null;
    }

    // Remove whitespace
    const email = input.trim().toLowerCase();

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
        return null;
    }

    // Limit length (254 is max valid email length per RFC 5321)
    if (email.length > 254) {
        return null;
    }

    // Additional validation: no HTML characters
    if (/<|>|&/.test(email)) {
        return null;
    }

    return email;
}

/**
 * Sanitize URL (for page URLs)
 * Returns null if invalid
 */
export function sanitizeUrl(input: string): string | null {
    if (typeof input !== 'string') {
        return null;
    }

    const url = input.trim();

    // Limit length
    if (url.length > 2048) {
        return null;
    }

    // Only allow http/https URLs
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return null;
    }

    // Check for javascript: or data: in the URL (case insensitive)
    if (/javascript:/i.test(url) || /data:/i.test(url)) {
        return null;
    }

    try {
        // Validate it's a proper URL
        new URL(url);
        return url;
    } catch {
        return null;
    }
}

/**
 * Sanitize page title
 */
export function sanitizePageTitle(input: string): string {
    if (typeof input !== 'string') {
        return 'Untitled Page';
    }

    let sanitized = stripAllHtml(input);

    // Remove control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    // Limit length
    if (sanitized.length > 200) {
        sanitized = sanitized.slice(0, 200);
    }

    if (!sanitized) {
        return 'Untitled Page';
    }

    return sanitized;
}
