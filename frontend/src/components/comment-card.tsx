import { type Comment } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Check, X, AlertTriangle, Trash2, Clock, ExternalLink } from 'lucide-react';
import { cn, formatTimeAgo } from '@/lib/utils';

interface CommentCardProps {
    comment: Comment;
    showActions?: boolean;
    showPage?: boolean;
    pageTitle?: string | null;
    pageSlug?: string;
    selected?: boolean;
    onSelect?: (id: number) => void;
    onApprove?: (id: number) => void;
    onReject?: (id: number) => void;
    onSpam?: (id: number) => void;
    onDelete?: (id: number) => void;
}

export function CommentCard({
    comment,
    showActions = false,
    showPage = false,
    pageTitle,
    pageSlug,
    selected = false,
    onSelect,
    onApprove,
    onReject,
    onSpam,
    onDelete,
}: CommentCardProps) {
    const statusConfig = {
        approved: { color: 'text-green-600', bg: 'bg-green-50', label: 'Approved', icon: Check },
        pending: { color: 'text-orange-600', bg: 'bg-orange-50', label: 'Pending', icon: Clock },
        rejected: { color: 'text-red-600', bg: 'bg-red-50', label: 'Rejected', icon: X },
        spam: { color: 'text-gray-600', bg: 'bg-gray-50', label: 'Spam', icon: AlertTriangle },
    };

    const config = statusConfig[comment.status as keyof typeof statusConfig];
    const StatusIcon = config?.icon || Clock;

    return (
        <Card className={cn(
            "transition-all hover:shadow-md border-slate-200",
            selected && "ring-2 ring-blue-500 ring-offset-2"
        )}>
            <CardContent className="p-5">
                <div className="flex gap-4">
                    {/* Selection Checkbox */}
                    {onSelect && (
                        <div className="flex items-start pt-0.5">
                            <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => onSelect(comment.id)}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                        </div>
                    )}

                    {/* Comment Content */}
                    <div className="flex-1 min-w-0 space-y-3">
                        {/* Header: Author + Status + Time */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-3">
                                <Avatar
                                    emailHash={comment.author_email_hash}
                                    name={comment.author_name}
                                    size="md"
                                />
                                <span className="font-semibold text-slate-900">
                                    {comment.author_name || 'Anonymous'}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                {config && (
                                    <span className={cn(
                                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                                        config.bg,
                                        config.color
                                    )}>
                                        <StatusIcon className="h-3.5 w-3.5" />
                                        {config.label}
                                    </span>
                                )}
                                <span className="text-sm text-slate-500">
                                    {formatTimeAgo(comment.created_at)}
                                </span>
                            </div>
                        </div>

                        {/* Page Info (if enabled) */}
                        {showPage && (pageTitle || pageSlug) && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <span>on</span>
                                <a
                                    href={`#/page/${pageSlug}`}
                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline font-medium"
                                >
                                    {pageTitle || pageSlug}
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </div>
                        )}

                        {/* Comment Text */}
                        <div className="prose prose-sm max-w-none">
                            <p className="text-slate-700 leading-relaxed">
                                {comment.content}
                            </p>
                        </div>

                        {/* Author Email (if available) */}
                        {comment.author_email && (
                            <div className="text-xs text-slate-500">
                                {comment.author_email}
                            </div>
                        )}

                        {/* Action Buttons */}
                        {showActions && (
                            <div className="flex items-center gap-2 pt-2">
                                {onApprove && comment.status !== 'approved' && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onApprove(comment.id)}
                                        className="h-7 text-xs gap-1.5 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                                    >
                                        <Check className="h-3.5 w-3.5" />
                                        Approve
                                    </Button>
                                )}
                                {onReject && comment.status !== 'rejected' && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onReject(comment.id)}
                                        className="h-7 text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                        Reject
                                    </Button>
                                )}
                                {onSpam && comment.status !== 'spam' && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onSpam(comment.id)}
                                        className="h-7 text-xs gap-1.5 text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-700"
                                    >
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                        Spam
                                    </Button>
                                )}
                                {onDelete && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onDelete(comment.id)}
                                        className="h-7 text-xs gap-1.5 text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-700"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Delete
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
