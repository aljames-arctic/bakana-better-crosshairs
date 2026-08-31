import test from 'node:test';
import assert from 'node:assert/strict';
import '../setup.js';
import { injectSettingsHeaders } from '../../src/settings.js';
import { MODULE_ID } from '../../src/lib/constants.js';

class MockElement {
    constructor(tagName, attrs = {}) {
        this.tagName = tagName;
        this.className = attrs.className ?? '';
        this.dataset = attrs.dataset ?? {};
        this.name = attrs.name ?? '';
        this.children = [];
        this.parentNode = null;
        this.previousElementSibling = null;
        this.innerHTML = '';
        this.classList = {
            contains: (cls) => this.className.split(' ').includes(cls),
            add: (cls) => { if (!this.classList.contains(cls)) this.className = `${this.className} ${cls}`.trim(); }
        };
    }

    appendChild(child) {
        if (child.parentNode) {
            const oldIdx = child.parentNode.children.indexOf(child);
            if (oldIdx !== -1) child.parentNode.children.splice(oldIdx, 1);
        }
        if (this.children.length > 0) {
            child.previousElementSibling = this.children[this.children.length - 1];
        } else {
            child.previousElementSibling = null;
        }
        child.parentNode = this;
        this.children.push(child);
        return child;
    }

    insertBefore(newChild, refChild) {
        if (newChild.parentNode) {
            const oldIdx = newChild.parentNode.children.indexOf(newChild);
            if (oldIdx !== -1) newChild.parentNode.children.splice(oldIdx, 1);
        }
        const index = refChild ? this.children.indexOf(refChild) : -1;
        if (index === -1) {
            return this.appendChild(newChild);
        }
        newChild.parentNode = this;
        const prev = refChild.previousElementSibling;
        newChild.previousElementSibling = prev;
        refChild.previousElementSibling = newChild;
        this.children.splice(index, 0, newChild);
        return newChild;
    }

    closest(selector) {
        if (selector === '.form-group') {
            let curr = this;
            while (curr) {
                if (curr.classList?.contains('form-group')) return curr;
                curr = curr.parentNode;
            }
        }
        return null;
    }

    querySelector(selector) {
        const parts = selector.split(',').map(s => s.trim());
        const findMatch = (el) => {
            for (const part of parts) {
                if (part.startsWith('[name="') && part.endsWith('"]')) {
                    const expectedName = part.slice(7, -2);
                    if (el.name === expectedName) return el;
                }
                if (part.startsWith('[data-setting-id="') && part.endsWith('"]')) {
                    const expectedId = part.slice(18, -2);
                    if (el.dataset?.settingId === expectedId) return el;
                }
                if (part.startsWith('[data-key="') && part.endsWith('"]')) {
                    const expectedKey = part.slice(11, -2);
                    if (el.dataset?.key === expectedKey) return el;
                }
                if (part.includes('[data-scope="') && part.endsWith('"]')) {
                    const expectedScope = part.split('[data-scope="')[1].slice(0, -2);
                    if (el.dataset?.scope === expectedScope) return el;
                }
            }
            for (const child of el.children) {
                const found = findMatch(child);
                if (found) return found;
            }
            return null;
        };
        return findMatch(this);
    }
}

if (!globalThis.document) {
    globalThis.document = {
        createElement: (tagName) => new MockElement(tagName)
    };
}

