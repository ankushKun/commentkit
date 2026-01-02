// PostHog Analytics Utility
// This provides type-safe wrapper functions for PostHog analytics

declare global {
    interface Window {
        posthog: any;
    }
}

/**
 * Track a custom event in PostHog
 * @param eventName - Name of the event to track
 * @param properties - Optional properties to attach to the event
 */
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
    if (typeof window !== 'undefined' && window.posthog) {
        window.posthog.capture(eventName, properties);
    }
};

/**
 * Identify a user in PostHog
 * @param userId - Unique identifier for the user
 * @param properties - Optional user properties
 */
export const identifyUser = (userId: string, properties?: Record<string, any>) => {
    if (typeof window !== 'undefined' && window.posthog) {
        window.posthog.identify(userId, properties);
    }
};

/**
 * Reset the user identity (e.g., on logout)
 */
export const resetUser = () => {
    if (typeof window !== 'undefined' && window.posthog) {
        window.posthog.reset();
    }
};

/**
 * Set user properties
 * @param properties - User properties to set
 */
export const setUserProperties = (properties: Record<string, any>) => {
    if (typeof window !== 'undefined' && window.posthog) {
        window.posthog.setPersonProperties(properties);
    }
};

/**
 * Check if a feature flag is enabled
 * @param flagKey - The feature flag key
 * @returns boolean indicating if the flag is enabled
 */
export const isFeatureEnabled = (flagKey: string): boolean => {
    if (typeof window !== 'undefined' && window.posthog) {
        return window.posthog.isFeatureEnabled(flagKey);
    }
    return false;
};

/**
 * Get feature flag value
 * @param flagKey - The feature flag key
 * @returns The feature flag value
 */
export const getFeatureFlag = (flagKey: string): any => {
    if (typeof window !== 'undefined' && window.posthog) {
        return window.posthog.getFeatureFlag(flagKey);
    }
    return null;
};

// Common event names for consistency
export const Events = {
    // Authentication
    USER_LOGGED_IN: 'user_logged_in',
    USER_LOGGED_OUT: 'user_logged_out',
    USER_REGISTERED: 'user_registered',

    // Comments
    COMMENT_CREATED: 'comment_created',
    COMMENT_DELETED: 'comment_deleted',
    COMMENT_EDITED: 'comment_edited',
    COMMENT_REPLIED: 'comment_replied',

    // Page views
    PAGE_VIEWED: 'page_viewed',
    DASHBOARD_VIEWED: 'dashboard_viewed',

    // Interactions
    BUTTON_CLICKED: 'button_clicked',
    FORM_SUBMITTED: 'form_submitted',
    MODAL_OPENED: 'modal_opened',
    MODAL_CLOSED: 'modal_closed',
} as const;
