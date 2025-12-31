class InterceptorManager {
    constructor() {
        this.interceptors = {};
    }

    /**
     * Register an interceptor
     * @param {string} target - The name of the target function/method to intercept
     * @param {string} name - Unique name for the interceptor
     * @param {string} type - 'before', 'around', 'after'
     * @param {Function} handler - The function to execute
     * @param {number} sortOrder - Order of execution
     */
    addInterceptor(target, name, type, handler, sortOrder = 10) {
        if (!this.interceptors[target]) {
            this.interceptors[target] = { before: [], around: [], after: [] };
        }
        if (!['before', 'around', 'after'].includes(type)) {
            throw new Error(`Invalid interceptor type: ${type}`);
        }
        this.interceptors[target][type].push({ name, handler, sortOrder });
        this.interceptors[target][type].sort((a, b) => a.sortOrder - b.sortOrder);
    }

    /**
     * Execute the intercepted method chain synchronously
     * @param {string} target - The target method name
     * @param {Function} originalMethod - The original function
     * @param {Object} context - The 'this' context
     * @param {Array} args - Arguments passed to the function
     */
    executeSync(target, originalMethod, context, ...args) {
        const interceptors = this.interceptors[target] || { before: [], around: [], after: [] };

        // Execute 'before' interceptors
        for (const interceptor of interceptors.before) {
            const result = interceptor.handler.apply(context, args);
            if (Array.isArray(result)) {
                args = result;
            }
        }

        // Execute 'around' interceptors
        let methodToExecute = (...currentArgs) => {
            return originalMethod.apply(context, currentArgs);
        };

        if (interceptors.around.length > 0) {
            const aroundInterceptors = [...interceptors.around].reverse();
            for (const interceptor of aroundInterceptors) {
                const next = methodToExecute;
                methodToExecute = (...currentArgs) => {
                    return interceptor.handler.apply(context, [next, ...currentArgs]);
                };
            }
        }

        let result = methodToExecute(...args);

        // Execute 'after' interceptors
        for (const interceptor of interceptors.after) {
            result = interceptor.handler.apply(context, [result, ...args]);
        }

        return result;
    }

    /**
     * Execute the intercepted method chain
     * @param {string} target - The target method name
     * @param {Function} originalMethod - The original function
     * @param {Object} context - The 'this' context
     * @param {Array} args - Arguments passed to the function
     */
    async execute(target, originalMethod, context, ...args) {
        const interceptors = this.interceptors[target] || { before: [], around: [], after: [] };

        // Execute 'before' interceptors
        // Before interceptors can modify args by returning an array
        for (const interceptor of interceptors.before) {
            const result = await interceptor.handler.apply(context, args);
            if (Array.isArray(result)) {
                args = result;
            }
        }

        // Execute 'around' interceptors
        // Around interceptors receive (proceed, ...args)
        let methodToExecute = async (...currentArgs) => {
            return await originalMethod.apply(context, currentArgs);
        };

        // Wrap around interceptors: first registered is outer-most
        if (interceptors.around.length > 0) {
            const aroundInterceptors = [...interceptors.around].reverse();
            for (const interceptor of aroundInterceptors) {
                const next = methodToExecute;
                methodToExecute = async (...currentArgs) => {
                    return await interceptor.handler.apply(context, [next, ...currentArgs]);
                };
            }
        }

        let result = await methodToExecute(...args);

        // Execute 'after' interceptors
        // After interceptors receive (result, ...args) and must return result
        for (const interceptor of interceptors.after) {
            result = await interceptor.handler.apply(context, [result, ...args]);
        }

        return result;
    }

    /**
     * Create a proxy to intercept method calls on an object
     * @param {Object} target - The target object (e.g. module exports)
     * @param {string} namespace - Namespace for interceptors
     * @param {boolean} useAsync - Whether to use async execution
     */
    intercept(target, namespace, useAsync = true) {
        return new Proxy(target, {
            get: (obj, prop) => {
                const value = obj[prop];
                if (typeof value === 'function') {
                    return (...args) => {
                        const method = useAsync ? this.execute : this.executeSync;
                        return method.call(this, `${namespace}::${String(prop)}`, value, obj, ...args);
                    };
                }
                return value;
            }
        });
    }
}

export default new InterceptorManager();
