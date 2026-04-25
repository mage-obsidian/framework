/**
 * Framework island runtime — the browser side of `renderVueComponent`.
 *
 * PHP emits an inert marker per component
 * (`<div data-mage-island data-component data-props data-strategy>`); this
 * module turns each marker into a mounted Vue app. Every island is its own app
 * (preserving isolation), but the Vue runtime and the i18n plugin are loaded
 * once per page and shared, and "visible" islands hydrate only when they enter
 * the viewport — so below-the-fold components cost nothing until scrolled to.
 *
 * All side effects (dynamic import, app creation, plugin wiring, viewport
 * observation) are injected, so the discovery/hydration logic is unit-testable
 * in Node without a DOM, a bundler, or Vue. The concrete wiring lives in the
 * module's `web/js/islands.js`.
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
    createApp(component: unknown, props?: Record<string, unknown>): AppLike;
    configureApp(app: AppLike): void;
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

    const app = deps.createApp(component, props);
    deps.configureApp(app);
    app.mount(element);
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
