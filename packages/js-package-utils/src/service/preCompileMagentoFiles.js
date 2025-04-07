import { precompileCss, precompileJs } from "./preCompileFiles.js";
import {execSync} from "child_process";

let isPrecompiled = false;
export default async (themeName) => {
    if (isPrecompiled) {
        return;
    }
    console.log('Cleaning .precompiled folder');
    execSync('rm -rf .precompiled/*', { stdio: 'inherit' });
    execSync(`mkdir -p .precompiled/${themeName}`, { stdio: 'inherit' });
    console.log('Generating precompiled files');
    await precompileJs(themeName);
    await precompileCss(themeName);
    isPrecompiled = true;
}
