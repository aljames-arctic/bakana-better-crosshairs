import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BaseSystemAdapter } from '../../src/adapter/system/base-system-adapter.js';
import { MODULE_ID } from '../../src/lib/constants.js';

test('BaseSystemAdapter.loadAllSystemLanguages dynamically discovers language directories via FilePicker', async () => {
    const origFilePicker = globalThis.FilePicker;
    const origFetch = globalThis.fetch;

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
                                fireball: 'Bola de Fuego'
                            }
                        }
                    }
                })
            };
        };

        globalThis.FilePicker = {
            browse: async (source, target) => {
                if (target === `modules/${MODULE_ID}/lang`) {
                    return {
                        dirs: [
                            `modules/${MODULE_ID}/lang/es`,
                            `modules/${MODULE_ID}/lang/ja`
                        ],
                        files: []
                    };
                }
                return { dirs: [], files: [] };
            }
        };

        const adapter = new BaseSystemAdapter();
        adapter.systemId = 'dnd5e';

        await adapter.loadAllSystemLanguages({ fireball: false });

        assert.ok(fetchedUrls.includes(`modules/${MODULE_ID}/lang/es/dnd5e.json`));
        assert.ok(fetchedUrls.includes(`modules/${MODULE_ID}/lang/ja/dnd5e.json`));
    } finally {
        globalThis.FilePicker = origFilePicker;
        globalThis.fetch = origFetch;
    }
});
