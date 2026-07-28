/**
 * Storefront event manager — the front-end counterpart of Magento's observers,
 * next to the plugin system already ported in `interceptorManager.ts`.
 *
 * The two answer different questions and both exist for the same reason they do
 * in PHP: an interceptor wraps a specific function and can change what it does,
 * an observer subscribes to something that happened and cannot. Extending the
 * cart flow from another module should not require knowing which function to
 * wrap, so the flow announces what it did and anyone can listen.
 *
 * Observers run in `sortOrder` and receive one mutable data object (Magento
 * parity), so a `*_before` observer can amend the request the flow is about to
 * make. An observer that throws is reported and skipped: a failing analytics
 * hook must not take down an add-to-cart.
 *
 * No DOM and no framework, so it is unit-testable in Node. The concrete
 * storefront wiring (the singleton, the CustomEvent bridge) lives in the
 * module's `web/js/events.ts`.
 */

export type EventObserver<T = Record<string, unknown>> = (data: T) => void | Promise<void>;

export interface ObserverEntry {
    name: string;
    observer: EventObserver<never>;
    sortOrder: number;
}

export interface EventManagerDeps {
    /** Reporting sink for an observer that threw. Defaults to `console.error`. */
    onError?(event: string, name: string, error: unknown): void;
}

const DEFAULT_SORT_ORDER = 10;

export class EventManager {
    private readonly observers: Record<string, ObserverEntry[]> = {};

    private readonly deps: EventManagerDeps;

    constructor(deps: EventManagerDeps = {}) {
        this.deps = deps;
    }

    /**
     * Subscribe to an event.
     *
     * @returns A function that removes this observer.
     */
    observe<T = Record<string, unknown>>(
        event: string,
        observer: EventObserver<T>,
        { name, sortOrder = DEFAULT_SORT_ORDER }: { name?: string; sortOrder?: number } = {},
    ): () => void {
        const entry: ObserverEntry = {
            name: name ?? `${event}_${(this.observers[event]?.length ?? 0) + 1}`,
            observer: observer as EventObserver<never>,
            sortOrder,
        };

        const entries = (this.observers[event] ??= []);
        entries.push(entry);
        entries.sort((a, b) => a.sortOrder - b.sortOrder);

        return () => {
            const at = entries.indexOf(entry);
            if (at > -1) {
                entries.splice(at, 1);
            }
        };
    }

    /**
     * Notify every observer of an event, in order, awaiting each.
     *
     * @returns The same data object the observers were given, after any of them
     *          amended it — so a dispatcher can read back what they changed.
     */
    async dispatch<T extends object>(event: string, data: T): Promise<T> {
        for (const entry of [...(this.observers[event] ?? [])]) {
            try {
                await (entry.observer as EventObserver<T>)(data);
            } catch (error) {
                this.report(event, entry.name, error);
            }
        }

        return data;
    }

    /**
     * Names of the observers registered for an event, in execution order.
     */
    observersOf(event: string): string[] {
        return (this.observers[event] ?? []).map((entry) => entry.name);
    }

    private report(event: string, name: string, error: unknown): void {
        if (this.deps.onError) {
            this.deps.onError(event, name, error);
            return;
        }
        console.error(`[MageObsidian] Observer "${name}" of "${event}" threw and was skipped.`, error);
    }
}
