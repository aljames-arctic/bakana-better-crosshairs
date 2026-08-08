import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { autorecManager } from '../../src/autorec/autorecManager.js';

test('autorecManager lifecycle: registration, fast lookup, and unregistration', () => {
    const testEntry = {
        itemName: 'Magic Missile',
        enabled: true,
        circleFile: 'jb2a.magic_missile.blue'
    };

    assert.equal(autorecManager.has('Magic Missile'), false);

    autorecManager.register('Magic Missile', testEntry, { local: true });
    assert.equal(autorecManager.has('Magic Missile'), true);

    const retrieved = autorecManager.getEntryByName('Magic Missile');
    assert.ok(retrieved);
    assert.equal(retrieved.circleFile, 'jb2a.magic_missile.blue');

    const list = autorecManager.list();
    assert.ok(list.includes('Magic Missile'));

    const allEntries = autorecManager.getAllEntries();
    assert.ok(allEntries.some(e => e.itemName === 'Magic Missile'));

    autorecManager.unregister('Magic Missile', { local: true });
    assert.equal(autorecManager.has('Magic Missile'), false);
});

test('autorecManager.registerMany and unregisterMany handle batch operations cleanly', () => {
    const entries = [
        { itemName: 'Spell A', enabled: true },
        { itemName: 'Spell B', enabled: true }
    ];

    autorecManager.registerMany(entries, { local: true });
    assert.equal(autorecManager.has('Spell A'), true);
    assert.equal(autorecManager.has('Spell B'), true);

    autorecManager.unregisterMany(['Spell A', 'Spell B'], { local: true });
    assert.equal(autorecManager.has('Spell A'), false);
    assert.equal(autorecManager.has('Spell B'), false);
});

test('autorecManager preserves persist flag across registration, getAllEntries, and loadSavedRegistrations', () => {
    autorecManager.register('Persist Spell', {
        itemName: 'Persist Spell',
        persist: true,
        placedFillColor: '#ff0000'
    }, { local: true });

    const entry = autorecManager.get('Persist Spell');
    assert.equal(entry.persist, true);

    const allEntries = autorecManager.getAllEntries();
    const found = allEntries.find(e => e.itemName === 'Persist Spell');
    assert.ok(found);
    assert.equal(found.persist, true);
    assert.equal(found.hasPlacedStyling, true);

    // Verify loadSavedRegistrations hydration preserves persist
    const savedDict = {
        'Persist Spell': {
            itemName: 'Persist Spell',
            persist: true,
            circleFile: 'circle.png'
        }
    };
    autorecManager.loadSavedRegistrations(savedDict);
    const loaded = autorecManager.get('Persist Spell');
    assert.equal(loaded.persist, true);

    const loadedAll = autorecManager.getAllEntries();
    const loadedFound = loadedAll.find(e => e.itemName === 'Persist Spell');
    assert.ok(loadedFound);
    assert.equal(loadedFound.persist, true);

    autorecManager.unregister('Persist Spell', { local: true });
});
