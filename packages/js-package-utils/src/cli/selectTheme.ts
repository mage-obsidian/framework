/**
 * Resolve which theme the dev server should serve.
 *
 * An explicit `--theme` always wins. Otherwise, on an interactive TTY the
 * operator picks from the available themes; non-interactive callers (CI,
 * `setup:*` pipelines) get `null` so the caller can fail loudly instead of
 * silently serving the wrong theme.
 *
 * `pick` is injected (the real caller wires readline-sync) so the resolution is
 * unit-testable without a terminal. It returns the chosen index, or a negative
 * value when the operator cancels.
 */
export function selectThemeForDevServer(
    optionTheme: string | undefined,
    themeNames: string[],
    isInteractive: boolean,
    pick: (themes: string[]) => number,
): string | null {
    if (optionTheme) {
        return optionTheme;
    }

    if (!isInteractive || themeNames.length === 0) {
        return null;
    }

    const index = pick(themeNames);
    return index >= 0 ? themeNames[index] : null;
}
