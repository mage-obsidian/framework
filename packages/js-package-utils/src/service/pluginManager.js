class PluginManager {
    constructor() {
        this.plugins = {};
    }

    /**
     * Register a plugin
     * @param {string} target - The name of the target function/method to intercept
     * @param {string} name - Unique name for the plugin
     * @param {string} type - 'before', 'around', 'after'
     * @param {Function} handler - The function to execute
     * @param {number} sortOrder - Order of execution
     */
    addPlugin(target, name, type, handler, sortOrder = 10) {
        if (!this.plugins[target]) {
            this.plugins[target] = { before: [], around: [], after: [] };
        }
        if (!['before', 'around', 'after'].includes(type)) {
            throw new Error(`Invalid plugin type: ${type}`);
        }
        this.plugins[target][type].push({ name, handler, sortOrder });
        this.plugins[target][type].sort((a, b) => a.sortOrder - b.sortOrder);
    }

    /**
     * Execute the intercepted method chain synchronously
     * @param {string} target - The target method name
     * @param {Function} originalMethod - The original function
     * @param {Object} context - The 'this' context
     * @param {Array} args - Arguments passed to the function
     */
    executeSync(target, originalMethod, context, ...args) {
        const plugins = this.plugins[target] || { before: [], around: [], after: [] };

        // Execute 'before' plugins
        for (const plugin of plugins.before) {
            const result = plugin.handler.apply(context, args);
            if (Array.isArray(result)) {
                args = result;
            }
        }

        // Execute 'around' plugins
        let methodToExecute = (...currentArgs) => {
            return originalMethod.apply(context, currentArgs);
        };

        if (plugins.around.length > 0) {
            const aroundPlugins = [...plugins.around].reverse();
            for (const plugin of aroundPlugins) {
                const next = methodToExecute;
                methodToExecute = (...currentArgs) => {
                    return plugin.handler.apply(context, [next, ...currentArgs]);
                };
            }
        }

        let result = methodToExecute(...args);

        // Execute 'after' plugins
        for (const plugin of plugins.after) {
            result = plugin.handler.apply(context, [result, ...args]);
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
        const plugins = this.plugins[target] || { before: [], around: [], after: [] };

        // Execute 'before' plugins
        // Before plugins can modify args by returning an array
        for (const plugin of plugins.before) {
            const result = await plugin.handler.apply(context, args);
            if (Array.isArray(result)) {
                args = result;
            }
        }

        // Execute 'around' plugins
        // Around plugins receive (proceed, ...args)
        let methodToExecute = async (...currentArgs) => {
            return await originalMethod.apply(context, currentArgs);
        };

        // Wrap around plugins: first registered is outer-most
        if (plugins.around.length > 0) {
            const aroundPlugins = [...plugins.around].reverse();
            for (const plugin of aroundPlugins) {
                const next = methodToExecute;
                methodToExecute = async (...currentArgs) => {
                    return await plugin.handler.apply(context, [next, ...currentArgs]);
                };
            }
        }

        let result = await methodToExecute(...args);

        // Execute 'after' plugins
        // After plugins receive (result, ...args) and must return result
        for (const plugin of plugins.after) {
            result = await plugin.handler.apply(context, [result, ...args]);
        }

        return result;
    }

    /**
     * Create a proxy to intercept method calls on an object
     * @param {Object} target - The target object (e.g. module exports)
     * @param {string} namespace - Namespace for plugins
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

export default new PluginManager();
