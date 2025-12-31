import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { auth, type User, type BootstrapData } from './api';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    updateUser: (user: User) => void;
    // Bootstrap data - cached on initial load, consumed once
    consumeBootstrap: () => BootstrapData | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    // Store bootstrap data for one-time consumption by OverviewTab
    const bootstrapRef = useRef<BootstrapData | null>(null);

    const checkAuth = async () => {
        // No need to check localStorage - server will read HttpOnly cookie
        // Request with bootstrap=true to get user + dashboard data in single call
        const { data, error } = await auth.me({ bootstrap: true });
        if (error) {
            // User not authenticated (no valid cookie)
            setUser(null);
        } else if (data) {
            // Store bootstrap data for consumption
            if (data.bootstrap) {
                bootstrapRef.current = data.bootstrap;
            }
            // Set user without bootstrap property
            const { bootstrap: _, ...userData } = data;
            setUser(userData);
        }
        setLoading(false);
    };

    useEffect(() => {
        // Check for token in URL (from magic link)
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        const redirectUrl = params.get('redirect');

        if (token) {
            // Verify token - server will set HttpOnly cookie in response
            auth.verify(token).then(({ data, error }) => {
                if (data && !error) {
                    // No need to store token - server sets HttpOnly cookie
                    setUser(data.user);

                    // Redirect to the original page if specified
                    if (redirectUrl) {
                        window.location.href = redirectUrl;
                        return;
                    }

                    // Clean URL if not redirecting
                    window.history.replaceState({}, '', window.location.pathname);
                }
                setLoading(false);
            });
        } else {
            checkAuth();
        }
    }, []);

    const login = async (email: string) => {
        const { error } = await auth.login(email);
        if (error) {
            return { success: false, error };
        }
        return { success: true };
    };

    const logout = async () => {
        // Server will clear HttpOnly cookie
        await auth.logout();
        setUser(null);
        bootstrapRef.current = null;
    };

    const updateUser = (updatedUser: User) => {
        setUser(updatedUser);
    };

    // Consume bootstrap data (returns it once, then clears it)
    const consumeBootstrap = () => {
        const data = bootstrapRef.current;
        bootstrapRef.current = null;
        return data;
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, checkAuth, updateUser, consumeBootstrap }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
