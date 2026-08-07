import './setup.js';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { autorecManager } from '../src/autorec/autorecManager.js';
import { Dnd5eSystemAdapter } from '../src/adapter/system/dnd5e-adapter.js';
import { shouldStickToToken } from '../src/crosshair/util.js';

const jsonPath = path.resolve('./src/autorec/system-defaults/dnd5e.json');
const rawText = fs.readFileSync(jsonPath, 'utf8');

console.log('Validating simplified dnd5e.json dictionary in system-defaults...');
const data = JSON.parse(rawText);
const entriesCount = Object.keys(data).length;
assert.equal(entriesCount, 156);
console.log(`Validated ${entriesCount} AoE spell definitions successfully!`);

// Initialize Dnd5eSystemAdapter with system dataset
console.log('Testing Dnd5eSystemAdapter with in-memory system defaults...');
const dnd5eAdapter = new Dnd5eSystemAdapter();
dnd5eAdapter.setDefaultsData(data);

assert.equal(dnd5eAdapter.defaultsMap.size, 156);
console.log(`Loaded ${dnd5eAdapter.defaultsMap.size} system defaults into Dnd5eSystemAdapter memory map.`);

// AutorecManager should NOT have these 156 items registered (invisible to autorec list)
const thunderwaveInAutorec = autorecManager.getEntryByName('Thunderwave');
assert.equal(thunderwaveInAutorec, null, 'Thunderwave should NOT be registered in visible autorecManager');

// Test direct system default lookup
const thunderwaveDefault = dnd5eAdapter.getSystemDefault('Thunderwave');
assert.equal(thunderwaveDefault, true, 'Thunderwave should default to stick (true)');

const fireballDefault = dnd5eAdapter.getSystemDefault('Fireball');
assert.equal(fireballDefault, false, 'Fireball should default to free (false)');

// Test shouldStickToToken with default behavior
console.log('Testing shouldStickToToken resolution with system defaults...');
assert.equal(shouldStickToToken({ itemName: 'Thunderwave', stickToToken: 'default' }, 'rect', dnd5eAdapter), true);
assert.equal(shouldStickToToken({ itemName: 'Fireball', stickToToken: 'default' }, 'circle', dnd5eAdapter), false);
assert.equal(shouldStickToToken({ itemName: 'Lightning Bolt', stickToToken: 'default' }, 'ray', dnd5eAdapter), true);
assert.equal(shouldStickToToken({ itemName: 'Cone of Cold', stickToToken: 'default' }, 'cone', dnd5eAdapter), true);
assert.equal(shouldStickToToken({ itemName: 'Spirit Guardians', stickToToken: 'default' }, 'circle', dnd5eAdapter), true);
assert.equal(shouldStickToToken({ itemName: 'Wall of Fire', stickToToken: 'default' }, 'ray', dnd5eAdapter), false);

// Test fallback for unlisted homebrew spells (generic shape defaults)
assert.equal(shouldStickToToken({ itemName: 'Custom Homebrew Blast', stickToToken: 'default' }, 'cone', dnd5eAdapter), true);
assert.equal(shouldStickToToken({ itemName: 'Custom Homebrew Blast', stickToToken: 'default' }, 'circle', dnd5eAdapter), false);

// Test explicit override precedence over system default
assert.equal(shouldStickToToken({ itemName: 'Fireball', stickToToken: 'true' }, 'circle', dnd5eAdapter), true);
assert.equal(shouldStickToToken({ itemName: 'Thunderwave', stickToToken: 'false' }, 'rect', dnd5eAdapter), false);

console.log('ALL SIMPLIFIED SYSTEM-DEFAULTS VERIFICATIONS PASSED PERFECTLY!');