test('injectSettingsHeaders inserts world, user, and client headers into BBC SettingsConfig DOM', () => {
    const origCreateElement = globalThis.document.createElement;
    globalThis.document.createElement = (tagName) => new MockElement(tagName);

    try {
        const root = new MockElement('div', { className: 'settings-list' });

        // World group (autorecMenu menu button)
        const fgWorld = new MockElement('div', { className: 'form-group' });
        const btnWorld = new MockElement('button', { dataset: { key: `${MODULE_ID}.autorecMenu` } });
        fgWorld.appendChild(btnWorld);
        root.appendChild(fgWorld);

        // User group (showOtherPlayersCrosshairs setting)
        const fgUser = new MockElement('div', { className: 'form-group' });
        const inputUser = new MockElement('input', { name: `${MODULE_ID}.showOtherPlayersCrosshairs` });
        fgUser.appendChild(inputUser);
        root.appendChild(fgUser);

        // Client group (logVerbosity)
        const fgClient = new MockElement('div', { className: 'form-group' });
        const inputClient = new MockElement('input', { name: `${MODULE_ID}.logVerbosity` });
        fgClient.appendChild(inputClient);
        root.appendChild(fgClient);

        // First injection
        injectSettingsHeaders(root);

        assert.equal(root.children.length, 6, 'Should have 3 headers and 3 form groups (total 6)');
        assert.equal(root.children[0].className, 'bbc-settings-section-header');
        assert.equal(root.children[0].dataset.scope, 'world');
        assert.equal(root.children[1], fgWorld);

        assert.equal(root.children[2].className, 'bbc-settings-section-header');
        assert.equal(root.children[2].dataset.scope, 'user');
        assert.equal(root.children[3], fgUser);

        assert.equal(root.children[4].className, 'bbc-settings-section-header');
        assert.equal(root.children[4].dataset.scope, 'client');
        assert.equal(root.children[5], fgClient);

        // Second injection (idempotency check)
        injectSettingsHeaders(root);
        assert.equal(root.children.length, 6, 'Should remain 6 items without duplicate headers');
    } finally {
        globalThis.document.createElement = origCreateElement;
    }
});

test('injectSettingsHeaders structures world settings, user setting, and moves logVerbosity to client settings', () => {
    const origCreateElement = globalThis.document.createElement;
    globalThis.document.createElement = (tagName) => new MockElement(tagName);

    try {
        const root = new MockElement('div', { className: 'settings-list' });

        // World menus
        const fgAutorecMenu = new MockElement('div', { className: 'form-group' });
        const btnAutorec = new MockElement('button', { dataset: { key: `${MODULE_ID}.autorecMenu` } });
        fgAutorecMenu.appendChild(btnAutorec);
        root.appendChild(fgAutorecMenu);

        const fgExchangeMenu = new MockElement('div', { className: 'form-group' });
        const btnExchange = new MockElement('button', { dataset: { key: `${MODULE_ID}.autorecExchangeMenu` } });
        fgExchangeMenu.appendChild(btnExchange);
        root.appendChild(fgExchangeMenu);

        // World setting
        const fgBroadcasting = new MockElement('div', { className: 'form-group' });
        const inputBroadcasting = new MockElement('input', { name: `${MODULE_ID}.enableCrosshairBroadcasting` });
        fgBroadcasting.appendChild(inputBroadcasting);
        root.appendChild(fgBroadcasting);

        // Suppose logVerbosity was placed before showOtherPlayersCrosshairs in DOM
        const fgLog = new MockElement('div', { className: 'form-group' });
        const inputLog = new MockElement('input', { name: `${MODULE_ID}.logVerbosity` });
        fgLog.appendChild(inputLog);
        root.appendChild(fgLog);

        // User setting
        const fgShowOther = new MockElement('div', { className: 'form-group' });
        const inputShowOther = new MockElement('input', { name: `${MODULE_ID}.showOtherPlayersCrosshairs` });
        fgShowOther.appendChild(inputShowOther);
        root.appendChild(fgShowOther);

        injectSettingsHeaders(root);

        // Expected DOM structure:
        // [0]: World Header
        // [1]: fgAutorecMenu (World Menu)
        // [2]: fgExchangeMenu (World Menu)
        // [3]: fgBroadcasting (World Setting)
        // [4]: User Header
        // [5]: fgShowOther (User Setting)
        // [6]: Client Header
        // [7]: fgLog (Client Setting relocated after showOtherPlayersCrosshairs!)
        assert.equal(root.children.length, 8);
        assert.equal(root.children[0].className, 'bbc-settings-section-header');
        assert.equal(root.children[0].dataset.scope, 'world');
        assert.equal(root.children[1], fgAutorecMenu);
        assert.equal(root.children[2], fgExchangeMenu);
        assert.equal(root.children[3], fgBroadcasting);

        assert.equal(root.children[4].className, 'bbc-settings-section-header');
        assert.equal(root.children[4].dataset.scope, 'user');
        assert.equal(root.children[5], fgShowOther, 'showOtherPlayersCrosshairs should be under User Settings');

        assert.equal(root.children[6].className, 'bbc-settings-section-header');
        assert.equal(root.children[6].dataset.scope, 'client');
        assert.equal(root.children[7], fgLog, 'logVerbosity should be relocated under Client Settings');
    } finally {
        globalThis.document.createElement = origCreateElement;
    }
});
