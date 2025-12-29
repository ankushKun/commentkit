import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { sites as sitesApi, type SitePreviewWithStats, type SiteStats } from './api';

interface SiteContextType {
    selectedSiteId: number | null;
    sites: SitePreviewWithStats[];
    aggregated: SiteStats | null;
    currentSite: SitePreviewWithStats | null;
    loading: boolean;
    selectSite: (id: number | null) => void;
    refreshSites: () => Promise<void>;
}

const SiteContext = createContext<SiteContextType | null>(null);

export function SiteProvider({ children }: { children: ReactNode }) {
    const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
    const [sites, setSites] = useState<SitePreviewWithStats[]>([]);
    const [aggregated, setAggregated] = useState<SiteStats | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshSites = async () => {
        setLoading(true);
        const { data, error } = await sitesApi.overview();
        if (data && !error) {
            setSites(data.sites);
            setAggregated(data.aggregated);
            // Auto-select first site if none selected
            if (!selectedSiteId && data.sites.length > 0) {
                setSelectedSiteId(data.sites[0].id);
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        refreshSites();
    }, []);

    const selectSite = (id: number | null) => {
        setSelectedSiteId(id);
    };

    const currentSite = sites.find((s) => s.id === selectedSiteId) || null;

    return (
        <SiteContext.Provider
            value={{
                selectedSiteId,
                sites,
                aggregated,
                currentSite,
                loading,
                selectSite,
                refreshSites,
            }}
        >
            {children}
        </SiteContext.Provider>
    );
}

export function useSite() {
    const context = useContext(SiteContext);
    if (!context) {
        throw new Error('useSite must be used within a SiteProvider');
    }
    return context;
}
