import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "../setup.js";
import { BROADCAST_INTERVAL_MS, BROADCAST_HEARTBEAT_INTERVAL_MS, REMOTE_CROSSHAIR_TIMEOUT_MS, MODULE_ID } from "../../src/lib/constants.js";
import { registerModuleSettings } from "../../src/settings.js";
import { remoteCrosshairManager, RemoteCrosshairVisual } from "../../src/crosshair/remoteCrosshairManager.js";
import { BaseCrosshairShape } from "../../src/crosshair/base.js";
import { crosshair } from "../../src/crosshair/index.js";
import { socketlib } from "../../src/integration/socketlib.js";

test("BROADCAST_INTERVAL_MS is set to 200ms (5Hz)", () => {
    assert.equal(BROADCAST_INTERVAL_MS, 200);
});

test("BROADCAST_HEARTBEAT_INTERVAL_MS is set to 5000ms (5s)", () => {
    assert.equal(BROADCAST_HEARTBEAT_INTERVAL_MS, 5000);
});

test("REMOTE_CROSSHAIR_TIMEOUT_MS is set to 10000ms (10s)", () => {
    assert.equal(REMOTE_CROSSHAIR_TIMEOUT_MS, 10000);
});

test("registerModuleSettings registers crosshair broadcasting settings with default true", () => {
    registerModuleSettings();
    assert.equal(game.settings.get(MODULE_ID, "enableCrosshairBroadcasting"), true);
    assert.equal(game.settings.get(MODULE_ID, "showOtherPlayersCrosshairs"), true);
});

test("RemoteCrosshairManager ignores socket payloads sent by local user", async () => {
    await remoteCrosshairManager.clear();
    game.user.id = "local-player";

    const payload = {
        type: "CROSSHAIR_START",
        placementId: "test-placement-1",
        senderUserId: "local-player",
        shapeType: "circle",
        file: "test-file.png",
        x: 100,
        y: 100
    };

    await remoteCrosshairManager.handleSocketMessage(payload);
    assert.equal(remoteCrosshairManager.remoteCrosshairs.size, 0);
});

test("RemoteCrosshairManager creates, updates, and destroys remote visuals for peer users", async () => {
    await remoteCrosshairManager.clear();
    game.user.id = "local-player";
    game.settings.set(MODULE_ID, "enableCrosshairBroadcasting", true);
    game.settings.set(MODULE_ID, "showOtherPlayersCrosshairs", true);

    globalThis.canvas = {
        controls: {
            cursors: {
                "peer-player-1": { x: 500, y: 500 }
            }
        }
    };

    const startPayload = {
        type: "CROSSHAIR_START",
        placementId: "peer-placement-1",
        senderUserId: "peer-player-1",
        shapeType: "circle",
        file: "test-circle.png",
        x: 500,
        y: 500,
        direction: 90
    };

    await remoteCrosshairManager.handleSocketMessage(startPayload);
    assert.equal(remoteCrosshairManager.remoteCrosshairs.size, 1);
    const visual = remoteCrosshairManager.remoteCrosshairs.get("peer-placement-1");
    assert.ok(visual);
    assert.equal(visual.shape.x, 500);
    assert.equal(visual.shape.y, 500);
    assert.equal(visual.shape.direction, 90);

    // Update peer cursor position on canvas
    globalThis.canvas.controls.cursors["peer-player-1"] = { x: 600, y: 600 };

    const updatePayload = {
        type: "CROSSHAIR_UPDATE",
        placementId: "peer-placement-1",
        senderUserId: "peer-player-1",
        x: 600,
        y: 600,
        direction: 180
    };

    await remoteCrosshairManager.handleSocketMessage(updatePayload);
    assert.equal(visual.shape.x, 600);
    assert.equal(visual.shape.y, 600);
    assert.equal(visual.shape.direction, 180);

    const endPayload = {
        type: "CROSSHAIR_END",
        placementId: "peer-placement-1",
        senderUserId: "peer-player-1",
        reason: "placed"
    };

    await remoteCrosshairManager.handleSocketMessage(endPayload);
    assert.equal(remoteCrosshairManager.remoteCrosshairs.size, 0);
    assert.equal(visual.isDestroyed, true);
});

test("RemoteCrosshairVisual resolves target position using peer cursor pointer if available", () => {
    globalThis.canvas = {
        controls: {
            cursors: {
                "peer-player-2": { x: 750, y: 850 }
            }
        }
    };

    const visual = new RemoteCrosshairVisual({
        placementId: "peer-placement-2",
        senderUserId: "peer-player-2",
        x: 100,
        y: 100
    });

    const pos = visual.resolveTargetPosition();
    assert.equal(pos.x, 750);
    assert.equal(pos.y, 850);
});

