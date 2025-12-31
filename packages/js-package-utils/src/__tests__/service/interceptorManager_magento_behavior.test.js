
import { jest } from '@jest/globals';
import interceptorManager from '../../service/interceptorManager.js';

describe('InterceptorManager Magento Behavior', () => {
    beforeEach(() => {
        // Reset interceptors before each test
        interceptorManager.interceptors = {};
    });

    test('Before interceptors: should chain arguments and handle null returns', async () => {
        const targetName = 'Test::beforeChain';
        const originalFn = jest.fn((arg1, arg2) => `Original: ${arg1}, ${arg2}`);
        const context = {};

        // Interceptor 1: Modifies arguments
        const beforeInterceptor1 = jest.fn((arg1, arg2) => {
            return [arg1 + '_mod1', arg2 + '_mod1'];
        });

        // Interceptor 2: Returns null (should keep arguments from Interceptor 1)
        const beforeInterceptor2 = jest.fn((arg1, arg2) => {
            return null;
        });

        // Interceptor 3: Modifies arguments again
        const beforeInterceptor3 = jest.fn((arg1, arg2) => {
            return [arg1 + '_mod3', arg2 + '_mod3'];
        });

        interceptorManager.addInterceptor(targetName, 'Interceptor1', 'before', beforeInterceptor1, 10);
        interceptorManager.addInterceptor(targetName, 'Interceptor2', 'before', beforeInterceptor2, 20);
        interceptorManager.addInterceptor(targetName, 'Interceptor3', 'before', beforeInterceptor3, 30);

        const result = await interceptorManager.execute(targetName, originalFn, context, 'A', 'B');

        // Verify Interceptor 1 received original args
        expect(beforeInterceptor1).toHaveBeenCalledWith('A', 'B');

        // Verify Interceptor 2 received args modified by Interceptor 1
        expect(beforeInterceptor2).toHaveBeenCalledWith('A_mod1', 'B_mod1');

        // Verify Interceptor 3 received args from Interceptor 1 (since Interceptor 2 returned null)
        expect(beforeInterceptor3).toHaveBeenCalledWith('A_mod1', 'B_mod1');

        // Verify Original received args modified by Interceptor 3
        expect(originalFn).toHaveBeenCalledWith('A_mod1_mod3', 'B_mod1_mod3');

        expect(result).toBe('Original: A_mod1_mod3, B_mod1_mod3');
    });

    test('Around interceptors: should wrap execution and modify args/result', async () => {
        const targetName = 'Test::aroundChain';
        const originalFn = jest.fn((arg) => `Original(${arg})`);
        const context = {};

        // Outer Around Interceptor
        const aroundInterceptor1 = jest.fn(async (proceed, arg) => {
            const result = await proceed(arg + '_outerIn');
            return `Outer(${result})`;
        });

        // Inner Around Interceptor
        const aroundInterceptor2 = jest.fn(async (proceed, arg) => {
            const result = await proceed(arg + '_innerIn');
            return `Inner(${result})`;
        });

        interceptorManager.addInterceptor(targetName, 'Interceptor1', 'around', aroundInterceptor1, 10);
        interceptorManager.addInterceptor(targetName, 'Interceptor2', 'around', aroundInterceptor2, 20);

        const result = await interceptorManager.execute(targetName, originalFn, context, 'Start');

        // Execution flow:
        // Interceptor1 (Start) -> calls proceed('Start_outerIn')
        //   -> Interceptor2 ('Start_outerIn') -> calls proceed('Start_outerIn_innerIn')
        //     -> Original ('Start_outerIn_innerIn') -> returns 'Original(Start_outerIn_innerIn)'
        //   -> Interceptor2 returns 'Inner(Original(Start_outerIn_innerIn))'
        // -> Interceptor1 returns 'Outer(Inner(Original(Start_outerIn_innerIn)))'

        expect(originalFn).toHaveBeenCalledWith('Start_outerIn_innerIn');
        expect(result).toBe('Outer(Inner(Original(Start_outerIn_innerIn)))');
    });

    test('After interceptors: should chain results', async () => {
        const targetName = 'Test::afterChain';
        const originalFn = jest.fn(() => 'Original');
        const context = {};

        const afterInterceptor1 = jest.fn((result) => {
            return result + '_After1';
        });

        const afterInterceptor2 = jest.fn((result) => {
            return result + '_After2';
        });

        interceptorManager.addInterceptor(targetName, 'Interceptor1', 'after', afterInterceptor1, 10);
        interceptorManager.addInterceptor(targetName, 'Interceptor2', 'after', afterInterceptor2, 20);

        const result = await interceptorManager.execute(targetName, originalFn, context);

        expect(afterInterceptor1).toHaveBeenCalledWith('Original');
        expect(afterInterceptor2).toHaveBeenCalledWith('Original_After1');
        expect(result).toBe('Original_After1_After2');
    });

    test('Full Chain: Before -> Around -> Original -> After', async () => {
        const targetName = 'Test::fullChain';
        const originalFn = jest.fn((arg) => `Original(${arg})`);
        const context = {};

        // Before: Modifies arg
        interceptorManager.addInterceptor(targetName, 'Before', 'before', (arg) => [arg + '_Before'], 10);

        // Around: Wraps and modifies arg further
        interceptorManager.addInterceptor(targetName, 'Around', 'around', async (proceed, arg) => {
            const res = await proceed(arg + '_AroundIn');
            return `Around(${res})`;
        }, 20);

        // After: Modifies result
        interceptorManager.addInterceptor(targetName, 'After', 'after', (res) => res + '_After', 30);

        const result = await interceptorManager.execute(targetName, originalFn, context, 'Start');

        // Flow:
        // Before: Start -> Start_Before
        // Around: Start_Before -> calls proceed(Start_Before_AroundIn)
        // Original: Start_Before_AroundIn -> returns Original(Start_Before_AroundIn)
        // Around: returns Around(Original(Start_Before_AroundIn))
        // After: receives Around(...) -> returns Around(...)_After

        expect(originalFn).toHaveBeenCalledWith('Start_Before_AroundIn');
        expect(result).toBe('Around(Original(Start_Before_AroundIn))_After');
    });
});
