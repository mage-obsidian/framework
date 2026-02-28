
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
        const context = { id: 'subject' };

        // Interceptor 1: Modifies arguments (returns the subject-less args)
        const beforeInterceptor1 = jest.fn((subject, arg1, arg2) => {
            return [arg1 + '_mod1', arg2 + '_mod1'];
        });

        // Interceptor 2: Returns null (should keep arguments from Interceptor 1)
        const beforeInterceptor2 = jest.fn((subject, arg1, arg2) => {
            return null;
        });

        // Interceptor 3: Modifies arguments again
        const beforeInterceptor3 = jest.fn((subject, arg1, arg2) => {
            return [arg1 + '_mod3', arg2 + '_mod3'];
        });

        interceptorManager.addInterceptor(targetName, 'Interceptor1', 'before', beforeInterceptor1, 10);
        interceptorManager.addInterceptor(targetName, 'Interceptor2', 'before', beforeInterceptor2, 20);
        interceptorManager.addInterceptor(targetName, 'Interceptor3', 'before', beforeInterceptor3, 30);

        const result = await interceptorManager.execute(targetName, originalFn, context, 'A', 'B');

        // Each before handler receives the subject as its first argument.
        expect(beforeInterceptor1).toHaveBeenCalledWith(context, 'A', 'B');
        expect(beforeInterceptor2).toHaveBeenCalledWith(context, 'A_mod1', 'B_mod1');
        expect(beforeInterceptor3).toHaveBeenCalledWith(context, 'A_mod1', 'B_mod1');

        // Verify Original received args modified by Interceptor 3 (subject is not forwarded)
        expect(originalFn).toHaveBeenCalledWith('A_mod1_mod3', 'B_mod1_mod3');

        expect(result).toBe('Original: A_mod1_mod3, B_mod1_mod3');
    });

    test('Around interceptors: should wrap execution and modify args/result', async () => {
        const targetName = 'Test::aroundChain';
        const originalFn = jest.fn((arg) => `Original(${arg})`);
        const context = { id: 'subject' };

        // Outer Around Interceptor
        const aroundInterceptor1 = jest.fn(async (subject, proceed, arg) => {
            const result = await proceed(arg + '_outerIn');
            return `Outer(${result})`;
        });

        // Inner Around Interceptor
        const aroundInterceptor2 = jest.fn(async (subject, proceed, arg) => {
            const result = await proceed(arg + '_innerIn');
            return `Inner(${result})`;
        });

        interceptorManager.addInterceptor(targetName, 'Interceptor1', 'around', aroundInterceptor1, 10);
        interceptorManager.addInterceptor(targetName, 'Interceptor2', 'around', aroundInterceptor2, 20);

        const result = await interceptorManager.execute(targetName, originalFn, context, 'Start');

        // Execution flow (subject threaded as the first arg of each around):
        // Interceptor1 (Start) -> calls proceed('Start_outerIn')
        //   -> Interceptor2 ('Start_outerIn') -> calls proceed('Start_outerIn_innerIn')
        //     -> Original ('Start_outerIn_innerIn') -> returns 'Original(Start_outerIn_innerIn)'
        //   -> Interceptor2 returns 'Inner(Original(Start_outerIn_innerIn))'
        // -> Interceptor1 returns 'Outer(Inner(Original(Start_outerIn_innerIn)))'

        expect(aroundInterceptor1.mock.calls[0][0]).toBe(context);
        expect(originalFn).toHaveBeenCalledWith('Start_outerIn_innerIn');
        expect(result).toBe('Outer(Inner(Original(Start_outerIn_innerIn)))');
    });

    test('After interceptors: should chain results', async () => {
        const targetName = 'Test::afterChain';
        const originalFn = jest.fn(() => 'Original');
        const context = { id: 'subject' };

        const afterInterceptor1 = jest.fn((subject, result) => {
            return result + '_After1';
        });

        const afterInterceptor2 = jest.fn((subject, result) => {
            return result + '_After2';
        });

        interceptorManager.addInterceptor(targetName, 'Interceptor1', 'after', afterInterceptor1, 10);
        interceptorManager.addInterceptor(targetName, 'Interceptor2', 'after', afterInterceptor2, 20);

        const result = await interceptorManager.execute(targetName, originalFn, context);

        expect(afterInterceptor1).toHaveBeenCalledWith(context, 'Original');
        expect(afterInterceptor2).toHaveBeenCalledWith(context, 'Original_After1');
        expect(result).toBe('Original_After1_After2');
    });

    test('Full Chain: Before -> Around -> Original -> After', async () => {
        const targetName = 'Test::fullChain';
        const originalFn = jest.fn((arg) => `Original(${arg})`);
        const context = { id: 'subject' };

        // Before: Modifies arg
        interceptorManager.addInterceptor(targetName, 'Before', 'before', (subject, arg) => [arg + '_Before'], 10);

        // Around: Wraps and modifies arg further
        interceptorManager.addInterceptor(targetName, 'Around', 'around', async (subject, proceed, arg) => {
            const res = await proceed(arg + '_AroundIn');
            return `Around(${res})`;
        }, 20);

        // After: Modifies result
        interceptorManager.addInterceptor(targetName, 'After', 'after', (subject, res) => res + '_After', 30);

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

    test('subject parity: handlers get the subject explicitly and via `this`', async () => {
        const targetName = 'Test::subjectParity';
        const subject = { name: 'TargetModule', greet: () => 'hi' };
        const originalFn = jest.fn(() => 'result');

        const seen = {};
        // Arrow handler: cannot use `this`, relies on the explicit subject arg.
        interceptorManager.addInterceptor(targetName, 'Arrow', 'before', (s, ...args) => {
            seen.beforeSubject = s;
            return args;
        }, 10);
        // Around: subject as first arg, `this` still bound for legacy handlers.
        interceptorManager.addInterceptor(targetName, 'Legacy', 'around', function (s, proceed, ...args) {
            seen.aroundSubject = s;
            seen.aroundThis = this;
            return proceed(...args);
        }, 20);
        interceptorManager.addInterceptor(targetName, 'After', 'after', (s, result) => {
            seen.afterSubject = s;
            return result;
        }, 30);

        await interceptorManager.execute(targetName, originalFn, subject, 'x');

        expect(seen.beforeSubject).toBe(subject);
        expect(seen.aroundSubject).toBe(subject);
        expect(seen.aroundThis).toBe(subject); // `this` parity preserved
        expect(seen.afterSubject).toBe(subject);
    });

    test('executeSync: subject threaded the same way as async execute', () => {
        const targetName = 'Test::syncSubject';
        const subject = { id: 'sync-subject' };
        const originalFn = jest.fn((arg) => `Original(${arg})`);

        const calls = [];
        interceptorManager.addInterceptor(targetName, 'Before', 'before', (s, arg) => { calls.push(['before', s]); return [arg + '_b']; }, 10);
        interceptorManager.addInterceptor(targetName, 'Around', 'around', (s, proceed, arg) => { calls.push(['around', s]); return `A(${proceed(arg)})`; }, 20);
        interceptorManager.addInterceptor(targetName, 'After', 'after', (s, res) => { calls.push(['after', s]); return res + '_a'; }, 30);

        const result = interceptorManager.executeSync(targetName, originalFn, subject, 'Start');

        expect(calls).toEqual([['before', subject], ['around', subject], ['after', subject]]);
        expect(originalFn).toHaveBeenCalledWith('Start_b');
        expect(result).toBe('A(Original(Start_b))_a');
    });
});