test("BaseCrosshairShape startBroadcasting and stopBroadcasting emit CROSSHAIR_* events", async () => {
    game.user.id = "origin-user";
    game.settings.set(MODULE_ID, "enableCrosshairBroadcasting", true);

    const emitted = [];
    const origEmit = socketlib.emit;
    socketlib.emit = (payload) => emitted.push(payload);

    const dummyPlaceable = { x: 200, y: 300 };
    const shape = new BaseCrosshairShape(dummyPlaceable, { id: "test-shape", type: "circle" });

    shape.startBroadcasting();
    assert.ok(shape.placementId);
    assert.ok(shape.broadcastTimer);
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].type, "CROSSHAIR_START");
    assert.equal(emitted[0].senderUserId, "origin-user");
    assert.equal(emitted[0].x, 200);
    assert.equal(emitted[0].y, 300);

    shape.stopBroadcasting("placed");
    assert.equal(shape.broadcastTimer, null);
    assert.equal(shape.placementId, null);
    assert.equal(emitted.length, 2);
    assert.equal(emitted[1].type, "CROSSHAIR_END");
    assert.equal(emitted[1].reason, "placed");

    socketlib.emit = origEmit;
});

test("CrosshairBroadcaster emits CROSSHAIR_HEARTBEAT periodically when crosshair is stationary", async () => {
    game.user.id = "wizard-user";
    game.settings.set(MODULE_ID, "enableCrosshairBroadcasting", true);

    const emitted = [];
    const origEmit = socketlib.emit;
    socketlib.emit = (payload) => emitted.push(payload);

    const dummyPlaceable = { x: 150, y: 250 };
    const shape = new BaseCrosshairShape(dummyPlaceable, { id: "test-heartbeat-shape", type: "circle" });

    // Use a fast tick and heartbeat cadence for test
    shape.broadcaster.intervalMs = 15;
    shape.broadcaster.heartbeatIntervalMs = 30;

    shape.startBroadcasting();
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].type, "CROSSHAIR_START");

    // Wait long enough for interval tick to fire heartbeat (30ms threshold, wait 60ms)
    await new Promise((resolve) => setTimeout(resolve, 60));

    shape.stopBroadcasting("canceled");
    socketlib.emit = origEmit;

    const heartbeats = emitted.filter((e) => e.type === "CROSSHAIR_HEARTBEAT");
    assert.ok(heartbeats.length >= 1, "Should have emitted at least one CROSSHAIR_HEARTBEAT");
    assert.equal(heartbeats[0].senderUserId, "wizard-user");
    assert.ok(heartbeats[0].placementId);
});

test("CrosshairBroadcaster resets heartbeat timer when state changes, postponing heartbeat", async () => {
    game.user.id = "wizard-user";
    game.settings.set(MODULE_ID, "enableCrosshairBroadcasting", true);

    const emitted = [];
    const origEmit = socketlib.emit;
    socketlib.emit = (payload) => emitted.push(payload);

    const dummyPlaceable = { x: 150, y: 250 };
    const shape = new BaseCrosshairShape(dummyPlaceable, { id: "test-heartbeat-reset", type: "circle" });

    shape.broadcaster.intervalMs = 15;
    shape.broadcaster.heartbeatIntervalMs = 50;

    shape.startBroadcasting();
    assert.equal(emitted.length, 1);

    // At 30ms, move the shape (before 50ms heartbeat threshold)
    await new Promise((resolve) => setTimeout(resolve, 30));
    shape.x = 200;
    shape.y = 300;

    // Wait 30ms more (total 60ms from start, but only 30ms since update)
    await new Promise((resolve) => setTimeout(resolve, 30));

    const updates = emitted.filter((e) => e.type === "CROSSHAIR_UPDATE");
    const heartbeats = emitted.filter((e) => e.type === "CROSSHAIR_HEARTBEAT");

    assert.ok(updates.length >= 1, "Should have emitted CROSSHAIR_UPDATE");
    assert.equal(heartbeats.length, 0, "Heartbeat should not have fired yet because update refreshed the timer");

    shape.stopBroadcasting("canceled");
    socketlib.emit = origEmit;
});

