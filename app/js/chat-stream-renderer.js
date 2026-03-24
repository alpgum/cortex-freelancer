/**
 * CF-093 — Fix chat streaming response not rendering incrementally
 * SSE streaming renderer — shows tokens as they arrive
 */
(function () {
  const ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  function createStreamRenderer(containerEl) {
    var buffer = '';
    var cursorEl = null;

    function init() {
      containerEl.textContent = '';
      cursorEl = document.createElement('span');
      cursorEl.className = 'stream-cursor';
      cursorEl.textContent = '▊';
      cursorEl.style.cssText = 'animation:blink .7s step-end infinite;opacity:.7;';
      containerEl.appendChild(cursorEl);
    }

    function appendText(chunk) {
      buffer += chunk;
      var textNode = document.createTextNode(chunk);
      containerEl.insertBefore(textNode, cursorEl);
      containerEl.scrollTop = containerEl.scrollHeight;
    }

    function finish() {
      if (cursorEl && cursorEl.parentNode) {
        cursorEl.parentNode.removeChild(cursorEl);
      }
      cursorEl = null;
      return buffer;
    }

    function getContent() {
      return buffer;
    }

    init();
    return { appendText: appendText, finish: finish, getContent: getContent };
  }

  function readSSEStream(response, onChunk, onDone, onError) {
    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var partialLine = '';

    function processLine(line) {
      if (line.startsWith('data: ')) {
        var data = line.slice(6);
        if (data === '[DONE]') return 'done';
        try {
          var parsed = JSON.parse(data);
          var text = '';
          if (parsed.delta && parsed.delta.text) {
            text = parsed.delta.text;
          } else if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
            text = parsed.choices[0].delta.content || '';
          } else if (parsed.content) {
            text = parsed.content;
          }
          if (text) onChunk(text);
        } catch (e) {
          // Non-JSON data line, treat as text
          if (data.trim()) onChunk(data);
        }
      }
    }

    function pump() {
      reader.read().then(function (result) {
        if (result.done) {
          if (partialLine) processLine(partialLine);
          onDone();
          return;
        }
        var text = decoder.decode(result.value, { stream: true });
        var lines = (partialLine + text).split('\n');
        partialLine = lines.pop();
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (line && processLine(line) === 'done') {
            reader.cancel();
            onDone();
            return;
          }
        }
        pump();
      }).catch(function (err) {
        onError(err);
      });
    }

    pump();
  }

  function streamChat(apiUrl, body, containerEl) {
    var renderer = createStreamRenderer(containerEl);

    return fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({}, body, { stream: true }))
    }).then(function (response) {
      if (!response.ok) {
        renderer.finish();
        throw new Error('Stream request failed: ' + response.status);
      }
      return new Promise(function (resolve, reject) {
        readSSEStream(
          response,
          function (chunk) { renderer.appendText(chunk); },
          function () { resolve(renderer.finish()); },
          function (err) { renderer.finish(); reject(err); }
        );
      });
    });
  }

  ns.ChatStreamRenderer = {
    createStreamRenderer: createStreamRenderer,
    readSSEStream: readSSEStream,
    streamChat: streamChat
  };
})();
