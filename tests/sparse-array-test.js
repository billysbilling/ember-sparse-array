var SparseArray = require('../src/sparse-array');

var a,
    fixtures,
    loadCalls,
    willChanges,
    didChanges;

function fixturesLoad(offset, limit) {
    loadCalls.push([offset, limit]);
    return new Em.RSVP.Promise(function(resolve) {
        resolve({
            items: fixtures.slice(offset, offset+limit),
            total: fixtures.length
        });
    });
}

function createSparseArray(batchSize) {
    a = SparseArray.create({
        batchSize: batchSize,
        load: fixturesLoad
    });
    a.addArrayObserver(null, {
        willChange: function(array, start, removed, added) {
            willChanges.push([start, removed, added]);
        },
        didChange: function(array, start, removed, added) {
            didChanges.push([start, removed, added]);
        }
    });
}

QUnit.module('sparse-array', {
    setup: function() {
        fixtures = [];
        for (var i = 0; i < 100; i++) {
            fixtures.push(i);
        }

        loadCalls = [];
        willChanges = [];
        didChanges = [];
    },
    teardown: function() {
        a.destroy();
    }
});

test('calls load with offset=0 right away', function() {
    createSparseArray(33);
    deepEqual(loadCalls, [[0, 33]]);
});

asyncTest('Sets isLoaded', function() {
    createSparseArray(2);
    ok(!a.get('isLoaded'));
    setTimeout(function() {
        ok(a.get('isLoaded'));
        start();
    }, 0);
});

asyncTest('Sets length', function() {
    createSparseArray(2);
    equal(a.get('length'), 0);
    setTimeout(function() {
        equal(a.get('length'), 100);
        start();
    }, 0);
});

test('returns null for indexes out of bounds BEFORE items has been loaded', function() {
    createSparseArray(2);
    loadCalls = [];
    equal(a.objectAt(0), null);
    equal(a.objectAt(50), null);
    deepEqual(loadCalls, []);
});

asyncTest('returns null for indexes out of bounds AFTER items has been loaded', function() {
    createSparseArray(2);
    loadCalls = [];
    setTimeout(function() {
        equal(a.objectAt(100), null);
        deepEqual(loadCalls, []);
        start();
    }, 0);
});

asyncTest('returns correct value after it has been loaded', function() {
    createSparseArray(2);
    loadCalls = [];
    setTimeout(function() {
        equal(a.objectAt(0), 0);
        deepEqual(loadCalls, []);
        start();
    }, 0);
});

asyncTest('loads more values when requested', function() {
    createSparseArray(2);
    loadCalls = [];

    setTimeout(function() {
        equal(a.objectAt(2).get('isLoaded'), false);
        deepEqual(loadCalls, [[2, 2]]);
        loadCalls = [];

        setTimeout(function() {
            equal(a.objectAt(2), 2);
            deepEqual(loadCalls, []);
            start();
        }, 0);
    }, 0);
});

asyncTest('optimizes the offset to load', function() {
    createSparseArray(10);
    loadCalls = [];

    setTimeout(function() {
        equal(a.objectAt(12).get('isLoaded'), false);
        deepEqual(loadCalls, [[10, 10]], 'should load from 10, since up until 9 has already been loaded');
        loadCalls = [];

        setTimeout(function() {
            equal(a.objectAt(12), 12);
            deepEqual(loadCalls, []);
            start();
        }, 0);
    }, 0);
});

asyncTest('loads in the middle of the sparse array', function() {
    createSparseArray(10);
    loadCalls = [];

    setTimeout(function() {
        equal(a.objectAt(47).get('isLoaded'), false);
        deepEqual(loadCalls, [[42, 10]], 'should load from 42, since batchSize/2 is 5, and 47 - 5 is 42');
        loadCalls = [];

        setTimeout(function() {
            equal(a.objectAt(42), 42);
            deepEqual(loadCalls, []);
            start();
        }, 0);
    }, 0);
});

asyncTest('changes limit when it needs to, in order to load a smaller batch because of already loaded records on each side', function() {
    createSparseArray(10);
    loadCalls = [];

    setTimeout(function() {
        //Get #16, which will trigger a load of #11 through and including #20 (i.e. #10 is not loaded)  
        equal(a.objectAt(16).get('isLoaded'), false);
        deepEqual(loadCalls, [[11, 10]]);
        loadCalls = [];

        setTimeout(function() {
            //Now get #10  
            equal(a.objectAt(10).get('isLoaded'), false);
            deepEqual(loadCalls, [[10, 1]], 'all the items around #10 has already been loaded, so limit should be 1');
            loadCalls = [];

            setTimeout(function() {
                equal(a.objectAt(10), 10);
                deepEqual(loadCalls, []);
                start();
            }, 0);
        }, 0);
    }, 0);
});

