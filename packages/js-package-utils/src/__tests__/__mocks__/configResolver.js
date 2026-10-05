import path from "path";
import fs from "fs";
import { vi } from 'vitest';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const createMockConfigResolver = (scenario) => {
    const configPath = path.resolve(__dirname, `../magento_scenarios/app/etc/mage_obsidian_frontend_modules_${scenario}.json`);
    const magentoConfigJson = fs.readFileSync(configPath, 'utf-8');
    const mockMagentoConfig = JSON.parse(magentoConfigJson);
    for (const key in mockMagentoConfig.modules) {
        let module = mockMagentoConfig.modules[key];
        module.src = path.resolve(__dirname, '..', module.src);
    }
    for (const key in mockMagentoConfig.themes) {
        let theme = mockMagentoConfig.themes[key];
        theme.src = path.resolve(__dirname, '..', theme.src);
    }
    return {
        default: {
            getMagentoConfig: vi.fn(() => mockMagentoConfig),
            getContractHash: vi.fn(() => JSON.stringify({
                modules: mockMagentoConfig.modules,
                themes: mockMagentoConfig.themes,
                allModules: mockMagentoConfig.allModules
            })),
            getModulesConfigArray: vi.fn(() => Object.entries(mockMagentoConfig.modules)),
            getThemesConfigArray: vi.fn(() => Object.entries(mockMagentoConfig.themes)),
            getAllMagentoModulesEnabled: vi.fn(() => mockMagentoConfig.allModules),
            isDev: vi.fn(() => mockMagentoConfig.mode === 'development'),
            getOutputDirFromTheme: vi.fn((themePath) => `${themePath}/output`),
            getThemeDefinition: vi.fn((themeName) => mockMagentoConfig.themes[themeName]),
            getModuleDefinition: vi.fn((moduleName) => mockMagentoConfig.modules[moduleName]),
        }
    }
};

export default createMockConfigResolver;
