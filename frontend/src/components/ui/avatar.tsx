import { useState } from 'react';

interface AvatarProps {
    emailHash?: string | null;
    name?: string | null;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const sizeClasses = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-12 w-12 text-base',
};

export function Avatar({ emailHash, name, size = 'md', className = '' }: AvatarProps) {
    const [imageError, setImageError] = useState(false);

    const displayName = name || 'Anonymous';
    const initial = (displayName[0] || 'A').toUpperCase();

    // Gravatar URL with SHA-256 support
    const gravatarUrl = emailHash
        ? `https://www.gravatar.com/avatar/${emailHash}?d=404&s=${size === 'lg' ? 96 : size === 'md' ? 64 : 48}`
        : null;

    const shouldShowImage = gravatarUrl && !imageError;

    return (
        <div className={`${sizeClasses[size]} rounded-full flex items-center justify-center shrink-0 ${className}`}>
            {shouldShowImage ? (
                <img
                    src={gravatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover rounded-full"
                    onError={() => setImageError(true)}
                />
            ) : (
                <div className="h-full w-full bg-blue-50 border border-blue-200 rounded-full flex items-center justify-center text-blue-600 font-bold">
                    {initial}
                </div>
            )}
        </div>
    );
}