test("RemoteCrosshairManager automatically times out and self-removes after inactivity", async () => {
    await remoteCrosshairManager.clear();
    game.user.id = "peer-player";
    game.settings.set(MODULE_ID, "enableCrosshairBroadcasting", true);
    game.settings.set(MODULE_ID, "showOtherPlayersCrosshairs", true);

    const startPayload = {
        type: "CROSSHAIR_START",
        placementId: "crashed-wizard-placement",
        senderUserId: "crashed-wizard",
        shapeType: "circle",
        file: "test-circle.png",
        x: 400,
        y: 400,
        timeoutMs: 40
    };

    await remoteCrosshairManager.handleSocketMessage(startPayload);
    assert.equal(remoteCrosshairManager.remoteCrosshairs.size, 1);
    const visual = remoteCrosshairManager.remoteCrosshairs.get("crashed-wizard-placement");
    assert.ok(visual);
    assert.equal(visual.isDestroyed, false);

    // Wait for the timeout to elapse (40ms timeout, wait 70ms)
    await new Promise((resolve) => setTimeout(resolve, 70));

    assert.equal(remoteCrosshairManager.remoteCrosshairs.size, 0, "Remote crosshair should have self-removed from manager");
    assert.equal(visual.isDestroyed, true, "Remote visual should be destroyed");
});

test("RemoteCrosshairManager resets timeout on CROSSHAIR_UPDATE, preventing self-removal", async () => {
    await remoteCrosshairManager.clear();
    game.user.id = "peer-player";
    game.settings.set(MODULE_ID, "enableCrosshairBroadcasting", true);
    game.settings.set(MODULE_ID, "showOtherPlayersCrosshairs", true);

    const startPayload = {
        type: "CROSSHAIR_START",
        placementId: "active-wizard-placement",
        senderUserId: "active-wizard",
        shapeType: "circle",
        file: "test-circle.png",
        x: 400,
        y: 400,
        timeoutMs: 60
    };

    await remoteCrosshairManager.handleSocketMessage(startPayload);
    assert.equal(remoteCrosshairManager.remoteCrosshairs.size, 1);
    const visual = remoteCrosshairManager.remoteCrosshairs.get("active-wizard-placement");

    // At 30ms (before 60ms timeout), send an update
    await new Promise((resolve) => setTimeout(resolve, 30));
    await remoteCrosshairManager.handleSocketMessage({
        type: "CROSSHAIR_UPDATE",
        placementId: "active-wizard-placement",
        senderUserId: "active-wizard",
        x: 450,
        y: 450
    });

    // Wait another 40ms (total elapsed 70ms > original 60ms)
    await new Promise((resolve) => setTimeout(resolve, 40));

    assert.equal(remoteCrosshairManager.remoteCrosshairs.size, 1, "Visual should still exist because update refreshed timeout");
    assert.equal(visual.isDestroyed, false);

    await remoteCrosshairManager.clear();
});

test("RemoteCrosshairManager resets timeout on CROSSHAIR_HEARTBEAT, preventing self-removal", async () => {
    await remoteCrosshairManager.clear();
    game.user.id = "peer-player";
    game.settings.set(MODULE_ID, "enableCrosshairBroadcasting", true);
    game.settings.set(MODULE_ID, "showOtherPlayersCrosshairs", true);

    const startPayload = {
        type: "CROSSHAIR_START",
        placementId: "stationary-wizard-placement",
        senderUserId: "stationary-wizard",
        shapeType: "circle",
        file: "test-circle.png",
        x: 400,
        y: 400,
        timeoutMs: 60
    };

    await remoteCrosshairManager.handleSocketMessage(startPayload);
    assert.equal(remoteCrosshairManager.remoteCrosshairs.size, 1);
    const visual = remoteCrosshairManager.remoteCrosshairs.get("stationary-wizard-placement");

    // At 30ms, send a heartbeat
    await new Promise((resolve) => setTimeout(resolve, 30));
    await remoteCrosshairManager.handleSocketMessage({
        type: "CROSSHAIR_HEARTBEAT",
        placementId: "stationary-wizard-placement",
        senderUserId: "stationary-wizard"
    });

    // Wait another 40ms (total elapsed 70ms > original 60ms)
    await new Promise((resolve) => setTimeout(resolve, 40));

    assert.equal(remoteCrosshairManager.remoteCrosshairs.size, 1, "Visual should still exist because heartbeat refreshed timeout");
    assert.equal(visual.isDestroyed, false);

    await remoteCrosshairManager.clear();
});

test("RemoteCrosshairManager clearForUser removes visuals belonging to specific disconnected user", async () => {
    await remoteCrosshairManager.clear();
    game.user.id = "gm-user";
    game.settings.set(MODULE_ID, "enableCrosshairBroadcasting", true);
    game.settings.set(MODULE_ID, "showOtherPlayersCrosshairs", true);

    await remoteCrosshairManager.handleSocketMessage({
        type: "CROSSHAIR_START",
        placementId: "user-a-1",
        senderUserId: "user-a",
        shapeType: "circle",
        x: 100,
        y: 100,
        timeoutMs: 5000
    });

    await remoteCrosshairManager.handleSocketMessage({
        type: "CROSSHAIR_START",
        placementId: "user-b-1",
        senderUserId: "user-b",
        shapeType: "circle",
        x: 200,
        y: 200,
        timeoutMs: 5000
    });

    assert.equal(remoteCrosshairManager.remoteCrosshairs.size, 2);

    await remoteCrosshairManager.clearForUser("user-a");

    assert.equal(remoteCrosshairManager.remoteCrosshairs.size, 1);
    assert.ok(!remoteCrosshairManager.remoteCrosshairs.has("user-a-1"));
    assert.ok(remoteCrosshairManager.remoteCrosshairs.has("user-b-1"));

    await remoteCrosshairManager.clear();
});

