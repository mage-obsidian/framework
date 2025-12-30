import path from "path";
import { pathToFileURL, fileURLToPath } from "url";
import themeResolver from './themeResolverSync.js';
import moduleResolver from './moduleResolver.js';
import pluginManager from './pluginManager.js';

const interceptorsRegisteredByTheme = new Map();
const generatedInterceptorsCache = new Map();

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
    
    // Map<Target, Map<PluginName, PluginConfig>>
    const interceptorsMap = new Map();

    for (const [moduleName, moduleConfig] of Object.entries(modulesConfig)) {
        if (!moduleConfig.interceptors || !Array.isArray(moduleConfig.interceptors)) {
            continue;
        }
        for (const c of moduleConfig.interceptors) {
            const { name, target } = c;
            if (!name || !target) continue;

            if (!interceptorsMap.has(target)) {
                interceptorsMap.set(target, new Map());
            }

            const targetPlugins = interceptorsMap.get(target);
            
            if (targetPlugins.has(name)) {
                // Merge existing plugin config with new config (allows overriding sortOrder, active, etc.)
                const existing = targetPlugins.get(name);
                targetPlugins.set(name, { ...existing, ...c });
            } else {
                targetPlugins.set(name, { ...c, module: moduleName });
            }
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
    const modulesConfig = await moduleResolver.getModuleConfigByThemeConfig(themeName, await themeResolver.getThemeConfig(themeName));
    
    // Get all files map from cache
    let allFilesMap = {};
    try {
        allFilesMap = moduleResolver.getAllJsVueFilesWithInheritanceCached(themeName);
    } catch (e) {
        console.warn(`Cache not found for theme ${themeName}, falling back to async generation.`);
        allFilesMap = await moduleResolver.getAllJsVueFilesWithInheritance(themeName);
    }

    const interceptors = {};

    for (const [targetIdentifier, plugins] of Object.entries(interceptorsConfig)) {
        // 1. Resolve Target Path
        const targetPath = resolvePathFromMap(targetIdentifier, allFilesMap);
        if (!targetPath) {
            console.warn(`Target module not found for identifier: ${targetIdentifier}`);
            continue;
        }

        // 2. Load Target Module to inspect exports
        let targetModule;
        try {
            targetModule = await import(pathToFileURL(targetPath).href);
        } catch (e) {
            console.error(`Failed to import target module ${targetIdentifier}:`, e.message);
            continue;
        }

        const targetExports = Object.keys(targetModule);
        const methodsToIntercept = new Set();

        // 3. Validate and Register Plugins
        const validPlugins = [];
        for (const pluginConfig of plugins) {
            const pluginPath = resolvePathFromMap(pluginConfig.plugin, allFilesMap);
            if (!pluginPath) {
                console.warn(`Plugin module not found: ${pluginConfig.plugin}`);
                continue;
            }

            let pluginModule;
            try {
                pluginModule = await import(pathToFileURL(pluginPath).href);
            } catch (e) {
                console.error(`Failed to import plugin module ${pluginConfig.plugin}:`, e.message);
                continue;
            }

            const pluginMethods = [];
            for (const pluginExport of Object.keys(pluginModule)) {
                let type, targetMethod;
                
                if (pluginExport.startsWith('before')) {
                    type = 'before';
                    targetMethod = pluginExport.substring(6);
                } else if (pluginExport.startsWith('around')) {
                    type = 'around';
                    targetMethod = pluginExport.substring(6);
                } else if (pluginExport.startsWith('after')) {
                    type = 'after';
                    targetMethod = pluginExport.substring(5);
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
                        throw new Error(`Plugin ${pluginConfig.name} (${pluginConfig.plugin}) exports '${pluginExport}' but target ${targetIdentifier} does not export '${targetMethod}'`);
                     }
                }

                // Register the plugin with PluginManager (Runtime)
                const methodKey = `${targetIdentifier}::${targetMethod}`;
                pluginManager.addPlugin(
                    methodKey,
                    pluginConfig.name,
                    type,
                    pluginModule[pluginExport],
                    pluginConfig.sortOrder
                );
                
                methodsToIntercept.add(targetMethod);
                pluginMethods.push({
                    exportName: pluginExport,
                    type,
                    targetMethod,
                    sortOrder: pluginConfig.sortOrder
                });
            }

            if (pluginMethods.length > 0) {
                validPlugins.push({
                    ...pluginConfig,
                    path: pluginPath,
                    methods: pluginMethods
                });
            }
        }

        // 4. Create Interceptor Proxy & Source Code
        if (methodsToIntercept.size > 0) {
            const wrapper = { ...targetModule };
            const proxy = pluginManager.intercept(wrapper, targetIdentifier, true);
            
            const source = generateInterceptorCode(targetIdentifier, targetPath, validPlugins, targetExports);

            interceptors[targetIdentifier] = {
                proxy,
                targetPath,
                targetModule,
                plugins: validPlugins,
                source
            };
        }
    }

    generatedInterceptorsCache.set(themeName, interceptors);
    return interceptors;
}

function generateInterceptorCode(targetIdentifier, targetPath, plugins, targetExports) {
    const imports = [];
    const registrations = [];
    
    // Import PluginManager (Assuming it's available via alias or relative path in the build environment)
    // For Vite, we might need to adjust this path or use a virtual module ID.
    // Using a relative path from this service file might not work in the generated code context.
    // We'll assume '@mage-obsidian/plugin-manager' or similar alias is set up, 
    // or use the absolute path which Vite handles.
    const pluginManagerPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'pluginManager.js');
    imports.push(`import pluginManager from '/@fs${pluginManagerPath}';`);

    // Import Original Module
    imports.push(`import * as originalModule from '/@fs${targetPath}';`);

    // Import Plugins
    plugins.forEach((plugin, index) => {
        const pluginVar = `plugin_${index}`;
        imports.push(`import * as ${pluginVar} from '/@fs${plugin.path}';`);
        
        plugin.methods.forEach(method => {
            const methodKey = `${targetIdentifier}::${method.targetMethod}`;
            registrations.push(`pluginManager.addPlugin('${methodKey}', '${plugin.name}', '${method.type}', ${pluginVar}.${method.exportName}, ${method.sortOrder});`);
        });
    });

    // Create Interceptor
    const interceptorCode = `
const targetWrapper = { ...originalModule };
const proxy = pluginManager.intercept(targetWrapper, '${targetIdentifier}', true);
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
    generateInterceptors
};