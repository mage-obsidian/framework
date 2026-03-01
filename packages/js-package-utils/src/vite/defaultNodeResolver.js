export default {
    name: 'default-node-resolver',
    resolveId: {
        order: 'post',
        handler(id) {
            try {
                const resolvedPath = import.meta.resolve(id);
                if (resolvedPath) {
                    return resolvedPath.replace('file://', '');
                }
            } catch (err) {
            }
            return null;
        }
    }
};
