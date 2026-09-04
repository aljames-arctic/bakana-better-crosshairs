import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { PixiGraphicsStyler } from '../../src/adapter/foundry/pixiGraphicsStyler.js';

test('PixiGraphicsStyler.toColorNumber converts hex strings and numbers to color values', () => {
    assert.equal(PixiGraphicsStyler.toColorNumber('#ff0000'), 0xff0000);
    assert.equal(PixiGraphicsStyler.toColorNumber('#00ff00'), 0x00ff00);
    assert.equal(PixiGraphicsStyler.toColorNumber(0x123456), 0x123456);
    assert.equal(PixiGraphicsStyler.toColorNumber(null), undefined);
    assert.equal(PixiGraphicsStyler.toColorNumber(''), undefined);
});

test('PixiGraphicsStyler.applyPlacedStyling applies border and fill colors across graphicsData', () => {
    const mockGraphic = {
        geometry: {
            graphicsData: [
                { lineStyle: { width: 2, color: 0x000000, alpha: 1 }, fillStyle: { alpha: 0.5, color: 0x000000 } }
            ],
            invalidate: () => {}
        }
    };

    const mockPlaceable = {
        document: {
            flags: {
                bbc: {
                    placedBorderColor: '#ff0000',
                    placedBorderAlpha: 0.8,
                    placedFillColor: '#00ff00',
                    placedFillAlpha: 0.4
                }
            }
        },
        template: mockGraphic
    };

    PixiGraphicsStyler.applyPlacedStyling(mockPlaceable, false);

    const gd = mockGraphic.geometry.graphicsData[0];
    assert.equal(gd.lineStyle.color, 0xff0000);
    assert.equal(gd.lineStyle.alpha, 0.8);
    assert.equal(gd.fillStyle.color, 0x00ff00);
    assert.equal(gd.fillStyle.alpha, 0.4);
});

test('PixiGraphicsStyler.applyPlacedStyling prioritizes updated document colors without overwriting with stale flags', () => {
    const mockGraphic = {
        geometry: {
            graphicsData: [
                { lineStyle: { width: 2, color: 0x000000, alpha: 1 }, fillStyle: { alpha: 0.5, color: 0x000000 } }
            ],
            invalidate: () => {}
        }
    };

    const mockPlaceable = {
        document: {
            fillColor: '#123456',
            borderColor: '#abcdef',
            fillAlpha: 0.9,
            borderAlpha: 0.7,
            flags: {
                bbc: {
                    placedBorderColor: '#ff0000',
                    placedBorderAlpha: 0.8,
                    placedFillColor: '#00ff00',
                    placedFillAlpha: 0.4
                }
            }
        },
        template: mockGraphic
    };

    PixiGraphicsStyler.applyPlacedStyling(mockPlaceable, false);

    const gd = mockGraphic.geometry.graphicsData[0];
    assert.equal(gd.lineStyle.color, 0xabcdef);
    assert.equal(gd.lineStyle.alpha, 0.7);
    assert.equal(gd.fillStyle.color, 0x123456);
    assert.equal(gd.fillStyle.alpha, 0.9);
    assert.equal(mockPlaceable.document.fillColor, '#123456');
    assert.equal(mockPlaceable.document.borderColor, '#abcdef');
});

test('PixiGraphicsStyler.applyPlacedStyling applies 50% opacity and user color to 0-alpha graphicsData by default', () => {
    const origColor = globalThis.game?.user?.color;
    try {
        if (!globalThis.game) globalThis.game = { user: {} };
        if (!globalThis.game.user) globalThis.game.user = {};
        globalThis.game.user.color = '#3366cc';

        const mockGraphic = {
            geometry: {
                graphicsData: [
                    { lineStyle: { width: 2, color: 0x000000, alpha: 1 }, fillStyle: { alpha: 0, color: 0x000000 } }
                ],
                invalidate: () => {}
            }
        };

        const mockPlaceable = {
            document: {
                id: 'placed-region-1',
                flags: { bbc: {} }
            },
            template: mockGraphic
        };

        PixiGraphicsStyler.applyPlacedStyling(mockPlaceable, false);

        const gd = mockGraphic.geometry.graphicsData[0];
        assert.equal(gd.fillStyle.color, 0x3366cc);
        assert.equal(gd.fillStyle.alpha, 0.5, 'Default opacity must be 50% (0.5), not 0%');
    } finally {
        if (globalThis.game?.user) {
            if (origColor !== undefined) globalThis.game.user.color = origColor;
            else delete globalThis.game.user.color;
        }
    }
});

test('PixiGraphicsStyler.applyPlacedStyling dynamically resolves player color when placedFillPlayerColor or placedBorderPlayerColor is true', () => {
    const origColor = globalThis.game?.user?.color;
    try {
        if (!globalThis.game) globalThis.game = { user: {} };
        if (!globalThis.game.user) globalThis.game.user = {};
        globalThis.game.user.color = '#ffaa00';

        const mockGraphic = {
            geometry: {
                graphicsData: [
                    { lineStyle: { width: 2, color: 0x000000, alpha: 1 }, fillStyle: { alpha: 0.5, color: 0x000000 } }
                ],
                invalidate: () => {}
            }
        };

        const mockPlaceable = {
            document: {
                fillColor: '#123456',
                borderColor: '#654321',
                flags: {
                    bbc: {
                        placedBorderColor: '#00ff00',
                        placedFillColor: '#0000ff',
                        placedBorderPlayerColor: true,
                        placedFillPlayerColor: true
                    }
                }
            },
            template: mockGraphic
        };

        PixiGraphicsStyler.applyPlacedStyling(mockPlaceable, false);

        const gd = mockGraphic.geometry.graphicsData[0];
        assert.equal(gd.lineStyle.color, 0xffaa00);
        assert.equal(gd.fillStyle.color, 0xffaa00);
    } finally {
        if (globalThis.game?.user) {
            if (origColor !== undefined) globalThis.game.user.color = origColor;
            else delete globalThis.game.user.color;
        }
    }
});


