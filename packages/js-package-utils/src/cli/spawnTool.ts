import path from "path";

/**
 * The exit code a shell returns when the command it was asked to run does not
 * exist. It is not a failure of the theme's sources, so it must not be reported
 * as one.
 */
export const COMMAND_NOT_FOUND = 127;

/**
 * The environment a spawned tool runs in. `vite` and `vue-tsc` are dependencies
 * of the harness rather than global installs, so the package manager's script
 * runner is the only thing that normally puts them on PATH. Prepending the
 * harness's own `.bin` makes the command work whichever way the CLI was
 * invoked.
 */
export const withLocalBin = (env: NodeJS.ProcessEnv, cwd: string): NodeJS.ProcessEnv => ({
    ...env,
    PATH: [path.resolve(cwd, "node_modules", ".bin"), env.PATH]
        .filter(Boolean)
        .join(path.delimiter),
});

export const missingCommand = (command: string): string =>
    `could not run \`${command}\`: it is not installed or not on PATH (exit ${COMMAND_NOT_FOUND})`;
