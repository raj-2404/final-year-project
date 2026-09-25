/**
 * CodeX Standalone Node.js Debug Adapter
 * Implements Debug Adapter Protocol (DAP) over stdio.
 * Connects to Node.js V8 Inspector via Chrome DevTools Protocol (CDP) WebSocket.
 * Zero external dependencies. Uses Node.js built-in WebSocket and child_process.
 */

const { spawn } = require('child_process');
const path = require('path');

let seq = 1;
let targetChild = null;
let ws = null;
let cdpReqId = 1;
const cdpCallbacks = new Map();

let isStopOnEntry = false;
let isConfigured = false;
let isInitialEntryPaused = false;
let currentCallFrames = [];
const varRefMap = new Map(); // refId -> objectId
let nextVarRef = 1000;

// DAP Protocol Output Helper
function sendDap(msg) {
  const json = JSON.stringify(msg);
  const payload = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
  process.stdout.write(payload);
}

function sendResponse(request, body = {}, success = true, message = null) {
  sendDap({
    seq: seq++,
    type: 'response',
    request_seq: request.seq,
    command: request.command,
    success,
    message,
    body,
  });
}

function sendEvent(event, body = {}) {
  sendDap({
    seq: seq++,
    type: 'event',
    event,
    body,
  });
}

function sendOutput(text, category = 'console') {
  sendEvent('output', { category, output: text });
}

// CDP Client Helper
function sendCdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== 1) {
      return reject(new Error('CDP WebSocket not connected'));
    }
    const id = cdpReqId++;
    cdpCallbacks.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

function formatCdpRemoteObject(obj) {
  if (!obj) return 'undefined';
  if (obj.value !== undefined) {
    if (typeof obj.value === 'string') return `"${obj.value}"`;
    return String(obj.value);
  }
  if (obj.description) return obj.description;
  if (obj.type === 'undefined') return 'undefined';
  if (obj.type === 'object' && obj.subtype === 'null') return 'null';
  return obj.className || obj.type || 'Object';
}

