/**
 * CFX-036: Client-side Request Queue
 *
 * Goal: Prevent UI/transport thrash when users send multiple prompts quickly.
 *
 * - If a request is in-flight, additional sends are queued (FIFO by default)
 * - Supports priority items (e.g. "system" retries)
 * - Supports cancel current and clear queue
 * - Emits queue state changes for UI (queued count, inFlight)
 *
 * Integration (default): patches window.CortexChatDispatcher.send to be queued.
 *
 * NOTE: For true cancellation across transports, dispatcher implementations
 * should accept an AbortSignal (options.signal) and/or expose cancelRequest().
 */
(function () {
  'use strict';

  function now() { return Date.now(); }

  function rid() {
    return 'crq_' + now() + '_' + Math.random().toString(36).slice(2, 10);
  }

  function createEmitter() {
    var listeners = {};
    return {
      on: function (evt, fn) {
        if (!listeners[evt]) listeners[evt] = [];
        listeners[evt].push(fn);
      },
      off: function (evt, fn) {
        if (!listeners[evt]) return;
        listeners[evt] = listeners[evt].filter(function (f) { return f !== fn; });
      },
      emit: function (evt, payload) {
        var fns = listeners[evt] || [];
        for (var i = 0; i < fns.length; i++) {
          try { fns[i](payload); } catch (e) { /* best-effort */ }
        }
      }
    };
  }

  function normalizePriority(p) {
    if (typeof p === 'number') return p;
    if (p === 'system') return 100;
    if (p === 'retry') return 80;
    if (p === 'user' || p == null) return 0;
    return 0;
  }

  /**
   * @param {{send:Function, cancelRequest?:Function}} dispatcher
   */
  function RequestQueue(dispatcher, opts) {
    opts = opts || {};
    this._dispatcher = dispatcher;
    this._emitter = createEmitter();

    this._seq = 0;
    this._queue = [];
    this._current = null;

    this._debug = !!opts.debug;
  }

  RequestQueue.prototype._log = function () {
    if (!this._debug) return;
    try { console.log.apply(console, ['[request-queue]'].concat([].slice.call(arguments))); } catch (_) {}
  };

  RequestQueue.prototype.getState = function () {
    return {
      inFlight: !!this._current,
      currentId: this._current ? this._current.clientRequestId : null,
      queued: this._queue.length,
      queueIds: this._queue.map(function (x) { return x.clientRequestId; })
    };
  };

  RequestQueue.prototype.on = function (evt, fn) { this._emitter.on(evt, fn); };
  RequestQueue.prototype.off = function (evt, fn) { this._emitter.off(evt, fn); };

  RequestQueue.prototype._emitChange = function () {
    this._emitter.emit('change', this.getState());
  };

  RequestQueue.prototype._insertItem = function (item) {
    // Higher priority first; stable FIFO within same priority.
    var i = 0;
    while (i < this._queue.length) {
      var other = this._queue[i];
      if (item.priority > other.priority) break;
      i++;
    }
    this._queue.splice(i, 0, item);
    return i;
  };

  RequestQueue.prototype.send = function (message, callbacks, options) {
    callbacks = callbacks || {};
    options = options || {};

    var clientRequestId = options.clientRequestId || options.requestId || rid();
    var priority = normalizePriority(options.priority);

    var self = this;

    return new Promise(function (resolve) {
      var item = {
        seq: ++self._seq,
        message: message,
        callbacks: callbacks,
        options: options,
        clientRequestId: clientRequestId,
        priority: priority,
        resolve: resolve,
        abortController: (typeof AbortController !== 'undefined') ? new AbortController() : null,
        cancelled: false,
        startedAt: null
      };

      if (self._current) {
        var pos = self._insertItem(item);
        self._log('queued', clientRequestId, 'pos', pos, 'priority', priority);
        if (callbacks.onQueued) {
          try { callbacks.onQueued(pos + 1); } catch (_) {}
        }
        self._emitChange();
        return;
      }

      self._startItem(item);
    });
  };

  RequestQueue.prototype._wrapCallbacks = function (item) {
    var cb = item.callbacks || {};
    var self = this;

    function ok() {
      return self._current && self._current.clientRequestId === item.clientRequestId && !item.cancelled;
    }

    return {
      onStreamStart: function (data) {
        if (!ok()) return;
        if (cb.onStreamStart) cb.onStreamStart(data);
      },
      onChunk: function (chunk, index) {
        if (!ok()) return;
        if (cb.onChunk) cb.onChunk(chunk, index);
      },
      onDone: function (reply, meta) {
        if (!ok()) return;
        if (cb.onDone) cb.onDone(reply, meta);
      },
      onError: function (err) {
        if (!ok()) return;
        if (cb.onError) cb.onError(err);
      },
      onQueued: function (pos) {
        if (cb.onQueued) cb.onQueued(pos);
      }
    };
  };

  RequestQueue.prototype._startItem = function (item) {
    var self = this;
    this._current = item;
    item.startedAt = now();
    this._emitChange();

    // Propagate external cancellation into dispatcher via AbortSignal if supported.
    var mergedOptions = Object.assign({}, item.options || {});
    mergedOptions.clientRequestId = item.clientRequestId;
    mergedOptions.requestId = mergedOptions.requestId || item.clientRequestId;

    if (item.abortController) {
      mergedOptions.signal = item.abortController.signal;
    }

    var wrappedCallbacks = this._wrapCallbacks(item);

    var sendPromise;
    try {
      // dispatcher.send(message, callbacks, options)
      sendPromise = this._dispatcher.send(item.message, wrappedCallbacks, mergedOptions);
    } catch (e) {
      sendPromise = Promise.resolve({ reply: 'Dispatch error.', _error: true, _exception: e && e.message });
    }

    Promise.resolve(sendPromise)
      .then(function (result) {
        if (!self._current || self._current.clientRequestId !== item.clientRequestId) return;

        if (item.cancelled) {
          item.resolve({ reply: 'Request cancelled.', _aborted: true, clientRequestId: item.clientRequestId });
        } else {
          item.resolve(result);
        }
      })
      .catch(function (err) {
        if (!self._current || self._current.clientRequestId !== item.clientRequestId) return;
        if (item.cancelled) {
          item.resolve({ reply: 'Request cancelled.', _aborted: true, clientRequestId: item.clientRequestId });
        } else {
          item.resolve({ reply: (err && err.message) || 'Request failed.', _error: true, clientRequestId: item.clientRequestId });
        }
      })
      .finally(function () {
        if (!self._current || self._current.clientRequestId !== item.clientRequestId) return;
        self._current = null;
        self._emitChange();
        self._drain();
      });
  };

  RequestQueue.prototype._drain = function () {
    if (this._current) return;
    if (this._queue.length === 0) return;
    var next = this._queue.shift();
    this._startItem(next);
  };

  RequestQueue.prototype.cancelCurrent = function (opts) {
    opts = opts || {};
    if (!this._current) {
      if (opts.clearQueue) this.clearQueue();
      return false;
    }

    var item = this._current;
    item.cancelled = true;

    // Best-effort transport cancellation
    try {
      if (item.abortController) item.abortController.abort();
    } catch (_) {}

    try {
      if (this._dispatcher && typeof this._dispatcher.cancelRequest === 'function') {
        this._dispatcher.cancelRequest(item.clientRequestId);
      }
    } catch (_) {}

    if (opts.clearQueue) this.clearQueue();
    this._emitChange();
    return true;
  };

  RequestQueue.prototype.clearQueue = function () {
    this._queue = [];
    this._emitChange();
  };

  // ─────────────────────────────────────────────────────────────
  // Integration: patch dispatcher.send
  // ─────────────────────────────────────────────────────────────

  function integrateIfPossible() {
    if (!window.CortexChatDispatcher || !window.CortexChatDispatcher.send) return;
    if (window.CortexRequestQueue && window.CortexRequestQueue._integrated) return;

    var dispatcher = window.CortexChatDispatcher;
    var originalSend = dispatcher.send.bind(dispatcher);

    // Expose original for debugging
    dispatcher._sendUnqueued = dispatcher._sendUnqueued || originalSend;

    // Provide cancelRequest hook (optional)
    if (!dispatcher.cancelRequest && typeof dispatcher.cancel === 'function') {
      // Some dispatchers might already have cancel() API
      dispatcher.cancelRequest = dispatcher.cancel;
    }

    var queue = new RequestQueue({
      send: function (msg, cb, opts) {
        // Call the original send; tolerate 2-arg implementations.
        try {
          return originalSend(msg, cb, opts);
        } catch (e) {
          return originalSend(msg, cb);
        }
      },
      cancelRequest: dispatcher.cancelRequest ? dispatcher.cancelRequest.bind(dispatcher) : null
    }, { debug: !!window.__CFX036_DEBUG });

    // Patch send to be queued
    dispatcher.send = function (msg, cb, opts) {
      return queue.send(msg, cb, opts);
    };

    // Expose queue globally
    window.CortexRequestQueue = {
      _integrated: true,
      send: queue.send.bind(queue),
      cancelCurrent: queue.cancelCurrent.bind(queue),
      clearQueue: queue.clearQueue.bind(queue),
      getState: queue.getState.bind(queue),
      on: queue.on.bind(queue),
      off: queue.off.bind(queue)
    };

    // Emit initial state
    queue._emitChange();
  }

  // Try immediate integration
  integrateIfPossible();

  // If dispatcher is assigned later (e.g. WebRTC aliasing), retry a few times.
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    integrateIfPossible();
    if (window.CortexRequestQueue && window.CortexRequestQueue._integrated) {
      clearInterval(timer);
    } else if (tries > 40) {
      clearInterval(timer);
    }
  }, 100);

})();
