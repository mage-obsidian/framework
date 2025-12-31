
import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../fixtures/interceptors');
const targetModulePath = path.join(fixturesDir, 'targetModule.js');
const pluginModulePath = path.join(fixturesDir, 'pluginModule.js');
const targetNonFunctionPath = path.join(fixturesDir, 'targetNonFunction.js');
const pluginForNonFunctionPath = path.join(fixturesDir, 'pluginForNonFunction.js');

describe('generateInterceptors', () => {
    let generateInterceptorsService;
    let themeResolverMock;
    let moduleResolverMock;
    let interceptorManager;

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

        jest.unstable_mockModule('../../service/configResolver.js', () => ({
            default: {
                resolveLibRealPath: jest.fn().mockReturnValue('/mocked/path/to/interceptorManager')
            }
        }));

        // Import real interceptorManager to reset state
        interceptorManager = (await import('../../service/interceptorManager.js')).default;
        interceptorManager.interceptors = {};

        generateInterceptorsService = (await import('../../service/generateInterceptors.js')).default;
    });

    test('should generate interceptors correctly', async () => {
        const themeName = 'Vendor/theme-test';

        themeResolverMock.getThemeConfig.mockReturnValue({
            src: '/path/to/theme'
        });

        moduleResolverMock.getModuleConfigByThemeConfig.mockResolvedValue({
            interceptors: {
                'TestPlugin': {
                    name: 'TestPlugin',
                    target: 'Vendor_TargetModule::js/target.js',
                    interceptor: 'Vendor_PluginModule::js/plugin.js',
                    sortOrder: 10,
                    active: true
                }
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
        expect(interceptorData.interceptors).toHaveLength(1);
        expect(interceptorData.interceptors[0].name).toBe('TestPlugin');

        // Verify Source Code Generation
        const source = interceptorData.source;
        expect(source).toContain(`import * as originalModule from '/@fs${targetModulePath}?originalIntercepted';`);
        expect(source).toContain(`import * as interceptor_0 from '/@fs${pluginModulePath}';`);
        expect(source).toContain(`interceptorManager.addInterceptor('${targetIdentifier}::targetFunction', 'TestPlugin', 'before', interceptor_0.beforeTargetFunction, 10);`);
        expect(source).toContain(`interceptorManager.addInterceptor('${targetIdentifier}::default', 'TestPlugin', 'before', interceptor_0.beforeDefault, 10);`);
        expect(source).toContain(`export const targetFunction = proxy.targetFunction;`);

        // Verify Proxy Behavior
        const proxy = interceptorData.proxy;
        const resultFunc = await proxy.targetFunction('test');
        expect(resultFunc).toBe('Original: Modified: test');

        const resultAnother = await proxy.anotherFunction();
        expect(resultAnother).toBe('Another - Modified');

        const resultDefault = await proxy.default();
        expect(resultDefault).toBe('Default'); // The mock plugin returns ['Default Modified'] but the original function ignores args and returns 'Default'. 
        // Wait, before interceptor modifies arguments. 
        // targetModule.js: export default function defaultExport() { return 'Default'; }
        // It doesn't take arguments, so modifying arguments won't change output unless we check arguments.
        // But we just want to verify it was registered.

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
            interceptors: {
                'BadPlugin': {
                    name: 'BadPlugin',
                    target: 'Vendor_TargetModule::js/target.js',
                    interceptor: 'Vendor_PluginModule::js/plugin.js',
                    sortOrder: 10
                }
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

    test('should skip interception for non-function exports', async () => {
        const themeName = 'Vendor/theme-test';

        themeResolverMock.getThemeConfig.mockReturnValue({
            src: '/path/to/theme'
        });

        moduleResolverMock.getModuleConfigByThemeConfig.mockResolvedValue({
            interceptors: {
                'TestPlugin': {
                    name: 'TestPlugin',
                    target: 'Vendor_TargetModule::js/targetNonFunction.js',
                    interceptor: 'Vendor_PluginModule::js/pluginForNonFunction.js',
                    sortOrder: 10,
                    active: true
                }
            }
        });

        const allFilesMap = {
            'Vendor_TargetModule/js/targetNonFunction': targetNonFunctionPath,
            'Vendor_PluginModule/js/pluginForNonFunction': pluginForNonFunctionPath
        };

        moduleResolverMock.getAllJsVueFilesWithInheritanceCached.mockReturnValue(allFilesMap);

        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await generateInterceptorsService.generateInterceptors(themeName);

        const targetIdentifier = 'Vendor_TargetModule::js/targetNonFunction.js';
        
        // Since both 'config' and 'default' are objects, and we are trying to intercept them,
        // they should be skipped. If all are skipped, the targetIdentifier should not be in result.
        expect(result[targetIdentifier]).toBeUndefined();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('is not a function'));

        consoleSpy.mockRestore();
    });
});
