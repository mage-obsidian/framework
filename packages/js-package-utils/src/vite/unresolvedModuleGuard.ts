import moduleResolver from "../core/moduleResolver.ts";

// The part before `::` must look like a Magento module (Vendor_Module) or the
// special `Theme` namespace. This keeps the guard from firing on unrelated ids
// (virtual modules, already-resolved absolute paths) that happen to contain `::`.
const NAMESPACE_PATTERN = /^(Theme|[A-Z][A-Za-z0-9_]*)$/;

function distance(a: string, b: string): number {
    const rows = a.length + 1;
    const cols = b.length + 1;
    const dp = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
    for (let i = 0; i < rows; i++) dp[i][0] = i;
    for (let j = 0; j < cols; j++) dp[0][j] = j;
    for (let i = 1; i < rows; i++) {
        for (let j = 1; j < cols; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
    }
    return dp[a.length][b.length];
}

function suggest(namespace: string, target: string): string[] {
    let keys: string[];
    try {
        keys = Object.keys(moduleResolver.getAllJsVueFilesWithInheritanceCached());
    } catch {
        // No precompiled cache yet — nothing to suggest from.
        return [];
    }
    const prefix = `${namespace}/`;
    return keys
        .filter((key) => key.startsWith(prefix))
        .map((key) => `${namespace}::${key.slice(prefix.length)}`)
        .map((candidate) => [candidate, distance(candidate, target)] as const)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 3)
        .map(([candidate]) => candidate);
}

function buildMessage(id: string, namespace: string, rest: string, importer?: string): string {
    const from = importer ? `\n  imported by: ${importer}` : "";

    let hint: string;
    if (rest.startsWith("assets/")) {
        hint =
            `\n  Asset not found. Expected a theme override at` +
            ` <theme>/${namespace}/web/${rest} or the module at` +
            ` <module>/view/frontend/web/${rest}.`;
    } else {
        const suggestions = suggest(namespace, id);
        hint = suggestions.length
            ? `\n  Did you mean:\n${suggestions.map((s) => `    - ${s}`).join("\n")}`
            : `\n  Nothing is registered under "${namespace}". Is the module/theme enabled` +
              ` and compatible, and the contract regenerated` +
              ` (bin/magento mage-obsidian:frontend:config --generate)?`;
    }

    return `[mage-obsidian] Unresolved import "${id}".${from}${hint}`;
}

/**
 * Fail-loud guard for the framework's `Vendor_Module::` import notation. It runs
 * last in the resolver chain (`order: "post"`), so a `::` specifier only reaches
 * it when none of the earlier resolvers (component, asset, node) could resolve
 * it — i.e. a typo or a missing file. Without this, Rollup externalizes the
 * unknown specifier silently and the import breaks at runtime with no clear
 * cause; here it becomes a build/dev error naming the specifier, the importer,
 * and the closest valid alternatives.
 */
export default function unresolvedModuleGuard() {
    return {
        name: "unresolved-module-guard",
        resolveId: {
            order: "post",
            handler(id: string, importer?: string) {
                if (!id || id[0] === "\0") return;
                const separator = id.indexOf("::");
                if (separator === -1) return;
                const namespace = id.slice(0, separator);
                if (!NAMESPACE_PATTERN.test(namespace)) return;

                throw new Error(buildMessage(id, namespace, id.slice(separator + 2), importer));
            },
        },
    };
}
