/**
 * Framework island runtime — the browser side of `renderVueComponent`.
 *
 * PHP emits a marker per component
 * (`<div data-mage-island data-component data-props data-strategy>`), optionally
 * carrying the component's server-rendered initial state; this module turns each
 * marker into a mounted Vue app. Every island is its own app (preserving
 * isolation), but the Vue runtime and the i18n plugin are loaded once per page
 * and shared, and "visible" islands hydrate only when they enter the viewport —
 * so below-the-fold components cost nothing until scrolled to.
 *
 * All side effects (dynamic import, app creation, plugin wiring, viewport
 * observation) are injected, so the discovery/hydration logic is unit-testable
 * in Node without a DOM, a bundler, or Vue. The concrete wiring lives in the
 * module's `web/js/islands.ts`.
 */

// Set synchronously before the async import so a second observer callback for
// the same element is a no-op (dataset key for `data-mage-island-mounted`).
const MOUNTED_FLAG = "mageIslandMounted";

interface IslandElement {
    dataset: Record<string, string | undefined>;
}

interface AppLike {
    mount(el: unknown): unknown;
}

interface HydrateDeps {
    importComponent(source: string): Promise<{ default?: unknown }>;
    /**
     * `hydrate` tells the factory which Vue entry point to use. Adopting server
     * markup needs `createSSRApp`; a container about to be cleared needs
     * `createApp`, which otherwise warns that it found nothing to hydrate.
     */
    createApp(component: unknown, props: Record<string, unknown>, hydrate: boolean): AppLike;
    configureApp(app: AppLike): void;
    clearContainer?(element: IslandElement): void;
    /** Opaque state captured before mounting, handed back to `onMounted`. */
    snapshot?(element: IslandElement): unknown;
    onMounted?(element: IslandElement, snapshot: unknown): void;
}

interface DiscoverDeps extends HydrateDeps {
    observe(element: IslandElement, onVisible: () => void): void;
}

/**
 * Mount a single island. Idempotent: the first call claims the element and
 * later calls return immediately, so re-observation never double-mounts.
 *
 * @throws Error When the marker has no `data-component`.
 */
export async function hydrateIsland(
    element: IslandElement,
    deps: HydrateDeps,
): Promise<AppLike | undefined> {
    if (element.dataset[MOUNTED_FLAG]) {
        return undefined;
    }
    element.dataset[MOUNTED_FLAG] = "1";

    const source = element.dataset.component;
    if (!source) {
        throw new Error("Island marker is missing data-component.");
    }

    const module = await deps.importComponent(source);
    const component = module.default ?? module;
    const props = element.dataset.props ? JSON.parse(element.dataset.props) : {};

    const hydrate = Boolean(element.dataset.hydrate);
    // Captured before the container is cleared: the baseline is what the page
    // painted, not what is left after a placeholder is thrown away.
    const snapshot = deps.snapshot?.(element);
    if (!hydrate) {
        deps.clearContainer?.(element);
    }

    const app = deps.createApp(component, props, hydrate);
    deps.configureApp(app);
    app.mount(element);
    // Read back before yielding to the event loop, so what is compared is what
    // hydration did and not what a later reactive effect changed.
    deps.onMounted?.(element, snapshot);
    return app;
}

/**
 * Hydrate every marker. `eager` markers mount now; the rest mount when the
 * injected observer reports them visible.
 */
export function hydrateAll(elements: Iterable<IslandElement>, deps: DiscoverDeps): void {
    for (const element of elements) {
        const strategy = element.dataset.strategy ?? "visible";
        if (strategy === "eager") {
            void hydrateIsland(element, deps);
        } else {
            deps.observe(element, () => {
                void hydrateIsland(element, deps);
            });
        }
    }
}
