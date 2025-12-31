import path from "path";
import { pathToFileURL, fileURLToPath } from "url";
import themeResolver from 'mage-obsidian/service/themeResolverSync.js';
import moduleResolver from 'mage-obsidian/service/moduleResolver.js';
import interceptorManager from 'mage-obsidian/service/interceptorManager.js';
import configResolver from "mage-obsidian/service/configResolver.js";

const interceptorsRegisteredByTheme = new Map();
const generatedInterceptorsCache = new Map();
export const KEY_INTERCEPTED = 'originalIntercepted';

/**
 * Resolves the absolute path of a file using the cached file map
 * @param {string} identifier
 * @param {Object} fileMap
 * @returns {string|null}
 */
function resolvePathFromMap(identifier, fileMap) {
    const [moduleName, relativePath] = identifier.split('::');
    if (!moduleName || !relativePath) return null;

    const parsed = path.parse(relativePath);
    const keyPath = path.join(parsed.dir, parsed.name);
    const key = `${moduleName}/${keyPath}`;

    return fileMap[key] || null;
}

async function registerInterceptors(themeName) {
    if (interceptorsRegisteredByTheme.has(themeName)) {
        return interceptorsRegisteredByTheme.get(themeName);
    }

    const themeConfig = await themeResolver.getThemeConfig(themeName);
    const modulesConfig = await moduleResolver.getModuleConfigByThemeConfig(themeName, themeConfig);
    if (!modulesConfig || modulesConfig.interceptors === undefined) {
        interceptorsRegisteredByTheme.set(themeName, {});
        return {};
    }
    // Map<Target, Map<PluginName, PluginConfig>>
    const interceptorsMap = new Map();
    for (const [interceptorName, interceptorDefinition] of Object.entries( modulesConfig.interceptors)) {
        const { target } = interceptorDefinition;
        if (!interceptorName || !target) continue;

        if (!interceptorsMap.has(target)) {
            interceptorsMap.set(target, new Map());
        }

        const targetPlugins = interceptorsMap.get(target);

        if (targetPlugins.has(interceptorName)) {
            // Merge existing plugin config with new config (allows overriding sortOrder, active, etc.)
            const existing = targetPlugins.get(interceptorName);
            targetPlugins.set(interceptorName, { ...existing, ...interceptorDefinition });
        } else {
            targetPlugins.set(interceptorName, { ...interceptorDefinition });
        }
    }

    // Convert Map to structured object and sort plugins
    const result = {};
    for (const [target, pluginsMap] of interceptorsMap) {
        const plugins = Array.from(pluginsMap.values())
            .filter(p => p.active !== false) // Filter out inactive plugins
            .sort((a, b) => (a.sortOrder || 10) - (b.sortOrder || 10));

        if (plugins.length > 0) {
            result[target] = plugins;
        }
    }

    interceptorsRegisteredByTheme.set(themeName, result);
    return result;
}

