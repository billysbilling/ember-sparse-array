# Ember.js Sparse Array [![Build Status](https://travis-ci.org/billysbilling/billy-data-fixture-adapter.svg?branch=master)](https://travis-ci.org/billysbilling/billy-data-fixture-adapter)

A sparse array implementation to use in Ember.js projects. It automatically fetches items on-demand.

A common use-case is for extremely long lists, where it's not feasible to load all records into the browser.


## Instantiating a SparseArray

When instantiating a `SparseArray`, you have to supply a `load` method. The `load` method is responsible for fetching
a subset of the resource, e.g. from your server.

The `load` method must accept two arguments:

- `offset`: The 0-based index/offset of the first record to be fetched.
- `limit`: How many records should be fetched

The `load` method must return a thenable (i.e. a promise or another object with a `.then` method on it) that eventually
resolves with a hash with two keys:

- `total`: The total number of records.
- `items`: An array of maximum `limit` items that start at `offset`.

Here is an example:

```javascript
var SparseArray = require('sparse-array');

var comments = SparseArray.create({
    load: function(offset, limit) {
        return new Em.RSVP.Promise(function(resolve) {
            $.getJSON('/comments?offset='+offset+'&limit='+limit).then(function(payload) {
                resolve({
                    total: payload.meta.total,
                    items: payload.comments
                });
            });
        });
    }
});
```

The `SparseArray` will automatically call your `load` method when items at not-yet-loaded indexes are being requested by
your application.


## Using a SparseArray

The `length` attribute of your `SparseArray` works just like a normal array. It will start out as `0`. It will be set to
the value of `total` each time a promise from `load` resolves.

`load` is always called instantly with `offset` being `0` when you instantiate a `SparseArray`. This is to find the
`length` property right away.

The `SparseArray` also has a property called `isLoaded`, which is `false` until the first time a `load` completes,
where it will be set to `true`, and stay `true` forever.

Calling `.objectAt` at an index that's greater than or equals to the current `length`, will always return `null`. 

Example:

```javascript
var comments = SparseArray.create({
    load: function(offset, limit) {/* ... */}
});
comments.get('length'); //Will always be 0, since the data hasn't been loaded yet
comments.get('isLoaded'); //false
comments.objectAt(0); //null
comments.objectAt(9999999); //null

//Later, after the first load has completed:
comments.get('length'); //The `total` value that you resolved the promise with
comments.get('isLoaded'); //true
comments.objectAt(0); //Whatever you returned at the index 0
```

After the `load` method has completed at least once, and the array has a `length` property, requesting an index less
than `length`, will make the array fetch the items around that index using the `load` method, if the `index` has not 
been loaded yet.


## Notice about using {{each}} and other eager consumers

The `{{each}}` Handlebars helper is "eager", meaning that it will insert views for _all_ items right away. So when your
load promise resolves with a `total` value of 9000, it will create 9000 views right away, and request each of the 9000 
items from your array. This may result in _a lot_ of requests.

The real power of sparse arrays is when using them together with container views that only requests (i.e. calls
`.objectAt`) items that is supposed to be in the browser's current viewport. A good example is
[Ember.ListView](https://github.com/emberjs/list-view) (disclaimer: This sparse array implementation has not been tested
with Ember.ListView yet, but you get the idea).


## Options

You can set other options than the `load` method when instantiating `SparseArray`. Example:

```javascript
SparseArray.create({
    batchSize: 42,
    load: function() {/* ... */}
});
```

The following options are supported:

- `batchSize` (integer): The maximum number of records the sparse array will ask the `load` method to load through the `limit`
argument. The actual value of `limit` may be lower, since the sparse array will only load items that have not already
been loaded. Defaults to `100`.


## Known limitations

- Rejected promises from the `load` method are currently not handled.