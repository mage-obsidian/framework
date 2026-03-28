#! /usr/bin/env node
import { Command } from "commander";
import { execSync, spawn } from "child_process";
import os from "os";
import readlineSync from "readline-sync";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import configResolver from "../core/configResolver.js";
import runWithConcurrency from "../utils/runWithConcurrency.js";
import dotenv from "dotenv";
dotenv.config();

const program = new Command();

program
    .option("--theme <theme>", "Specify the active theme")
    .option("--dev-server", "Run the development server for a specific theme");

program.parse(process.argv);

const options = program.opts();
const themesConfig = configResolver.getMagentoConfig().themes;

if (options.devServer && !options.theme) {
    console.error(chalk.red("Error: The --theme option is required when using --dev-server."));
    process.exit(1);
}

const theme = options.theme || "all";

const executeCommand = (command) => {
    try {
        execSync(command, { stdio: "inherit" });
    } catch (error) {
        console.error(chalk.red(`Command failed: ${command}`), error);
        process.exit(1);
    }
};

function tryCreateEnvFile() {
    const defaultEnvVars = {
        VITE_SERVER_HOST: "phpfpm",
        VITE_SERVER_PORT: "5173",
        VITE_SERVER_SECURE: "true",
        VITE_HMR_PATH: "/__vite_ping",
        MAGENTO_HOST: "magento.test",
        VITE_SERVER_ALLOWED_HOSTS: "magento.test,localhost",
    };

    console.log(chalk.blue("Creating `.env` file with default or user-provided values..."));

    const envFilePath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envFilePath)) {
        console.log(chalk.green(".env file already exists."));
        return;
    }

    let envContent = "";
    for (const [key, defaultValue] of Object.entries(defaultEnvVars)) {
        const userInput = readlineSync.question(
            chalk.yellow(`Enter value for ${key} (default: ${defaultValue}): `),
            {
                defaultInput: defaultValue,
            },
        );
        envContent += `${key}=${userInput || defaultValue}\n`;
    }

    fs.writeFileSync(envFilePath, envContent);
    console.log(chalk.green(".env file created successfully."));
}

function validateEnv() {
    const requiredEnvVars = [
        "VITE_SERVER_HOST",
        "VITE_SERVER_PORT",
        "VITE_SERVER_SECURE",
        "VITE_HMR_PATH",
        "MAGENTO_HOST",
        "VITE_SERVER_ALLOWED_HOSTS",
    ];
    let missingEnvVars = [];
    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            missingEnvVars.push(envVar);
        }
    }
    if (missingEnvVars.length > 0) {
        console.error(
            chalk.red(`Missing required environment variables: ${missingEnvVars.join(", ")}`),
        );
        tryCreateEnvFile();
        console.log(chalk.green("Please restart the script after setting up the .env file."));
        process.exit(1);
    }
}

/**
 * Build a single theme in its own child process. Each child gets its own
 * CURRENT_THEME env so several themes can build concurrently without sharing
 * in-process state. Output is buffered and printed as a labeled block on exit
 * to keep parallel logs readable. Never rejects — failures surface via the
 * returned exit code so sibling builds aren't aborted.
 *
 * @param {string} themeName
 * @returns {Promise<{ themeName: string, code: number }>}
 */
const spawnBuild = (themeName) =>
    new Promise((resolve) => {
        const child = spawn("vite build", {
            shell: true,
            env: { ...process.env, CURRENT_THEME: themeName },
        });
        const chunks = [];
        child.stdout.on("data", (data) => chunks.push(data));
        child.stderr.on("data", (data) => chunks.push(data));
        const finish = (code) => {
            console.log(chalk.cyan(`\n=== ${themeName} ===`));
            process.stdout.write(Buffer.concat(chunks).toString());
            if (code === 0) {
                console.log(chalk.green(`✓ ${themeName} built`));
            } else {
                console.error(chalk.red(`✗ ${themeName} failed (exit ${code})`));
            }
            resolve({ themeName, code });
        };
        child.on("close", finish);
        child.on("error", (error) => {
            chunks.push(Buffer.from(String(error?.stack ?? error)));
            finish(1);
        });
    });

const buildThemes = async (themeNames) => {
    const cores = os.cpus()?.length ?? 2;
    const limit = Math.max(1, Math.min(themeNames.length, cores - 1));
    console.log(
        chalk.cyan(
            `Building ${themeNames.length} theme(s) (concurrency ${limit}): ${themeNames.join(", ")}`,
        ),
    );

    const results = await runWithConcurrency(
        themeNames,
        (themeName) => spawnBuild(themeName),
        limit,
    );

    const failed = results.filter((result) => result.code !== 0);
    if (failed.length > 0) {
        console.error(
            chalk.red(`Build failed for: ${failed.map((result) => result.themeName).join(", ")}`),
        );
        process.exit(1);
    }
};

const runDevServer = (themeName) => {
    console.log(chalk.cyan(`Starting development server for theme: ${themeName}`));
    try {
        const theme = themesConfig[themeName];
        if (!theme) {
            console.error(chalk.red(`Theme "${themeName}" does not exist.`));
            process.exit(1);
        }

        process.env.CURRENT_THEME = themeName;
        executeCommand("vite");
    } catch (error) {
        console.error(
            chalk.red(`Failed to start development server for theme "${themeName}":`),
            error,
        );
    }
};

validateEnv();

if (options.devServer) {
    runDevServer(theme);
} else {
    let themeNames;
    if (theme === "all") {
        themeNames = Object.keys(themesConfig);
    } else if (themesConfig[theme]) {
        themeNames = [theme];
    } else {
        console.error(chalk.red(`Theme "${theme}" does not exist.`));
        process.exit(1);
    }
    await buildThemes(themeNames);
}
