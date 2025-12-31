import generateInterceptorsService from './generateInterceptors.js';

export default function interceptorsPlugin(options = {}) {
    const { themeName } = options;
    let interceptorsMap = new Map(); // path -> interceptorData

    return {
        name: 'mage-obsidian:interceptors',
        enforce: 'pre',

        async buildStart() {
            if (!themeName) {
                console.warn('[mage-obsidian:interceptors] themeName option is missing. Interceptors will not be generated.');
                return;
            }
            
            try {
                const interceptors = await generateInterceptorsService.generateInterceptors(themeName);
                
                // Create a map for fast lookup by file path
                for (const key in interceptors) {
                    const data = interceptors[key];
                    if (data.targetPath) {
                        interceptorsMap.set(data.targetPath, data);
                    }
                }
            } catch (error) {
                console.error('[mage-obsidian:interceptors] Failed to generate interceptors:', error);
            }
        },

        async resolveId(source, importer) {
            // Skip if we haven't loaded interceptors or if it's a virtual module
            if (interceptorsMap.size === 0 || source.startsWith('\0')) return null;

            // Try to resolve the import to a full path
            const resolution = await this.resolve(source, importer, { skipSelf: true });
            
            if (!resolution || !resolution.id) return null;
            
            // Clean up the ID (remove query params)
            const resolvedId = resolution.id.split('?')[0];

            if (interceptorsMap.has(resolvedId)) {
                const virtualId = `\0interceptor:${resolvedId}`;
                
                // Check if we are inside the interceptor trying to import the original
                if (importer === virtualId) {
                    return null; // Allow original import
                }

                return virtualId;
            }

            return null;
        },

        load(id) {
            if (id.startsWith('\0interceptor:')) {
                const originalPath = id.slice('\0interceptor:'.length);
                const data = interceptorsMap.get(originalPath);
                
                if (data) {
                    return data.source;
                }
            }
            return null;
        }
    };
}
