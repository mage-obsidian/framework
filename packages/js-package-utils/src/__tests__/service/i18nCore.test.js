import { jest } from '@jest/globals';
import {
    interpolate,
    translatePhrase,
    readI18nConfig,
    loadDictionary,
    _resetDictionaryCache,
} from '../../service/i18nCore.js';

describe('interpolate', () => {
    it('returns the text unchanged when there are no args', () => {
        expect(interpolate('Hello world')).toBe('Hello world');
    });

    it('substitutes positional placeholders', () => {
        expect(interpolate('Remove %1 from %2', ['shoes', 'cart'])).toBe('Remove shoes from cart');
    });

    it('repeats a placeholder used more than once', () => {
        expect(interpolate('%1 = %1', ['x'])).toBe('x = x');
    });

    it('leaves out-of-range placeholders untouched', () => {
        expect(interpolate('a %1 b %2', ['only'])).toBe('a only b %2');
    });

    it('coerces non-string args', () => {
        expect(interpolate('count: %1', [3])).toBe('count: 3');
    });

    it('passes non-string input through', () => {
        expect(interpolate(undefined, ['x'])).toBeUndefined();
    });
});

describe('translatePhrase', () => {
    const dict = { 'Hello world': 'Hola mundo', 'Remove %1': 'Quitar %1' };

    it('returns the translation when present', () => {
        expect(translatePhrase(dict, 'Hello world')).toBe('Hola mundo');
    });

    it('falls back to the original phrase when missing', () => {
        expect(translatePhrase(dict, 'Unknown phrase')).toBe('Unknown phrase');
    });

    it('interpolates placeholders into the translation', () => {
        expect(translatePhrase(dict, 'Remove %1', ['boots'])).toBe('Quitar boots');
    });

    it('interpolates placeholders into the fallback phrase', () => {
        expect(translatePhrase(dict, 'Add %1', ['boots'])).toBe('Add boots');
    });

    it('tolerates a null or non-object dictionary', () => {
        expect(translatePhrase(null, 'x')).toBe('x');
        expect(translatePhrase([], 'x')).toBe('x');
    });
});

describe('readI18nConfig', () => {
    it('returns defaults when the global is absent', () => {
        expect(readI18nConfig({})).toEqual({ locale: 'en_US', dictionaryUrl: null });
    });

    it('reads locale and dictionaryUrl from the scope', () => {
        const scope = { __MAGE_OBSIDIAN_I18N__: { locale: 'es_ES', dictionaryUrl: '/d.json' } };
        expect(readI18nConfig(scope)).toEqual({ locale: 'es_ES', dictionaryUrl: '/d.json' });
    });
});

describe('loadDictionary', () => {
    beforeEach(() => _resetDictionaryCache());

    it('resolves to {} for a falsy url without calling fetch', async () => {
        const fetchImpl = jest.fn();
        await expect(loadDictionary(null, fetchImpl)).resolves.toEqual({});
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('fetches and parses the dictionary once, caching by url', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ a: 'b' }) });
        const first = await loadDictionary('/d.json', fetchImpl);
        const second = await loadDictionary('/d.json', fetchImpl);
        expect(first).toEqual({ a: 'b' });
        expect(second).toEqual({ a: 'b' });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('normalizes an empty array (Magento empty dictionary) to {}', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
        await expect(loadDictionary('/empty.json', fetchImpl)).resolves.toEqual({});
    });

    it('degrades to {} on a non-ok response', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({ ok: false });
        await expect(loadDictionary('/missing.json', fetchImpl)).resolves.toEqual({});
    });

    it('degrades to {} when fetch rejects', async () => {
        const fetchImpl = jest.fn().mockRejectedValue(new Error('network'));
        await expect(loadDictionary('/boom.json', fetchImpl)).resolves.toEqual({});
    });
});
