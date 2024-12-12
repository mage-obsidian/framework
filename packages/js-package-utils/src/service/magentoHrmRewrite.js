import moduleResolver from "./moduleResolver.js";

export default () => {
    const components = moduleResolver.getAllJsVueFilesWithInheritanceCached();
    return {
        name: 'handle-magento-routes-middleware',
            configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const url = req.url;

                const matchedKey = Object.keys(components).find((key) => url.includes(key));

                if (matchedKey) {
                    const filePath = components[matchedKey];
                    let suffix = '/@fs';
                    if (matchedKey === 'lib/vue') {
                        suffix = '/';
                    } else if (matchedKey.startsWith('lib/')) {
                        suffix = '/@fs';
                        const fileExtension = filePath.split('.').pop();
                        let mimeType = 'application/node';
                        if (
                            fileExtension === 'cjs' ||
                            fileExtension === 'mjs' ||
                            fileExtension === 'js'
                        ) mimeType = 'application/javascript';
                        if (fileExtension === 'css') mimeType = 'text/css';
                        if (fileExtension === 'json') mimeType = 'application/json';
                        if (fileExtension === 'html') mimeType = 'text/html';

                        res.setHeader('Content-Type', mimeType);
                    } else {
                        suffix = '/@fs';
                    }
                    req.url = `${suffix}${filePath}`;
                    next();
                } else {
                    next();
                }
            });
        },
    }
}