test("RemoteCrosshairManager clear with broadcast emits CROSSHAIR_CLEAR and clears remote crosshairs", async () => {
    await remoteCrosshairManager.clear();
    game.user.id = "gm-user";

    const emitted = [];
    const origEmit = socketlib.emit;
    socketlib.emit = (payload) => emitted.push(payload);

    await remoteCrosshairManager.clear({ broadcast: true });

    socketlib.emit = origEmit;

    const clearMsgs = emitted.filter((e) => e.type === "CROSSHAIR_CLEAR");
    assert.equal(clearMsgs.length, 1);
    assert.equal(clearMsgs[0].senderUserId, "gm-user");
});

test("RemoteCrosshairManager handles incoming CROSSHAIR_CLEAR message", async () => {
    await remoteCrosshairManager.clear();
    game.user.id = "player-user";
    game.settings.set(MODULE_ID, "enableCrosshairBroadcasting", true);
    game.settings.set(MODULE_ID, "showOtherPlayersCrosshairs", true);

    await remoteCrosshairManager.handleSocketMessage({
        type: "CROSSHAIR_START",
        placementId: "existing-placement",
        senderUserId: "wizard-user",
        shapeType: "circle",
        x: 100,
        y: 100,
        timeoutMs: 5000
    });

    assert.equal(remoteCrosshairManager.remoteCrosshairs.size, 1);

    await remoteCrosshairManager.handleSocketMessage({
        type: "CROSSHAIR_CLEAR",
        senderUserId: "gm-user"
    });

    assert.equal(remoteCrosshairManager.remoteCrosshairs.size, 0);
});

test("crosshair.clear delegates to remoteCrosshairManager.clear", async () => {
    await remoteCrosshairManager.clear();
    game.user.id = "player-user";
    game.settings.set(MODULE_ID, "enableCrosshairBroadcasting", true);
    game.settings.set(MODULE_ID, "showOtherPlayersCrosshairs", true);

    await remoteCrosshairManager.handleSocketMessage({
        type: "CROSSHAIR_START",
        placementId: "test-clear-delegation",
        senderUserId: "wizard-user",
        shapeType: "circle",
        x: 100,
        y: 100,
        timeoutMs: 5000
    });

    assert.equal(remoteCrosshairManager.remoteCrosshairs.size, 1);
    await crosshair.clear();
    assert.equal(remoteCrosshairManager.remoteCrosshairs.size, 0);
});

test("REGRESSION: RemoteCrosshairVisual.update sets container rotation in radians, zeroes spriteContainer, and passes degrees to Sequencer update", async () => {
    let updatedPayload = null;
    const mockEffect = {
        x: 0,
        y: 0,
        rotation: 0,
        container: { rotation: 0 },
        spriteContainer: { rotation: 1 },
        update: (payload) => { updatedPayload = payload; }
    };

    const origSequencer = globalThis.Sequencer;
    try {
        globalThis.Sequencer = {
            EffectManager: {
                getEffects: () => [mockEffect],
                endEffects: async () => {}
            }
        };

        const visual = new RemoteCrosshairVisual({
            placementId: "test-rotation-sync",
            senderUserId: "peer-user",
            shapeType: "cone",
            x: 100,
            y: 100,
            direction: 0
        });

        visual.update({
            originX: 150,
            originY: 250,
            direction: 180
        });

        const expectedRad = 180 * (Math.PI / 180);
        assert.equal(visual.rawDirection, 180);
        assert.equal(mockEffect.container.rotation, expectedRad, "Container rotation must be in radians (Math.PI)");
        assert.equal(mockEffect.spriteContainer.rotation, 0, "spriteContainer rotation must be zeroed to prevent double rotation");
        assert.equal(mockEffect.rotation, expectedRad, "Effect rotation property must be in radians");
        assert.ok(updatedPayload, "eff.update should have been called");
        assert.equal(updatedPayload.rotation, 180, "eff.update({ rotation }) must receive degrees (180)");
    } finally {
        globalThis.Sequencer = origSequencer;
    }
});
