import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { crosshairAdapter } from '../../src/adapter/foundry/index.js';
import { shouldStickToToken, getTokenEdgePoint, snapCoordinates } from '../../src/crosshair/util.js';
import { BaseSystemAdapter } from '../../src/adapter/system/base-system-adapter.js';
import { Dnd5eSystemAdapter } from '../../src/adapter/system/dnd5e-adapter.js';

crosshairAdapter.initialize();

test('crosshair.util.shouldStickToToken evaluates configuration flags and delegates defaults to system adapters', () => {
    assert.equal(shouldStickToToken({ stickToToken: true }), true);
    assert.equal(shouldStickToToken({ stickToToken: false }), false);
    assert.equal(shouldStickToToken({ stickToToken: 'true' }), true);
    assert.equal(shouldStickToToken({ stickToToken: '0' }), false);

    const baseSys = new BaseSystemAdapter();
    const dnd5eSys = new Dnd5eSystemAdapter();

    dnd5eSys.setDefaultsData({
        'burning-hands': true,
        'lightning-bolt': true,
        'fireball': false
    });

    // Unrecognized actions / empty configs always fall back to detached (false)
    assert.equal(shouldStickToToken({}, "cone", baseSys), false);
    assert.equal(shouldStickToToken({}, "circle", baseSys), false);

    assert.equal(shouldStickToToken({}, "cone", dnd5eSys), false);
    assert.equal(shouldStickToToken({}, "ray", dnd5eSys), false);
    assert.equal(shouldStickToToken({}, "circle", dnd5eSys), false);
    assert.equal(shouldStickToToken({}, "square", dnd5eSys), false);

    // Completely unrecognized custom actions always default to detached
    assert.equal(shouldStickToToken({ itemName: "Custom Homebrew Cone" }, "cone", dnd5eSys), false);
    assert.equal(shouldStickToToken({ itemName: "Custom Homebrew Ray" }, "ray", dnd5eSys), false);

    // Recognized spells in system defaults dataset adhere to their dictionary settings
    assert.equal(shouldStickToToken({ itemName: "Burning Hands" }, "cone", dnd5eSys), true);
    assert.equal(shouldStickToToken({ itemName: "Lightning Bolt" }, "ray", dnd5eSys), true);
    assert.equal(shouldStickToToken({ itemName: "Fireball" }, "circle", dnd5eSys), false);
});

test('crosshair.util.snapCoordinates aligns separate x and y coordinates to grid', () => {
    const snapped = snapCoordinates(123, 456, true);
    assert.deepEqual(snapped, { x: 100, y: 450 });
});
