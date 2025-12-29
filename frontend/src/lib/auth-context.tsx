import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { auth, type User } from './api';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const checkAuth = async () => {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            setLoading(false);
            return;
        }

        const { data, error } = await auth.me();
        if (error) {
            localStorage.removeItem('auth_token');
            setUser(null);
        } else {
            setUser(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        // Check for token in URL (from magic link)
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');

        if (token) {
            // Verify and store token
            auth.verify(token).then(({ data, error }) => {
                if (data && !error) {
                    localStorage.setItem('auth_token', data.token);
                    setUser(data.user);
                    // Clean URL
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
        await auth.logout();
        localStorage.removeItem('auth_token');
        setUser(null);
    };

    const updateUser = (updatedUser: User) => {
        setUser(updatedUser);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, checkAuth, updateUser }}>
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
