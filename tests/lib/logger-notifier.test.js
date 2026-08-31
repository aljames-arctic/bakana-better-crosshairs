import '../setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { log } from '../../src/lib/logger.js';
import { notify } from '../../src/lib/notifier.js';

test('logger verbosity check and grouping interface contracts', () => {
    log.setVerbosity(3);

    // Ensure grouping and standard log levels do not throw and maintain internal stack
    log.group('Test Group');
    log.info('Inside group');
    log.groupEnd();

    assert.doesNotThrow(() => {
        log.error('Error log');
        log.warn('Warning log');
        log.debug('Debug log');
    });
});

test('log.group and log.groupEnd respect verbosity levels and lazily open groups on first log execution', () => {
    const groups = [];
    const origGroup = console.group;
    const origGroupCollapsed = console.groupCollapsed;
    const origGroupEnd = console.groupEnd;

    console.group = (...args) => groups.push({ type: 'start', args });
    console.groupCollapsed = (...args) => groups.push({ type: 'start', args });
    console.groupEnd = () => groups.push({ type: 'end' });

    try {
        // 1. When verbosity is 'warn', 'debug' group is suppressed even if debug message is called
        log.setVerbosity('warn');
        log.group('Suppressed debug group', 'debug');
        log.debug('Debug message while warn verbosity');
        log.groupEnd();
        assert.equal(groups.length, 0, 'Debug groups should not trigger console.group when verbosity is warn');

        // 2. When verbosity is 'debug', 'debug' group is logged IF a debug message executes
        log.setVerbosity('debug');
        log.group('Active debug group', 'debug');
        log.debug('Active debug message');
        log.groupEnd();
        assert.equal(groups.length, 2, 'Debug group should trigger console.group and console.groupEnd when debug message executes');
        assert.equal(groups[0].type, 'start');
        assert.ok(groups[0].args[0].includes('Active debug group'));
        assert.ok(groups[0].args[1].includes('#38bdf8'), 'Debug group should have teal highlight');
        assert.equal(groups[1].type, 'end');

        // 3. When verbosity is 'debug' but NO log message executes, group is NOT started (no empty groups)
        groups.length = 0;
        log.group('Empty debug group', 'debug');
        log.groupEnd();
        assert.equal(groups.length, 0, 'Empty debug group with no logs must not trigger console.group');
    } finally {
        console.group = origGroup;
        console.groupCollapsed = origGroupCollapsed;
        console.groupEnd = origGroupEnd;
        log.setVerbosity('warn');
    }
});

test('notifier queues and flushes notifications without errors', async () => {
    assert.doesNotThrow(() => {
        notify.info('Test Info Notification');
        notify.warn('Test Warn Notification');
        notify.error('Test Error Notification');
    });
});
