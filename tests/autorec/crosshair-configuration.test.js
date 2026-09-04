import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CrosshairConfiguration } from '../../src/autorec/CrosshairConfiguration.js';

test('CrosshairConfiguration.fromSource initializes with canonical schema defaults', () => {
    const config = CrosshairConfiguration.fromSource({ itemName: 'Fireball', circleFile: 'jb2a.fireball.01' });
    assert.equal(config.itemName, 'Fireball');
    assert.equal(config.circleFile, 'jb2a.fireball.01');
    assert.equal(config.enabled, true);
    assert.equal(config.showLine, true);
    assert.equal(config.showItemIcon, true);
});

test('CrosshairConfiguration.overrideWith merges activity or item overrides without mutating original', () => {
    const base = CrosshairConfiguration.fromSource({
        itemName: 'Fireball',
        circleFile: 'jb2a.fireball.01',
        borderColor: '#ff0000',
        stickToToken: "false",
        showItemIcon: true
    });

    const overridden = base.overrideWith({
        circleFile: 'jb2a.fireball.blue',
        stickToToken: "true",
        showItemIcon: false
    });

    assert.equal(base.circleFile, 'jb2a.fireball.01');
    assert.equal(base.stickToToken, "false");
    assert.equal(base.showItemIcon, true);
    assert.equal(overridden.circleFile, 'jb2a.fireball.blue');
    assert.equal(overridden.stickToToken, "true");
    assert.equal(overridden.showItemIcon, false);
});

test('CrosshairConfiguration.toJSON serializes properties cleanly for persistence', () => {
    const config = CrosshairConfiguration.fromSource({ itemName: 'Test Item', id: 'test-item-id', showItemIcon: false });
    const json = config.toJSON();
    assert.equal(json.itemName, 'Test Item');
    assert.equal(json.id, 'test-item-id');
    assert.equal(json.showItemIcon, false);
    assert.equal(typeof json, 'object');
});

test('CrosshairConfiguration and DEFAULT_AUTOREC_ENTRY default placedFillAlpha to 0.3 and placedFillColor to user color', () => {
    const origColor = globalThis.game?.user?.color;
    try {
        if (!globalThis.game) globalThis.game = { user: {} };
        if (!globalThis.game.user) globalThis.game.user = {};
        globalThis.game.user.color = '#00bcd4';

        const config = new CrosshairConfiguration();
        assert.equal(config.placedFillAlpha, 0.3, 'CrosshairConfiguration placedFillAlpha must default to 30% (0.3)');
        assert.equal(config.placedFillColor, '#00bcd4', 'CrosshairConfiguration placedFillColor must default to game.user.color');
        assert.equal(config.toJSON().placedFillAlpha, 0.3);
        assert.equal(config.toJSON().placedFillColor, '#00bcd4');

        const fromEmpty = CrosshairConfiguration.fromSource({});
        assert.equal(fromEmpty.placedFillAlpha, 0.3);
        assert.equal(fromEmpty.placedFillColor, '#00bcd4');
    } finally {
        if (globalThis.game?.user) {
            if (origColor !== undefined) globalThis.game.user.color = origColor;
            else delete globalThis.game.user.color;
        }
    }
});

test('CrosshairConfiguration.overrideWith respects explicit enabled flag', () => {
    const base = CrosshairConfiguration.fromSource({
        itemName: 'Spike Growth',
        enabled: true,
        circleFile: 'spike.png'
    });

    const disabled = base.overrideWith({ enabled: false });
    assert.equal(disabled.enabled, false);
    assert.equal(disabled.circleFile, 'spike.png');

    const reenabled = disabled.overrideWith({ enabled: true });
    assert.equal(reenabled.enabled, true);
});

test('CrosshairConfiguration handles broadcast flag in constructor, overrideWith, and toJSON', () => {
    const defaultConf = new CrosshairConfiguration();
    assert.equal(defaultConf.broadcast, true);
    assert.equal(defaultConf.toJSON().broadcast, true);

    const base = CrosshairConfiguration.fromSource({
        itemName: 'Secret Invisibility',
        broadcast: true
    });
    assert.equal(base.broadcast, true);

    const unbroadcast = base.overrideWith({ broadcast: false });
    assert.equal(unbroadcast.broadcast, false);
    assert.equal(unbroadcast.toJSON().broadcast, false);

    const reenabled = unbroadcast.overrideWith({ broadcast: true });
    assert.equal(reenabled.broadcast, true);
    assert.equal(reenabled.toJSON().broadcast, true);
});

test('CrosshairConfiguration handles player color flags in constructor, overrideWith, and toJSON', () => {
    const defaultConf = new CrosshairConfiguration();
    assert.equal(defaultConf.borderPlayerColor, true);
    assert.equal(defaultConf.fillPlayerColor, true);
    assert.equal(defaultConf.placedFillPlayerColor, true);
    assert.equal(defaultConf.placedBorderPlayerColor, true);

    const jsonDefault = defaultConf.toJSON();
    assert.equal(jsonDefault.borderPlayerColor, true);
    assert.equal(jsonDefault.fillPlayerColor, true);
    assert.equal(jsonDefault.placedFillPlayerColor, true);
    assert.equal(jsonDefault.placedBorderPlayerColor, true);

    const base = CrosshairConfiguration.fromSource({
        itemName: 'Dynamic Aura'
    });

    const overridden = base.overrideWith({
        enablePreviewPlacement: true,
        fillPlayerColor: false,
        borderPlayerColor: false,
        enablePlacedStyling: true,
        placedFillPlayerColor: false,
        placedBorderPlayerColor: false
    });

    assert.equal(overridden.fillPlayerColor, false);
    assert.equal(overridden.borderPlayerColor, false);
    assert.equal(overridden.enablePreviewPlacement, true);
    assert.equal(overridden.placedFillPlayerColor, false);
    assert.equal(overridden.placedBorderPlayerColor, false);
    assert.equal(overridden.enablePlacedStyling, true);

    const jsonOverridden = overridden.toJSON();
    assert.equal(jsonOverridden.fillPlayerColor, false);
    assert.equal(jsonOverridden.borderPlayerColor, false);
    assert.equal(jsonOverridden.placedFillPlayerColor, false);
    assert.equal(jsonOverridden.placedBorderPlayerColor, false);
});

