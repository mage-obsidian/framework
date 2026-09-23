import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXPECTED_SCHEMA_VERSION } from "../../core/contractValidator.ts";

const ENTRY = fileURLToPath(new URL("../../cli/buildThemes.ts", import.meta.url));
const SERVER_ENV = [
    "VITE_SERVER_HOST",
    "VITE_SERVER_PORT",
    "VITE_SERVER_SECURE",
    "VITE_HMR_PATH",
    "MAGENTO_HOST",
    "VITE_SERVER_ALLOWED_HOSTS",
];

let root;
let viteDir;

beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "mo-build-entry-"));
    viteDir = path.join(root, "vite");
    mkdirSync(viteDir);
    mkdirSync(path.join(root, "app", "etc"), { recursive: true });
    writeFileSync(
        path.join(root, "app", "etc", "mage_obsidian_frontend_modules.json"),
        JSON.stringify({
            schema_version: EXPECTED_SCHEMA_VERSION,
            mode: "production",
            modules: {},
            themes: {},
            allModules: [],
            VUE_COMPONENTS_PATH: "components",
            JS_PATH: "js",
            FOLDERS_TO_WATCH: ["components", "js"],
            ALLOWED_EXTENSIONS: ["js", "vue"],
            MODULE_CSS_EXTEND_FILE: "module.extend.css",
            MODULE_CONFIG_FILE: "module.config.js",
            THEME_CONFIG_FILE: "theme.config.js",
            THEME_CSS_SOURCE_FILE: "theme.source.css",
            THEME_FILES_PATH: "Theme",
            LIB_PATH: "lib",
        }),
    );
});

afterEach(() => {
    rmSync(root, { recursive: true, force: true });
});

function run(args, extraEnv = {}) {
    const env = { ...process.env, MAGE_OBSIDIAN_MAGENTO_ROOT: root };
    for (const key of SERVER_ENV) {
        delete env[key];
    }
    return spawnSync(process.execPath, [ENTRY, ...args], {
        cwd: viteDir,
        env: { ...env, ...extraEnv },
        input: "",
        encoding: "utf8",
        timeout: 60000,
    });
}

describe.skipIf(!process.features.typescript)(
    "mage-obsidian:build-themes without a terminal",
    () => {
        it("reaches the build without asking for dev server settings", () => {
            const result = run(["--theme", "Acme/missing"]);

            expect(result.status).toBe(1);
            expect(result.stderr).toContain('Theme "Acme/missing" does not exist.');
            expect(result.stderr).not.toContain("Missing required environment variables");
        });

        it("reaches the type check without asking for dev server settings", () => {
            const result = run(["--typecheck", "--theme", "Acme/missing"]);

            expect(result.status).toBe(1);
            expect(result.stderr).toContain('Theme "Acme/missing" does not exist.');
            expect(result.stderr).not.toContain("Missing required environment variables");
        });

        it("refuses the dev server without host and port, and never prompts or writes .env", () => {
            const result = run(["--dev-server", "--theme", "Acme/missing"]);

            expect(result.status).toBe(1);
            expect(result.stderr).toContain("VITE_SERVER_HOST");
            expect(result.stdout).not.toContain("Creating `.env` file");
            expect(existsSync(path.join(viteDir, ".env"))).toBe(false);
        });

        it("lets a fully configured dev server through to theme resolution", () => {
            const result = run(["--dev-server", "--theme", "Acme/missing"], {
                VITE_SERVER_HOST: "phpfpm",
                VITE_SERVER_PORT: "5173",
                VITE_SERVER_SECURE: "true",
                VITE_HMR_PATH: "/__vite_ping",
                MAGENTO_HOST: "magento.test",
                VITE_SERVER_ALLOWED_HOSTS: "magento.test",
            });

            expect(result.stderr).not.toContain("Missing required environment variables");
            expect(result.stderr).toContain('Theme "Acme/missing" does not exist.');
        });
    },
);
