import { MutationPhase, MUTATION_PHASES } from "./mutationEvent.ts";

export const ActivityPhase = {
    Begin: "begin",
    End: "end",
} as const;

export type ActivityPhase = (typeof ActivityPhase)[keyof typeof ActivityPhase];

export interface ActivityMatch {
    phase: ActivityPhase;
    scopes: string[];
}

export interface ActivityTrackerDeps {
    onChange?(scope: string, pending: number): void;
    schedule?(callback: () => void, ms: number): () => void;
    timeoutMs?: number;
    onStuck?(scope: string): void;
}

const PHASE_ACTIVITY: Record<MutationPhase, ActivityPhase> = {
    [MutationPhase.Before]: ActivityPhase.Begin,
    [MutationPhase.After]: ActivityPhase.End,
    [MutationPhase.Failed]: ActivityPhase.End,
};

const SEPARATOR = "_";
const DEFAULT_TIMEOUT_MS = 15_000;

export function matchActivity(event: string): ActivityMatch | null {
    for (const phase of MUTATION_PHASES) {
        const suffix = `${SEPARATOR}${phase}`;
        if (!event.endsWith(suffix)) {
            continue;
        }
        const operation = event.slice(0, -suffix.length);
        const domain = operation.split(SEPARATOR)[0];
        if (!domain || !operation) {
            return null;
        }
        return {
            phase: PHASE_ACTIVITY[phase],
            scopes: domain === operation ? [domain] : [domain, operation],
        };
    }
    return null;
}

export class ActivityTracker {
    private readonly counts = new Map<string, number>();

    private readonly timers = new Map<string, () => void>();

    private readonly deps: ActivityTrackerDeps;

    constructor(deps: ActivityTrackerDeps = {}) {
        this.deps = deps;
    }

    begin(scope: string): void {
        const next = this.pending(scope) + 1;
        this.counts.set(scope, next);
        if (next === 1) {
            this.arm(scope);
        }
        this.deps.onChange?.(scope, next);
    }

    end(scope: string): void {
        const current = this.pending(scope);
        if (current === 0) {
            return;
        }
        const next = current - 1;
        this.counts.set(scope, next);
        if (next === 0) {
            this.disarm(scope);
        }
        this.deps.onChange?.(scope, next);
    }

    pending(scope: string): number {
        return this.counts.get(scope) ?? 0;
    }

    isBusy(scope: string): boolean {
        return this.pending(scope) > 0;
    }

    busyScopes(): string[] {
        return [...this.counts.entries()].filter(([, count]) => count > 0).map(([scope]) => scope);
    }

    private arm(scope: string): void {
        const timeout = this.deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const schedule =
            this.deps.schedule ??
            ((callback: () => void, ms: number) => {
                const id = setTimeout(callback, ms);
                return () => clearTimeout(id);
            });

        this.timers.set(
            scope,
            schedule(() => {
                this.timers.delete(scope);
                this.counts.set(scope, 0);
                this.deps.onStuck?.(scope);
                this.deps.onChange?.(scope, 0);
            }, timeout),
        );
    }

    private disarm(scope: string): void {
        this.timers.get(scope)?.();
        this.timers.delete(scope);
    }
}

export function createActivityTracker(deps: ActivityTrackerDeps = {}): ActivityTracker {
    return new ActivityTracker(deps);
}
