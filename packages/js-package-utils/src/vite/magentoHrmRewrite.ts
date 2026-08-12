import moduleResolver from "../core/moduleResolver.ts";

export default () => {
    return {
        name: "handle-magento-routes-middleware",
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const url = req.url;

                // Read per request, not at configureServer time: the middleware
                // is registered once for the life of the dev server, and the
                // getter returns a new object whenever the precompiled map is
                // rewritten. Capturing it here would pin the server to the set
                // of components that existed at boot.
                const components = moduleResolver.getAllJsVueFilesWithInheritanceCached();
                const matchedKey = Object.keys(components).find((key) => url.includes(key));

                if (matchedKey) {
                    const filePath = components[matchedKey];
                    let suffix;
                    if (matchedKey === "lib/vue") {
                        suffix = "/";
                    } else if (matchedKey.startsWith("lib/")) {
                        suffix = "/@fs";
                        const fileExtension = filePath.split(".").pop();
                        let mimeType = "application/node";
                        if (
                            fileExtension === "cjs" ||
                            fileExtension === "mjs" ||
                            fileExtension === "js"
                        )
                            mimeType = "application/javascript";
                        if (fileExtension === "css") mimeType = "text/css";
                        if (fileExtension === "json") mimeType = "application/json";
                        if (fileExtension === "html") mimeType = "text/html";

                        res.setHeader("Content-Type", mimeType);
                    } else {
                        suffix = "/@fs";
                    }
                    req.url = `${suffix}${filePath}`;
                    next();
                } else {
                    next();
                }
            });
        },
    };
};
