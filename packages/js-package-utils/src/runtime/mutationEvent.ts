export const MutationPhase = {
    Before: "before",
    After: "after",
    Failed: "failed",
} as const;

export type MutationPhase = (typeof MutationPhase)[keyof typeof MutationPhase];

export const MUTATION_PHASES: readonly MutationPhase[] = Object.values(MutationPhase);

export interface FlowEvent<Operation extends string = string, Result = unknown> {
    operation: Operation;
    cancelled: boolean;
    message?: string;
    result?: Result;
}

export interface MutationEvent<Operation extends string = string, Result = unknown>
    extends FlowEvent<Operation, Result> {
    action: string;
    body: FormData;
}

export type MutationEventName<
    Domain extends string,
    Operation extends string,
    Phase extends MutationPhase = MutationPhase,
> = `${Domain}_${Operation}_${Phase}`;

export function mutationEvent<
    Domain extends string,
    Operation extends string,
    Phase extends MutationPhase,
>(domain: Domain, operation: Operation, phase: Phase): MutationEventName<Domain, Operation, Phase> {
    return `${domain}_${operation}_${phase}`;
}
