// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- augmented per module
export interface StorefrontEventMap {}

export type KnownEvent = keyof StorefrontEventMap & string;

export type EventObserver<T = Record<string, unknown>> = (data: T) => void | Promise<void>;

export interface ObserverOptions {
    name?: string;
    sortOrder?: number;
}

export interface ObserverEntry {
    name: string;
    observer: EventObserver<never>;
    sortOrder: number;
}

export interface DispatchOptions {
    sticky?: boolean;
    mirror?: boolean;
}

export interface DispatchHook {
    start?(event: string, data: object, options: DispatchOptions): void;
    end?(event: string, data: object, options: DispatchOptions): void;
}

export interface EventManagerDeps {
    onError?(event: string, name: string, error: unknown): void;
    now?(): number;
    debug?: boolean;
}

const DEFAULT_SORT_ORDER = 10;
const SLOW_OBSERVER_MS = 16;

export class EventManager {
    private readonly observers: Record<string, ObserverEntry[]> = {};

    private readonly hooks: DispatchHook[] = [];

    private readonly stickyData = new Map<string, object>();

    private readonly deps: EventManagerDeps;

    private debugging: boolean;

    constructor(deps: EventManagerDeps = {}) {
        this.deps = deps;
        this.debugging = deps.debug ?? false;
    }

    observe<K extends KnownEvent>(
        event: K,
        observer: EventObserver<StorefrontEventMap[K]>,
        options?: ObserverOptions,
    ): () => void;
    observe<T = Record<string, unknown>>(
        event: string,
        observer: EventObserver<T>,
        options?: ObserverOptions,
    ): () => void;
    observe(
        event: string,
        observer: EventObserver<never>,
        { name, sortOrder = DEFAULT_SORT_ORDER }: ObserverOptions = {},
    ): () => void {
        const entry: ObserverEntry = {
            name: name ?? `${event}_${(this.observers[event]?.length ?? 0) + 1}`,
            observer,
            sortOrder,
        };

        const entries = (this.observers[event] ??= []);
        entries.push(entry);
        entries.sort((a, b) => a.sortOrder - b.sortOrder);

        const remembered = this.stickyData.get(event);
        if (remembered) {
            void this.invoke(event, entry, remembered);
        }

        return () => {
            const at = entries.indexOf(entry);
            if (at > -1) {
                entries.splice(at, 1);
            }
        };
    }

    observeOnce<K extends KnownEvent>(
        event: K,
        observer: EventObserver<StorefrontEventMap[K]>,
        options?: ObserverOptions,
    ): () => void;
    observeOnce<T = Record<string, unknown>>(
        event: string,
        observer: EventObserver<T>,
        options?: ObserverOptions,
    ): () => void;
    observeOnce(
        event: string,
        observer: EventObserver<never>,
        options: ObserverOptions = {},
    ): () => void {
        let spent = false;
        let off = (): void => {
            spent = true;
        };

        const remove = this.observe(
            event,
            ((data: never) => {
                off();
                return observer(data);
            }) as EventObserver<never>,
            options,
        );

        if (spent) {
            remove();
        }
        off = remove;

        return remove;
    }

    dispatch<K extends KnownEvent>(
        event: K,
        data: StorefrontEventMap[K],
        options?: DispatchOptions,
    ): Promise<StorefrontEventMap[K]>;
    dispatch<T extends object>(event: string, data: T, options?: DispatchOptions): Promise<T>;
    async dispatch(event: string, data: object, options: DispatchOptions = {}): Promise<object> {
        if (options.sticky) {
            this.stickyData.set(event, data);
        }

        this.runHooks("start", event, data, options);
        if (this.debugging) {
            console.debug(`[MageObsidian] → ${event}`, data);
        }

        // Snapshot: an observer may unsubscribe mid-dispatch, and splicing the
        // live array would make the loop skip the entry that follows it.
        for (const entry of (this.observers[event] ?? []).slice()) {
            await this.invoke(event, entry, data);
        }

        this.runHooks("end", event, data, options);

        return data;
    }

    sticky(event: string): object | undefined {
        return this.stickyData.get(event);
    }

    onDispatch(hook: DispatchHook): () => void {
        this.hooks.push(hook);
        return () => {
            const at = this.hooks.indexOf(hook);
            if (at > -1) {
                this.hooks.splice(at, 1);
            }
        };
    }

    debug(enabled = true): void {
        this.debugging = enabled;
    }

    observersOf(event: string): string[] {
        return (this.observers[event] ?? []).map((entry) => entry.name);
    }

    private async invoke(event: string, entry: ObserverEntry, data: object): Promise<void> {
        const startedAt = this.debugging ? this.clock() : 0;
        try {
            await (entry.observer as EventObserver<object>)(data);
        } catch (error) {
            this.report(event, entry.name, error);
            return;
        }
        if (!this.debugging) {
            return;
        }
        const elapsed = this.clock() - startedAt;
        if (elapsed > SLOW_OBSERVER_MS) {
            console.warn(
                `[MageObsidian] Observer "${entry.name}" of "${event}" took ` +
                    `${elapsed.toFixed(1)}ms and delayed the interaction that dispatched it.`,
            );
        }
    }

    private runHooks(
        phase: keyof DispatchHook,
        event: string,
        data: object,
        options: DispatchOptions,
    ): void {
        for (const hook of this.hooks.slice()) {
            try {
                hook[phase]?.(event, data, options);
            } catch (error) {
                this.report(event, `hook:${phase}`, error);
            }
        }
    }

    private clock(): number {
        if (this.deps.now) {
            return this.deps.now();
        }
        return typeof performance !== "undefined" ? performance.now() : 0;
    }

    private report(event: string, name: string, error: unknown): void {
        if (this.deps.onError) {
            this.deps.onError(event, name, error);
            return;
        }
        console.error(
            `[MageObsidian] Observer "${name}" of "${event}" threw and was skipped.`,
            error,
        );
    }
}
