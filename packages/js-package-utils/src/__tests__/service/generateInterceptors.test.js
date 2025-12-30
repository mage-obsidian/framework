
import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../fixtures/interceptors');
const targetModulePath = path.join(fixturesDir, 'targetModule.js');
const pluginModulePath = path.join(fixturesDir, 'pluginModule.js');

describe('generateInterceptors', () => {
    let generateInterceptorsService;
    let themeResolverMock;
    let moduleResolverMock;
    let pluginManager;

    beforeEach(async () => {
        jest.resetModules();

        themeResolverMock = {
            getThemeConfig: jest.fn(),
        };

        moduleResolverMock = {
            getModuleConfigByThemeConfig: jest.fn(),
            getAllJsVueFilesWithInheritanceCached: jest.fn(),
            getAllJsVueFilesWithInheritance: jest.fn(),
        };

        jest.unstable_mockModule('../../service/themeResolverSync.js', () => ({
            default: themeResolverMock
        }));

        jest.unstable_mockModule('../../service/moduleResolver.js', () => ({
            default: moduleResolverMock
        }));

        // Import real pluginManager to reset state
        pluginManager = (await import('../../service/pluginManager.js')).default;
        pluginManager.plugins = {};

        generateInterceptorsService = (await import('../../service/generateInterceptors.js')).default;
    });

    test('should generate interceptors correctly', async () => {
        const themeName = 'Vendor/theme-test';

        themeResolverMock.getThemeConfig.mockReturnValue({
            src: '/path/to/theme'
        });

        moduleResolverMock.getModuleConfigByThemeConfig.mockResolvedValue({
            'Vendor_TargetModule': {
                src: '/path/to/vendor/target',
                interceptors: [
                    {
                        name: 'TestPlugin',
                        target: 'Vendor_TargetModule::js/target.js',
                        plugin: 'Vendor_PluginModule::js/plugin.js',
                        sortOrder: 10,
                        active: true
                    }
                ]
            }
        });

        const allFilesMap = {
            'Vendor_TargetModule/js/target': targetModulePath,
            'Vendor_PluginModule/js/plugin': pluginModulePath
        };

        moduleResolverMock.getAllJsVueFilesWithInheritanceCached.mockReturnValue(allFilesMap);

        const result = await generateInterceptorsService.generateInterceptors(themeName);

        const targetIdentifier = 'Vendor_TargetModule::js/target.js';
        // Use bracket access check to avoid Jest treating '.' as nested property
        expect(result[targetIdentifier]).toBeDefined();

        const interceptorData = result[targetIdentifier];
        expect(interceptorData).toHaveProperty('proxy');
        expect(interceptorData).toHaveProperty('source');
        expect(interceptorData).toHaveProperty('targetPath', targetModulePath);
        expect(interceptorData.plugins).toHaveLength(1);
        expect(interceptorData.plugins[0].name).toBe('TestPlugin');

        // Verify Source Code Generation
        const source = interceptorData.source;
        expect(source).toContain(`import * as originalModule from '/@fs${targetModulePath}';`);
        expect(source).toContain(`import * as plugin_0 from '/@fs${pluginModulePath}';`);
        expect(source).toContain(`pluginManager.addPlugin('${targetIdentifier}::targetFunction', 'TestPlugin', 'before', plugin_0.beforeTargetFunction, 10);`);
        expect(source).toContain(`export const targetFunction = proxy.targetFunction;`);

        // Verify Proxy Behavior
        const proxy = interceptorData.proxy;
        const resultFunc = await proxy.targetFunction('test');
        expect(resultFunc).toBe('Original: Modified: test');

        const resultAnother = await proxy.anotherFunction();
        expect(resultAnother).toBe('Another - Modified');
    });

    test('should handle missing target module gracefully', async () => {
        themeResolverMock.getThemeConfig.mockReturnValue({});
        moduleResolverMock.getModuleConfigByThemeConfig.mockResolvedValue({
            'Vendor_TargetModule': { interceptors: [] }
        });
        moduleResolverMock.getAllJsVueFilesWithInheritanceCached.mockReturnValue({});

        const result = await generateInterceptorsService.generateInterceptors('Vendor/theme-missing');
        expect(result).toEqual({});
    });

    test('should throw error if plugin targets non-existent method', async () => {
        const themeName = 'Vendor/theme-test';
        themeResolverMock.getThemeConfig.mockReturnValue({});
        moduleResolverMock.getModuleConfigByThemeConfig.mockResolvedValue({
            'Vendor_TargetModule': {
                src: '/path/to/vendor/target',
                interceptors: [
                    {
                        name: 'BadPlugin',
                        target: 'Vendor_TargetModule::js/target.js',
                        plugin: 'Vendor_PluginModule::js/plugin.js',
                        sortOrder: 10
                    }
                ]
            }
        });

        const emptyTargetModulePath = path.join(fixturesDir, 'emptyTarget.js');
        
        const allFilesMap = {
            'Vendor_TargetModule/js/target': emptyTargetModulePath,
            'Vendor_PluginModule/js/plugin': pluginModulePath
        };
        
        moduleResolverMock.getAllJsVueFilesWithInheritanceCached.mockReturnValue(allFilesMap);

        // We expect the promise to reject because generateInterceptors throws on invalid target method
        await expect(generateInterceptorsService.generateInterceptors(themeName))
            .rejects
            .toThrow(/does not export/);
    });
});
