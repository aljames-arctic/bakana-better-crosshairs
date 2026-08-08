import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BaseSystemAdapter } from '../../src/adapter/system/base-system-adapter.js';
import { MODULE_ID } from '../../src/lib/constants.js';

test('BaseSystemAdapter.refreshLocalizedDefaults registers active translations from game.i18n', () => {
    const origI18n = globalThis.game?.i18n;
    try {
        globalThis.game = globalThis.game ?? {};
        globalThis.game.i18n = {
            translations: {
                BBC: {
                    defaults: {
                        dnd5e: {
                            fireball: 'Bola de Fuego',
                            thunderwave: 'Ola de Trueno'
                        }
                    }
                }
            },
            has: (key) => false,
            localize: (key) => key
        };

        const adapter = new BaseSystemAdapter();
        adapter.systemId = 'dnd5e';
        adapter.setDefaultsData({ fireball: false, thunderwave: true });

        adapter.refreshLocalizedDefaults();

        assert.equal(adapter.getSystemDefault('Bola de Fuego'), false);
        assert.equal(adapter.getSystemDefault('bola-de-fuego'), false);
        assert.equal(adapter.getSystemDefault('Ola de Trueno'), true);
        assert.equal(adapter.getSystemDefault('ola-de-trueno'), true);
    } finally {
        if (origI18n) globalThis.game.i18n = origI18n;
        else delete globalThis.game?.i18n;
    }
});

test('BaseSystemAdapter.loadAllSystemLanguages loads declared module language bundles', async () => {
    const origFetch = globalThis.fetch;
    const origModules = globalThis.game?.modules;

    try {
        const fetchedUrls = [];
        globalThis.fetch = async (url) => {
            fetchedUrls.push(url);
            return {
                ok: true,
                json: async () => ({
                    BBC: {
                        defaults: {
                            dnd5e: {
                                fireball: 'Feuerball'
                            }
                        }
                    }
                })
            };
        };

        globalThis.game = globalThis.game ?? {};
        globalThis.game.modules = new Map([
            [
                MODULE_ID,
                {
                    languages: [
                        { lang: 'en', path: 'lang/en/dnd5e.json' },
                        { lang: 'de', path: 'lang/de/dnd5e.json' }
                    ]
                }
            ]
        ]);

        const adapter = new BaseSystemAdapter();
        adapter.systemId = 'dnd5e';

        await adapter.loadAllSystemLanguages({ fireball: false });

        assert.ok(fetchedUrls.includes(`modules/${MODULE_ID}/lang/en/dnd5e.json`));
        assert.ok(fetchedUrls.includes(`modules/${MODULE_ID}/lang/de/dnd5e.json`));
        assert.equal(adapter.getSystemDefault('Feuerball'), false);
    } finally {
        globalThis.fetch = origFetch;
        if (origModules) globalThis.game.modules = origModules;
        else delete globalThis.game?.modules;
    }
});
