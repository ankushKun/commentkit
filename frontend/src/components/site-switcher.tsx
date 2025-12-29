import { useSite } from '@/lib/site-context';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Globe, CheckCircle2 } from 'lucide-react';

export function SiteSwitcher() {
    const { sites, currentSite, selectedSiteId, selectSite, loading } = useSite();

    if (loading) {
        return (
            <div className="flex items-center gap-2 p-2 rounded-md bg-slate-50 border border-slate-200">
                <Globe className="h-4 w-4 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="h-4 bg-slate-200 rounded animate-pulse" />
                </div>
            </div>
        );
    }

    if (sites.length === 0) {
        return (
            <div className="flex items-center gap-2 p-2 rounded-md bg-slate-50 border border-slate-200">
                <Globe className="h-4 w-4 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0 text-sm text-slate-500">
                    No sites yet
                </div>
            </div>
        );
    }

    return (
        <Select
            value={selectedSiteId?.toString() || ''}
            onValueChange={(value) => selectSite(value ? parseInt(value) : null)}
        >
            <SelectTrigger className="w-full h-auto py-2 px-3 bg-white hover:bg-slate-50 border-slate-200">
                <SelectValue>
                    <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-slate-500 shrink-0" />
                        <div className="flex-1 min-w-0 text-left">
                            <div className="font-medium text-sm text-slate-900 truncate">
                                {currentSite?.name || 'Select a site'}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                                {currentSite?.domain}
                            </div>
                        </div>
                    </div>
                </SelectValue>
            </SelectTrigger>
            <SelectContent className="w-60">
                {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id.toString()}>
                        <div className="flex items-start gap-2 py-1">
                            <Globe className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-slate-900 truncate flex items-center gap-1.5">
                                    {site.name}
                                    {site.id === selectedSiteId && (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                                    )}
                                </div>
                                <div className="text-xs text-slate-500 truncate">
                                    {site.domain}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                                    <span>{site.stats.total_comments} comments</span>
                                    {site.stats.pending_comments > 0 && (
                                        <span className="text-orange-600 font-medium">
                                            {site.stats.pending_comments} pending
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
