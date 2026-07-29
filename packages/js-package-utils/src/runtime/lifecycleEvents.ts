export const LifecycleEvent = {
    IslandMountBefore: "island_mount_before",
    IslandMountAfter: "island_mount_after",
    IslandMountFailed: "island_mount_failed",
    PageReady: "page_ready",
    PageHidden: "page_hidden",
    PageVisible: "page_visible",
    PageLeave: "page_leave",
    SectionReloadBefore: "section_reload_before",
    SectionReloadAfter: "section_reload_after",
    SectionReloadFailed: "section_reload_failed",
} as const;

export type LifecycleEvent = (typeof LifecycleEvent)[keyof typeof LifecycleEvent];

export interface IslandEvent {
    component: string;
    strategy: string;
    element: unknown;
    durationMs?: number;
    error?: unknown;
}

export interface PageEvent {
    url: string;
    islands?: number;
    persisted?: boolean;
}

export interface SectionEvent {
    names: string[];
    changed?: string[];
}

declare module "./eventManager.ts" {
    interface StorefrontEventMap {
        [LifecycleEvent.IslandMountBefore]: IslandEvent;
        [LifecycleEvent.IslandMountAfter]: IslandEvent;
        [LifecycleEvent.IslandMountFailed]: IslandEvent;
        [LifecycleEvent.PageReady]: PageEvent;
        [LifecycleEvent.PageHidden]: PageEvent;
        [LifecycleEvent.PageVisible]: PageEvent;
        [LifecycleEvent.PageLeave]: PageEvent;
        [LifecycleEvent.SectionReloadBefore]: SectionEvent;
        [LifecycleEvent.SectionReloadAfter]: SectionEvent;
        [LifecycleEvent.SectionReloadFailed]: SectionEvent;
    }
}
