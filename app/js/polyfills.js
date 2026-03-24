/**
 * CFX-008: Browser Polyfills
 * Essential polyfills for older browser compatibility
 */
(function() {
  'use strict';

  // Object.assign polyfill (IE support)
  if (typeof Object.assign !== 'function') {
    Object.assign = function(target) {
      if (target == null) {
        throw new TypeError('Cannot convert undefined or null to object');
      }

      var to = Object(target);

      for (var index = 1; index < arguments.length; index++) {
        var nextSource = arguments[index];

        if (nextSource != null) {
          for (var nextKey in nextSource) {
            if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
              to[nextKey] = nextSource[nextKey];
            }
          }
        }
      }
      return to;
    };
  }

  // Array.from polyfill
  if (!Array.from) {
    Array.from = (function() {
      var toStr = Object.prototype.toString;
      var isCallable = function(fn) {
        return typeof fn === 'function' || toStr.call(fn) === '[object Function]';
      };
      var toInteger = function(value) {
        var number = Number(value);
        if (isNaN(number)) { return 0; }
        if (number === 0 || !isFinite(number)) { return number; }
        return (number > 0 ? 1 : -1) * Math.floor(Math.abs(number));
      };
      var maxSafeInteger = Math.pow(2, 53) - 1;
      var toLength = function(value) {
        var len = toInteger(value);
        return Math.min(Math.max(len, 0), maxSafeInteger);
      };

      return function from(arrayLike/*, mapFn, thisArg */) {
        var C = this;
        var items = Object(arrayLike);
        if (arrayLike == null) {
          throw new TypeError('Array.from requires an array-like object - not null or undefined');
        }

        var mapFn = arguments.length > 1 ? arguments[1] : void undefined;
        var T;
        if (typeof mapFn !== 'undefined') {
          if (!isCallable(mapFn)) {
            throw new TypeError('Array.from: when provided, the second argument must be a function');
          }
          if (arguments.length > 2) {
            T = arguments[2];
          }
        }

        var len = toLength(items.length);
        var A = isCallable(C) ? Object(new C(len)) : new Array(len);
        var k = 0;
        var kValue;
        while (k < len) {
          kValue = items[k];
          if (mapFn) {
            A[k] = typeof T === 'undefined' ? mapFn(kValue, k) : mapFn.call(T, kValue, k);
          } else {
            A[k] = kValue;
          }
          k += 1;
        }
        A.length = len;
        return A;
      };
    }());
  }

  // Array.includes polyfill
  if (!Array.prototype.includes) {
    Array.prototype.includes = function(searchElement /*, fromIndex*/) {
      'use strict';
      var O = Object(this);
      var len = parseInt(O.length) || 0;
      if (len === 0) {
        return false;
      }
      var n = parseInt(arguments[1]) || 0;
      var k;
      if (n >= 0) {
        k = n;
      } else {
        k = len + n;
        if (k < 0) {k = 0;}
      }
      var currentElement;
      while (k < len) {
        currentElement = O[k];
        if (searchElement === currentElement ||
           (searchElement !== searchElement && currentElement !== currentElement)) { // NaN !== NaN
          return true;
        }
        k++;
      }
      return false;
    };
  }

  // String.includes polyfill
  if (!String.prototype.includes) {
    String.prototype.includes = function(search, start) {
      'use strict';
      if (typeof start !== 'number') {
        start = 0;
      }
      
      if (start + search.length > this.length) {
        return false;
      } else {
        return this.indexOf(search, start) !== -1;
      }
    };
  }

  // String.startsWith polyfill
  if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(searchString, position) {
      position = position || 0;
      return this.substr(position, searchString.length) === searchString;
    };
  }

  // String.endsWith polyfill
  if (!String.prototype.endsWith) {
    String.prototype.endsWith = function(searchString, length) {
      if (length === undefined || length > this.length) {
        length = this.length;
      }
      return this.substring(length - searchString.length, length) === searchString;
    };
  }

  // Promise polyfill (basic implementation)
  if (typeof Promise === 'undefined') {
    window.Promise = function(executor) {
      var self = this;
      self.state = 'pending';
      self.value = undefined;
      self.handlers = [];

      function resolve(result) {
        if (self.state === 'pending') {
          self.state = 'fulfilled';
          self.value = result;
          self.handlers.forEach(handle);
          self.handlers = null;
        }
      }

      function reject(error) {
        if (self.state === 'pending') {
          self.state = 'rejected';
          self.value = error;
          self.handlers.forEach(handle);
          self.handlers = null;
        }
      }

      function handle(handler) {
        if (self.state === 'pending') {
          self.handlers.push(handler);
        } else {
          if (self.state === 'fulfilled' && typeof handler.onFulfilled === 'function') {
            handler.onFulfilled(self.value);
          }
          if (self.state === 'rejected' && typeof handler.onRejected === 'function') {
            handler.onRejected(self.value);
          }
        }
      }

      this.then = function(onFulfilled, onRejected) {
        return new Promise(function(resolve, reject) {
          handle({
            onFulfilled: function(result) {
              try {
                if (typeof onFulfilled === 'function') {
                  resolve(onFulfilled(result));
                } else {
                  resolve(result);
                }
              } catch (ex) {
                reject(ex);
              }
            },
            onRejected: function(error) {
              try {
                if (typeof onRejected === 'function') {
                  resolve(onRejected(error));
                } else {
                  reject(error);
                }
              } catch (ex) {
                reject(ex);
              }
            }
          });
        });
      };

      this.catch = function(onRejected) {
        return this.then(null, onRejected);
      };

      executor(resolve, reject);
    };

    Promise.resolve = function(value) {
      return new Promise(function(resolve) {
        resolve(value);
      });
    };

    Promise.reject = function(reason) {
      return new Promise(function(resolve, reject) {
        reject(reason);
      });
    };
  }

  // fetch polyfill (basic implementation)
  if (!window.fetch) {
    window.fetch = function(url, options) {
      return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        options = options || {};

        xhr.open(options.method || 'GET', url, true);

        if (options.headers) {
          for (var key in options.headers) {
            xhr.setRequestHeader(key, options.headers[key]);
          }
        }

        xhr.onload = function() {
          var response = {
            ok: xhr.status >= 200 && xhr.status < 300,
            status: xhr.status,
            statusText: xhr.statusText,
            text: function() {
              return Promise.resolve(xhr.responseText);
            },
            json: function() {
              return Promise.resolve(JSON.parse(xhr.responseText));
            }
          };
          resolve(response);
        };

        xhr.onerror = function() {
          reject(new TypeError('Network request failed'));
        };

        xhr.send(options.body || null);
      });
    };
  }

  // requestAnimationFrame polyfill
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = function(callback) {
      return setTimeout(function() {
        callback(Date.now());
      }, 1000 / 60);
    };
  }

  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = function(id) {
      clearTimeout(id);
    };
  }

  // classList polyfill for older browsers
  if (!('classList' in document.createElement('_'))) {
    (function(view) {
      if (!('Element' in view)) return;

      var classListProp = 'classList',
          protoProp = 'prototype',
          elemCtrProto = view.Element[protoProp],
          objCtr = Object,
          strTrim = String[protoProp].trim || function() {
            return this.replace(/^\s+|\s+$/g, '');
          },
          arrIndexOf = Array[protoProp].indexOf || function(item) {
            var i = 0, len = this.length;
            for (; i < len; i++) {
              if (i in this && this[i] === item) {
                return i;
              }
            }
            return -1;
          },
          DOMTokenList = function(el) {
            this.el = el;
            var classes = el.className.replace(/^\s+|\s+$/g, '').split(/\s+/);
            for (var i = 0; i < classes.length; i++) {
              this.push(classes[i]);
            }
            this._updateClassName = function() {
              el.className = this.toString();
            };
          },
          DOMTokenListProto = DOMTokenList[protoProp] = [],
          DOMTokenListGetter = function() {
            return new DOMTokenList(this);
          };

      DOMTokenListProto.item = function(i) {
        return this[i] || null;
      };
      DOMTokenListProto.contains = function(token) {
        token += '';
        return arrIndexOf.call(this, token) !== -1;
      };
      DOMTokenListProto.add = function() {
        var tokens = arguments,
            i = 0,
            l = tokens.length,
            token,
            updated = false;
        do {
          token = tokens[i] + '';
          if (arrIndexOf.call(this, token) === -1) {
            this.push(token);
            updated = true;
          }
        }
        while (++i < l);

        if (updated) {
          this._updateClassName();
        }
      };
      DOMTokenListProto.remove = function() {
        var tokens = arguments,
            i = 0,
            l = tokens.length,
            token,
            updated = false;
        do {
          token = tokens[i] + '';
          var index = arrIndexOf.call(this, token);
          if (index !== -1) {
            this.splice(index, 1);
            updated = true;
          }
        }
        while (++i < l);

        if (updated) {
          this._updateClassName();
        }
      };
      DOMTokenListProto.toggle = function(token, force) {
        token += '';

        var result = this.contains(token),
            method = result ?
              force !== true && 'remove' :
              force !== false && 'add';

        if (method) {
          this[method](token);
        }

        if (force === true || force === false) {
          return force;
        } else {
          return !result;
        }
      };
      DOMTokenListProto.toString = function() {
        return this.join(' ');
      };

      if (objCtr.defineProperty) {
        var defineProperty = {
          get: DOMTokenListGetter,
          enumerable: true,
          configurable: false
        };
        try {
          objCtr.defineProperty(elemCtrProto, classListProp, defineProperty);
        } catch (ex) {
          if (ex.number === -0x7FF5EC54) {
            defineProperty.enumerable = false;
            objCtr.defineProperty(elemCtrProto, classListProp, defineProperty);
          }
        }
      } else if (objCtr[protoProp].__defineGetter__) {
        elemCtrProto.__defineGetter__(classListProp, DOMTokenListGetter);
      }
    }(window));
  }

  // CustomEvent polyfill
  if (!window.CustomEvent) {
    window.CustomEvent = function(event, params) {
      params = params || { bubbles: false, cancelable: false, detail: undefined };
      var evt = document.createEvent('CustomEvent');
      evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
      return evt;
    };
  }

  // EventTarget polyfill for older browsers
  if (!window.EventTarget) {
    window.EventTarget = function() {
      this.listeners = {};
    };

    EventTarget.prototype = {
      constructor: EventTarget,
      addEventListener: function(type, callback) {
        if (!(type in this.listeners)) {
          this.listeners[type] = [];
        }
        this.listeners[type].push(callback);
      },
      removeEventListener: function(type, callback) {
        if (!(type in this.listeners)) {
          return;
        }
        var stack = this.listeners[type];
        for (var i = 0, l = stack.length; i < l; i++) {
          if (stack[i] === callback) {
            stack.splice(i, 1);
            return;
          }
        }
      },
      dispatchEvent: function(event) {
        if (!(event.type in this.listeners)) {
          return true;
        }
        var stack = this.listeners[event.type];
        event.target = this;
        for (var i = 0, l = stack.length; i < l; i++) {
          stack[i].call(this, event);
        }
        return !event.defaultPrevented;
      }
    };
  }

  console.log('[polyfills] Browser compatibility polyfills loaded');

})();