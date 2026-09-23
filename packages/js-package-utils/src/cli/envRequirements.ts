export const DEV_SERVER_REQUIRED_ENV = ["VITE_SERVER_HOST", "VITE_SERVER_PORT"] as const;

export function missingEnvFor(
    devServer: boolean,
    env: Record<string, string | undefined>,
): string[] {
    if (!devServer) {
        return [];
    }
    return DEV_SERVER_REQUIRED_ENV.filter((name) => !env[name]);
}