async function generateInterceptors(themeName) {
    if (generatedInterceptorsCache.has(themeName)) {
        return generatedInterceptorsCache.get(themeName);
    }

    const interceptorsConfig = await registerInterceptors(themeName);

    // Get all files map from cache
    let allFilesMap = {};
    try {
        allFilesMap = moduleResolver.getAllJsVueFilesWithInheritanceCached(themeName);
    } catch (e) {
        console.warn(`Cache not found for theme ${themeName}, falling back to async generation.`);
        allFilesMap = await moduleResolver.getAllJsVueFilesWithInheritance(themeName);
    }

    const interceptors = {};

    for (const [target, plugins] of Object.entries(interceptorsConfig)) {
        // 1. Resolve Target Path
        const targetPath = resolvePathFromMap(target, allFilesMap);
        if (!targetPath) {
            console.warn(`Target module not found for identifier: ${target}`);
            continue;
        }

        let targetModule;
        try {
            targetModule = await import(pathToFileURL(targetPath).href);
        } catch (e) {
            console.error(`Failed to import target module ${target}:`, e.message);
            continue;
        }

        const targetExports = Object.keys(targetModule);
        const methodsToIntercept = new Set();

        // 3. Validate and Register Interceptors
        const validInterceptors = [];
        for (const interceptorConfig of plugins) {
            const interceptorPath = resolvePathFromMap(interceptorConfig.interceptor, allFilesMap);
            if (!interceptorPath) {
                console.warn(`Interceptor module not found: ${interceptorConfig.interceptor}`);
                continue;
            }

            let interceptorModule;
            try {
                interceptorModule = await import(pathToFileURL(interceptorPath).href);
            } catch (e) {
                console.error(`Failed to import interceptor module ${interceptorConfig.interceptor}:`, e.message);
                continue;
            }

            const interceptorMethods = [];
            for (const interceptorExport of Object.keys(interceptorModule)) {
                let type, targetMethod;

                if (interceptorExport.startsWith('before')) {
                    type = 'before';
                    targetMethod = interceptorExport.substring(6);
                } else if (interceptorExport.startsWith('around')) {
                    type = 'around';
                    targetMethod = interceptorExport.substring(6);
                } else if (interceptorExport.startsWith('after')) {
                    type = 'after';
                    targetMethod = interceptorExport.substring(5);
                } else {
                    continue;
                }

                // Check if target method exists in target module
                if (!targetExports.includes(targetMethod) && targetMethod !== 'default') {
                    const lowerFirst = targetMethod.charAt(0).toLowerCase() + targetMethod.slice(1);
                    if (targetExports.includes(lowerFirst)) {
                        targetMethod = lowerFirst;
                    } else {
                        // Skip invalid methods but don't crash the whole process?
                        // User requested error if not found.
                        throw new Error(`Interceptor ${interceptorConfig.name} (${interceptorConfig.interceptor}) exports '${interceptorExport}' but target ${target} does not export '${targetMethod}'`);
                    }
                }

                if (typeof targetModule[targetMethod] !== 'function') {
                    console.warn(`Interceptor ${interceptorConfig.name} (${interceptorConfig.interceptor}) exports '${interceptorExport}' but target ${target} export '${targetMethod}' is not a function.`);
                    continue;
                }

                const methodKey = `${target}::${targetMethod}`;
                interceptorManager.addInterceptor(
                    methodKey,
                    interceptorConfig.name,
                    type,
                    interceptorModule[interceptorExport],
                    interceptorConfig.sortOrder
                );

                methodsToIntercept.add(targetMethod);
                interceptorMethods.push({
                    exportName: interceptorExport,
                    type,
                    targetMethod,
                    sortOrder: interceptorConfig.sortOrder
                });
            }

            if (interceptorMethods.length > 0) {
                validInterceptors.push({
                    ...interceptorConfig,
                    path: interceptorPath,
                    methods: interceptorMethods
                });
            }
        }

        // 4. Create Interceptor Proxy & Source Code
        if (methodsToIntercept.size > 0) {
            const wrapper = { ...targetModule };
            const proxy = interceptorManager.intercept(wrapper, target, true);

            const source = generateInterceptorCode(target, targetPath, validInterceptors, targetExports);

            interceptors[target] = {
                proxy,
                targetPath,
                targetModule,
                interceptors: validInterceptors,
                source
            };
        }
    }

    generatedInterceptorsCache.set(themeName, interceptors);
    return interceptors;
}

function generateInterceptorCode(target, targetPath, interceptors, targetExports) {
    const imports = [];
    const registrations = [];

    // Import PluginManager (Assuming it's available via alias or relative path in the build environment)
    // For Vite, we might need to adjust this path or use a virtual module ID.
    // Using a relative path from this service file might not work in the generated code context.
    // We'll assume '@mage-obsidian/plugin-manager' or similar alias is set up,
    // or use the absolute path which Vite handles.
    const resolvedInterceptorManagerPath = configResolver.resolveLibRealPath('mage-obsidian/service/interceptorManager');
    imports.push(`import interceptorManager from "${resolvedInterceptorManagerPath}";`);

    // Import Original Module
    imports.push(`import * as originalModule from '/@fs${targetPath}?${KEY_INTERCEPTED}';`);

    // Import Interceptors
    interceptors.forEach((interceptor, index) => {
        const interceptorVar = `interceptor_${index}`;
        imports.push(`import * as ${interceptorVar} from '/@fs${interceptor.path}';`);

        interceptor.methods.forEach(method => {
            const methodKey = `${target}::${method.targetMethod}`;
            registrations.push(`interceptorManager.addInterceptor('${methodKey}', '${interceptor.name}', '${method.type}', ${interceptorVar}.${method.exportName}, ${method.sortOrder});`);
        });
    });

    // Create Interceptor
    const interceptorCode = `
const targetWrapper = { ...originalModule };
const proxy = interceptorManager.intercept(targetWrapper, '${target}', true);
`;

    // Exports
    const exportsCode = targetExports.map(exp => {
        if (exp === 'default') {
            return `export default proxy.default;`;
        }
        return `export const ${exp} = proxy.${exp};`;
    }).join('\n');

    return `
${imports.join('\n')}

${registrations.join('\n')}

${interceptorCode}

${exportsCode}
`;
}

export default {
    registerInterceptors,
    generateInterceptors,
    KEY_INTERCEPTED
};