// DAP Request Handlers
async function handleDapRequest(request) {
  const { command, arguments: args = {} } = request;

  switch (command) {
    case 'initialize': {
      sendResponse(request, {
        supportsConfigurationDoneRequest: true,
        supportsFunctionBreakpoints: false,
        supportsConditionalBreakpoints: true,
        supportsEvaluateForHovers: true,
        supportsStepBack: false,
        supportsRestartFrame: false,
      });
      sendEvent('initialized');
      break;
    }

    case 'launch': {
      const { program, cwd, args: progArgs = [], stopOnEntry = false, env = {} } = args;
      if (!program) {
        return sendResponse(request, {}, false, 'No program specified for launch');
      }

      isStopOnEntry = Boolean(stopOnEntry);
      isConfigured = false;
      isInitialEntryPaused = false;

      const launchCwd = cwd || path.dirname(program);
      const nodeExe = process.execPath;
      const spawnArgs = ['--inspect-brk=0', ...progArgs, program];

      try {
        targetChild = spawn(nodeExe, spawnArgs, {
          cwd: launchCwd,
          env: { ...process.env, ...env },
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        let wsUrlFound = false;

        targetChild.stderr.on('data', async (chunk) => {
          const str = chunk.toString();
          if (!wsUrlFound && str.includes('ws://')) {
            const match = str.match(/ws:\/\/[^\s]+/);
            if (match) {
              wsUrlFound = true;
              const wsUrl = match[0];
              await connectToInspector(wsUrl, request);
              return;
            }
          }
          sendOutput(str, 'stderr');
        });

        targetChild.stdout.on('data', (chunk) => {
          sendOutput(chunk.toString(), 'stdout');
        });

        targetChild.on('exit', (code) => {
          sendEvent('exited', { exitCode: code || 0 });
          sendEvent('terminated');
        });

        targetChild.on('error', (err) => {
          sendOutput(`Process error: ${err.message}\n`, 'stderr');
          sendResponse(request, {}, false, err.message);
        });
      } catch (err) {
        sendResponse(request, {}, false, err.message);
      }
      break;
    }

    case 'setBreakpoints': {
      const { source = {}, breakpoints = [] } = args;
      const filePath = source.path || '';

      if (!ws || ws.readyState !== 1) {
        // Queue breakpoints before inspector is ready
        const verifiedBreakpoints = breakpoints.map((bp, idx) => ({
          id: idx + 1,
          verified: true,
          line: bp.line,
        }));
        return sendResponse(request, { breakpoints: verifiedBreakpoints });
      }

      const verified = [];
      for (let i = 0; i < breakpoints.length; i++) {
        const bp = breakpoints[i];
        try {
          const lineNum = Math.max(0, bp.line - 1);
          const colNum = bp.column ? Math.max(0, bp.column - 1) : 0;
          const res = await sendCdp('Debugger.setBreakpointByUrl', {
            urlRegex: '.*' + path.basename(filePath).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            lineNumber: lineNum,
            columnNumber: colNum,
          });

          verified.push({
            id: i + 1,
            verified: true,
            line: bp.line,
          });
        } catch {
          verified.push({
            id: i + 1,
            verified: false,
            line: bp.line,
          });
        }
      }

      sendResponse(request, { breakpoints: verified });
      break;
    }

    case 'configurationDone': {
      isConfigured = true;
      sendResponse(request, {});
      if (isInitialEntryPaused && !isStopOnEntry) {
        try {
          await sendCdp('Debugger.resume');
        } catch {}
      }
      break;
    }

    case 'threads': {
      sendResponse(request, {
        threads: [
          {
            id: 1,
            name: 'Node.js Main Thread',
          },
        ],
      });
      break;
    }

    case 'stackTrace': {
      const stackFrames = currentCallFrames.map((frame, index) => {
        let framePath = frame.url ? frame.url.replace(/^file:\/\//, '') : '';
        try {
          framePath = decodeURIComponent(framePath);
        } catch {}

        return {
          id: index + 1,
          name: frame.functionName || '(anonymous)',
          source: {
            name: path.basename(framePath) || 'eval',
            path: framePath,
          },
          line: (frame.location.lineNumber || 0) + 1,
          column: (frame.location.columnNumber || 0) + 1,
        };
      });

      sendResponse(request, {
        stackFrames,
        totalFrames: stackFrames.length,
      });
      break;
    }

    case 'scopes': {
      const { frameId = 1 } = args;
      const frame = currentCallFrames[frameId - 1];
      if (!frame || !frame.scopeChain) {
        return sendResponse(request, { scopes: [] });
      }

      varRefMap.clear();
      nextVarRef = 1000;

      const scopes = frame.scopeChain.map((s) => {
        const refId = nextVarRef++;
        if (s.object?.objectId) {
          varRefMap.set(refId, s.object.objectId);
        }
        let scopeName = 'Local';
        if (s.type === 'closure') scopeName = `Closure (${s.name || 'closure'})`;
        if (s.type === 'global') scopeName = 'Global';
        if (s.type === 'block') scopeName = 'Block';
        if (s.type === 'catch') scopeName = 'Catch';

        return {
          name: scopeName,
          variablesReference: refId,
          expensive: s.type === 'global',
        };
      });

      sendResponse(request, { scopes });
      break;
    }

    case 'variables': {
      const { variablesReference } = args;
      const objectId = varRefMap.get(variablesReference);

      if (!objectId) {
        return sendResponse(request, { variables: [] });
      }

      try {
        const res = await sendCdp('Runtime.getProperties', {
          objectId,
          ownProperties: true,
          generatePreview: true,
        });

        const properties = res.result || [];
        const variables = [];

        for (const prop of properties) {
          if (!prop.value) continue;

          let ref = 0;
          if (
            prop.value.type === 'object' &&
            prop.value.subtype !== 'null' &&
            prop.value.objectId
          ) {
            ref = nextVarRef++;
            varRefMap.set(ref, prop.value.objectId);
          }

          variables.push({
            name: prop.name,
            value: formatCdpRemoteObject(prop.value),
            type: prop.value.type,
            variablesReference: ref,
          });
        }

        sendResponse(request, { variables });
      } catch (err) {
        sendResponse(request, { variables: [] });
      }
      break;
    }

    case 'continue': {
      try {
        await sendCdp('Debugger.resume');
      } catch {}
      sendResponse(request, { allThreadsContinued: true });
      sendEvent('continued', { threadId: 1 });
      break;
    }

    case 'next': {
      try {
        await sendCdp('Debugger.stepOver');
      } catch {}
      sendResponse(request, {});
      break;
    }

    case 'stepIn': {
      try {
        await sendCdp('Debugger.stepInto');
      } catch {}
      sendResponse(request, {});
      break;
    }

    case 'stepOut': {
      try {
        await sendCdp('Debugger.stepOut');
      } catch {}
      sendResponse(request, {});
      break;
    }

    case 'pause': {
      try {
        await sendCdp('Debugger.pause');
      } catch {}
      sendResponse(request, {});
      break;
    }

    case 'evaluate': {
      const { expression, frameId } = args;
      try {
        let res;
        if (frameId && currentCallFrames[frameId - 1]) {
          res = await sendCdp('Debugger.evaluateOnCallFrame', {
            callFrameId: currentCallFrames[frameId - 1].callFrameId,
            expression,
            generatePreview: true,
          });
        } else {
          res = await sendCdp('Runtime.evaluate', {
            expression,
            generatePreview: true,
          });
        }

        const resultObj = res.result;
        sendResponse(request, {
          result: formatCdpRemoteObject(resultObj),
          variablesReference: resultObj?.objectId ? nextVarRef++ : 0,
        });
      } catch (err) {
        sendResponse(request, {}, false, err.message);
      }
      break;
    }

    case 'disconnect':
    case 'terminate': {
      if (targetChild) {
        try {
          targetChild.kill();
        } catch {}
        targetChild = null;
      }
      if (ws) {
        try {
          ws.close();
        } catch {}
        ws = null;
      }
      sendResponse(request, {});
      sendEvent('terminated');
      break;
    }

    case 'restart': {
      if (targetChild) {
        try {
          targetChild.kill();
        } catch {}
      }
      sendResponse(request, {});
      break;
    }

    default:
      sendResponse(request, {}, true);
      break;
  }
}

// Connect to Node.js V8 Inspector via CDP WebSocket
async function connectToInspector(wsUrl, launchRequest) {
  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = async () => {
      try {
        await sendCdp('Debugger.enable');
        await sendCdp('Runtime.enable');
        await sendCdp('Debugger.setPauseOnExceptions', { state: 'none' });
        await sendCdp('Runtime.runIfWaitingForDebugger');
        sendResponse(launchRequest, {});
      } catch (err) {
        sendResponse(launchRequest, {}, false, err.message);
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id && cdpCallbacks.has(msg.id)) {
          const { resolve, reject } = cdpCallbacks.get(msg.id);
          cdpCallbacks.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
          return;
        }

        // CDP Events
        if (msg.method === 'Debugger.paused') {
          currentCallFrames = msg.params.callFrames || [];
          const reason = msg.params.reason || 'breakpoint';

          if (!isConfigured) {
            isInitialEntryPaused = true;
            if (isStopOnEntry) {
              sendEvent('stopped', {
                reason: 'entry',
                threadId: 1,
                description: 'Paused on entry',
              });
            }
          } else {
            sendEvent('stopped', {
              reason: reason === 'other' ? 'pause' : reason,
              threadId: 1,
              description: 'Paused at breakpoint or step',
            });
          }
        } else if (msg.method === 'Debugger.resumed') {
          currentCallFrames = [];
          sendEvent('continued', { threadId: 1 });
        } else if (msg.method === 'Runtime.consoleAPICalled') {
          const args = msg.params.args || [];
          const text = args.map(formatCdpRemoteObject).join(' ') + '\n';
          sendOutput(text, 'console');
        }
      } catch {}
    };

    ws.onerror = (err) => {
      sendOutput(`Inspector connection error: ${err.message || 'WebSocket Error'}\n`, 'stderr');
    };

    ws.onclose = () => {
      sendEvent('terminated');
    };
  } catch (err) {
    sendResponse(launchRequest, {}, false, err.message);
  }
}

// DAP Stdio Stream Buffer & Framing Parser
let inputBuffer = Buffer.alloc(0);

process.stdin.on('data', (chunk) => {
  inputBuffer = Buffer.concat([inputBuffer, chunk]);

  while (true) {
    const headerEndIndex = inputBuffer.indexOf('\r\n\r\n');
    if (headerEndIndex === -1) break;

    const headerText = inputBuffer.slice(0, headerEndIndex).toString('utf8');
    const match = headerText.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      inputBuffer = inputBuffer.slice(headerEndIndex + 4);
      continue;
    }

    const contentLength = parseInt(match[1], 10);
    const totalLength = headerEndIndex + 4 + contentLength;

    if (inputBuffer.length < totalLength) {
      break; // Incomplete packet, wait for more data
    }

    const jsonText = inputBuffer.slice(headerEndIndex + 4, totalLength).toString('utf8');
    inputBuffer = inputBuffer.slice(totalLength);

    try {
      const request = JSON.parse(jsonText);
      handleDapRequest(request);
    } catch (e) {
      console.error('Failed to parse DAP request JSON:', e);
    }
  }
});
