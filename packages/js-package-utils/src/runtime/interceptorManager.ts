export type InterceptorType = "before" | "around" | "after";

// Handlers receive the intercepted subject first (Magento plugin parity); the
// remaining shape varies per type, so the tail stays `any[]`.
export type InterceptorHandler = (subject: any, ...rest: any[]) => any;

export interface InterceptorEntry {
    name: string;
    handler: InterceptorHandler;
    sortOrder: number;
}

type InterceptorBuckets = Record<InterceptorType, InterceptorEntry[]>;

const TYPES: readonly InterceptorType[] = ["before", "around", "after"];

function emptyBuckets(): InterceptorBuckets {
    return { before: [], around: [], after: [] };
}

class InterceptorManager {
    // `declare` keeps this type-only (erasable): the runtime field is created by
    // the constructor assignment below, type-stripping emits nothing for this.
    declare interceptors: Record<string, InterceptorBuckets>;

    constructor() {
        this.interceptors = {};
    }

    /**
     * Register an interceptor. `target` is the function/method name to wrap;
     * `name` is a unique id; `sortOrder` controls execution order.
     */
    addInterceptor(
        target: string,
        name: string,
        type: InterceptorType,
        handler: InterceptorHandler,
        sortOrder: number = 10,
    ) {
        if (!this.interceptors[target]) {
            this.interceptors[target] = emptyBuckets();
        }
        if (!TYPES.includes(type)) {
            throw new Error(`Invalid interceptor type: ${type}`);
        }
        this.interceptors[target][type].push({ name, handler, sortOrder });
        this.interceptors[target][type].sort((a, b) => a.sortOrder - b.sortOrder);
    }

    /**
     * Execute the intercepted method chain synchronously.
     *
     * Handlers receive the intercepted module exports as an explicit `subject`
     * first argument (Magento plugin parity): before(subject, ...args),
     * around(subject, proceed, ...args), after(subject, result, ...args).
     * `this` is still bound to the same object, so handlers written against the
     * legacy `this`-based access keep working (arrow functions now have a path
     * to the subject they could not reach via `this`).
     */
    executeSync(target: string, originalMethod: (...args: any[]) => any, context: any, ...args: any[]): any {
        const interceptors = this.interceptors[target] || emptyBuckets();

        // Execute 'before' interceptors
        for (const interceptor of interceptors.before) {
            const result = interceptor.handler.apply(context, [context, ...args]);
            if (Array.isArray(result)) {
                args = result;
            }
        }

        // Execute 'around' interceptors
        let methodToExecute = (...currentArgs: any[]) => {
            return originalMethod.apply(context, currentArgs);
        };

        if (interceptors.around.length > 0) {
            const aroundInterceptors = [...interceptors.around].reverse();
            for (const interceptor of aroundInterceptors) {
                const next = methodToExecute;
                methodToExecute = (...currentArgs: any[]) => {
                    return interceptor.handler.apply(context, [context, next, ...currentArgs]);
                };
            }
        }

        let result = methodToExecute(...args);

        // Execute 'after' interceptors
        for (const interceptor of interceptors.after) {
            result = interceptor.handler.apply(context, [context, result, ...args]);
        }

        return result;
    }

    /**
     * Execute the intercepted method chain.
     *
     * Same `subject`-first contract as {@link executeSync}: before(subject,
     * ...args), around(subject, proceed, ...args), after(subject, result,
     * ...args), with `this` still bound to the subject for backward compat.
     */
    async execute(target: string, originalMethod: (...args: any[]) => any, context: any, ...args: any[]): Promise<any> {
        const interceptors = this.interceptors[target] || emptyBuckets();

        // Execute 'before' interceptors
        // Before interceptors receive (subject, ...args) and can modify args by
        // returning an array of the (subject-less) args.
        for (const interceptor of interceptors.before) {
            const result = await interceptor.handler.apply(context, [context, ...args]);
            if (Array.isArray(result)) {
                args = result;
            }
        }

        // Execute 'around' interceptors
        // Around interceptors receive (subject, proceed, ...args)
        let methodToExecute = async (...currentArgs: any[]) => {
            return await originalMethod.apply(context, currentArgs);
        };

        // Wrap around interceptors: first registered is outer-most
        if (interceptors.around.length > 0) {
            const aroundInterceptors = [...interceptors.around].reverse();
            for (const interceptor of aroundInterceptors) {
                const next = methodToExecute;
                methodToExecute = async (...currentArgs: any[]) => {
                    return await interceptor.handler.apply(context, [
                        context,
                        next,
                        ...currentArgs,
                    ]);
                };
            }
        }

        let result = await methodToExecute(...args);

        // Execute 'after' interceptors
        // After interceptors receive (subject, result, ...args) and must return result
        for (const interceptor of interceptors.after) {
            result = await interceptor.handler.apply(context, [context, result, ...args]);
        }

        return result;
    }

    /**
     * Create a proxy that intercepts method calls on an object (e.g. module
     * exports). `namespace` scopes the interceptor keys; `useAsync` picks the
     * async or sync chain.
     */
    intercept(target: object, namespace: string, useAsync: boolean = true) {
        return new Proxy(target, {
            get: (obj: any, prop) => {
                const value = obj[prop];
                if (typeof value === "function") {
                    return (...args: any[]) => {
                        const method = useAsync ? this.execute : this.executeSync;
                        return method.call(
                            this,
                            `${namespace}::${String(prop)}`,
                            value,
                            obj,
                            ...args,
                        );
                    };
                }
                return value;
            },
        });
    }
}

export default new InterceptorManager();