asyncTest('when length increases', function() {
    createSparseArray(10);
    loadCalls = [];

    setTimeout(function() {
        fixtures.push(100);

        equal(a.objectAt(10).get('isLoaded'), false);
        deepEqual(loadCalls, [[10, 10]]);
        equal(a.get('length'), 100);
        loadCalls = [];

        setTimeout(function() {
            equal(a.get('length'), 101, 'Length should now have been increased');

            equal(a.objectAt(100).get('isLoaded'), false);
            deepEqual(loadCalls, [[95, 10]]);
            loadCalls = [];

            setTimeout(function() {
                equal(a.objectAt(100), 100);
                deepEqual(loadCalls, []);

                start();
            }, 0);
        }, 0);
    }, 0);
});

asyncTest('when length decreases', function() {
    createSparseArray(10);
    loadCalls = [];

    setTimeout(function() {
        fixtures.splice(50, 50);

        equal(a.objectAt(10).get('isLoaded'), false);
        deepEqual(loadCalls, [[10, 10]]);
        equal(a.get('length'), 100);
        loadCalls = [];

        setTimeout(function() {
            equal(a.get('length'), 50, 'Length should now have been decreased');

            equal(a.objectAt(50), null);
            deepEqual(loadCalls, []);

            start();
        }, 0);
    }, 0);
});

asyncTest('array observers when loading more', function() {
    createSparseArray(10);
    deepEqual(willChanges, []);
    deepEqual(didChanges, []);

    setTimeout(function() {
        deepEqual(willChanges, [[0, 0, 10], [10, 0, 90]]);
        deepEqual(didChanges, [[0, 0, 10], [10, 0, 90]]);
        willChanges = [];
        didChanges = [];

        a.objectAt(40);
        deepEqual(willChanges, []);
        deepEqual(didChanges, []);

        setTimeout(function() {
            deepEqual(willChanges, [[35, 10, 10]]);
            deepEqual(didChanges, [[35, 10, 10]]);

            start();
        }, 0);
    }, 0);
});

asyncTest('array observers when length increases by loading in the middle', function() {
    createSparseArray(10);

    setTimeout(function() {
        willChanges = [];
        didChanges = [];

        fixtures.pushObjects([100, 101, 102, 103, 104, 105, 106, 107]);
        //There are 108 items now

        a.objectAt(50);
        deepEqual(willChanges, []);
        deepEqual(didChanges, []);

        setTimeout(function() {
            deepEqual(willChanges, [[45, 10, 10], [100, 0, 8]]);
            deepEqual(didChanges, [[45, 10, 10], [100, 0, 8]]);

            start();
        }, 0);
    }, 0);
});

asyncTest('array observers when length increases by loading at the end', function() {
    createSparseArray(10);

    setTimeout(function() {
        willChanges = [];
        didChanges = [];

        fixtures.pushObjects([100, 101, 102, 103, 104, 105, 106, 107]);
        //There are 108 items now

        a.objectAt(99);
        deepEqual(willChanges, []);
        deepEqual(didChanges, []);

        setTimeout(function() {
            deepEqual(willChanges, [[94, 6, 10], [104, 0, 4]]);
            deepEqual(didChanges, [[94, 6, 10], [104, 0, 4]]);

            start();
        }, 0);
    }, 0);
});

asyncTest('array observers when length decreases by loading in the middle', function() {
    createSparseArray(10);

    setTimeout(function() {
        willChanges = [];
        didChanges = [];

        fixtures.splice(80, 20);
        //There are 80 items now

        a.objectAt(50);
        deepEqual(willChanges, []);
        deepEqual(didChanges, []);

        setTimeout(function() {
            deepEqual(willChanges, [[45, 10, 10], [80, 20, 0]]);
            deepEqual(didChanges, [[45, 10, 10], [80, 20, 0]]);

            start();
        }, 0);
    }, 0);
});

asyncTest('array observers when length decreases by loading at the end', function() {
    createSparseArray(10);

    setTimeout(function() {
        willChanges = [];
        didChanges = [];

        fixtures.splice(80, 20);
        //There are 80 items now

        a.objectAt(78);
        deepEqual(willChanges, []);
        deepEqual(didChanges, []);

        setTimeout(function() {
            deepEqual(willChanges, [[73, 7, 7], [80, 20, 0]]);
            deepEqual(didChanges, [[73, 7, 7], [80, 20, 0]]);

            start();
        }, 0);
    }, 0);
});