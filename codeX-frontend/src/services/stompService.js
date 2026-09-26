import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { terminalApi } from './api';

class StompCollaborationService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.subscriptions = new Map();
    this.clientId = 'client-' + Math.random().toString(36).substring(2, 9);
    this.pendingCodeChanges = new Map();
  }

  connect(roomCode, callbacks = {}) {
    this.disconnect();

    const isLocalHost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const isTauri =
      typeof window !== 'undefined' &&
      (window.__TAURI_INTERNALS__ || window.__TAURI__);

    const wsEndpoint =
      import.meta.env.VITE_WS_URL ||
      (isTauri || isLocalHost ? 'http://localhost:5010/ws' : '/ws');

    return new Promise((resolve, reject) => {
      this.client = new Client({
        webSocketFactory: () => new SockJS(wsEndpoint),
        reconnectDelay: 3000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        debug: (str) => {
          // console.debug('[STOMP]', str);
        },
      });

      this.client.onConnect = (frame) => {
        this.connected = true;

        // 1. Subscribe to Presence (Participants)
        const subPresence = this.client.subscribe(`/topic/room/${roomCode}/presence`, (message) => {
          try {
            const data = JSON.parse(message.body);
            if (callbacks.onPresence) callbacks.onPresence(data);
          } catch (e) {
            console.error('Error parsing presence message', e);
          }
        });
        this.subscriptions.set('presence', subPresence);

        // 2. Subscribe to File & Folder Tree changes
        const subTree = this.client.subscribe(`/topic/room/${roomCode}/tree`, (message) => {
          try {
            const data = JSON.parse(message.body);
            if (callbacks.onTreeChange) callbacks.onTreeChange(data);
          } catch (e) {
            console.error('Error parsing tree message', e);
          }
        });
        this.subscriptions.set('tree', subTree);

        // 3. Subscribe to Code Changes
        const subCode = this.client.subscribe(`/topic/room/${roomCode}/code`, (message) => {
          try {
            const data = JSON.parse(message.body);
            if (callbacks.onCodeChange) callbacks.onCodeChange(data);
          } catch (e) {
            console.error('Error parsing code message', e);
          }
        });
        this.subscriptions.set('code', subCode);

        // 4. Subscribe to Language changes
        const subLang = this.client.subscribe(`/topic/room/${roomCode}/language`, (message) => {
          try {
            const data = JSON.parse(message.body);
            if (callbacks.onLanguageChange) callbacks.onLanguageChange(data);
          } catch (e) {
            console.error('Error parsing language message', e);
          }
        });
        this.subscriptions.set('language', subLang);

        // 5. Subscribe to Title changes
        const subTitle = this.client.subscribe(`/topic/room/${roomCode}/title`, (message) => {
          try {
            const data = JSON.parse(message.body);
            if (callbacks.onTitleChange) callbacks.onTitleChange(data);
          } catch (e) {
            console.error('Error parsing title message', e);
          }
        });
        this.subscriptions.set('title', subTitle);

        // Notify join
        this.sendJoin(roomCode, callbacks.userName || 'Anonymous');

        if (callbacks.onConnected) callbacks.onConnected();
        resolve(this);
      };

      this.client.onStompError = (frame) => {
        console.error('STOMP Broker error: ' + frame.headers['message']);
        if (callbacks.onError) callbacks.onError(frame);
        reject(frame);
      };

      this.client.activate();
    });
  }

  sendJoin(roomCode, userName) {
    if (!this.connected || !this.client) return;
    this.client.publish({
      destination: `/app/room/${roomCode}/join`,
      body: JSON.stringify({
        roomCode,
        type: 'JOIN',
        senderId: this.clientId,
        senderName: userName,
      }),
    });
  }

  sendTreeChange(roomCode, type, fileTree, activeFileId, userName) {
    if (!this.connected || !this.client) return;

    // Sanitize tree items so large file contents don't blow WebSocket buffer limits
    const sanitizedTree = Array.isArray(fileTree)
      ? fileTree.map((item) => {
          if (item.content && item.content.length > 50000) {
            const { content, ...rest } = item;
            return rest;
          }
          return item;
        })
      : fileTree;

    this.client.publish({
      destination: `/app/room/${roomCode}/tree`,
      body: JSON.stringify({
        roomCode,
        type, // "TREE_UPDATE", "FILE_CREATE", "FILE_DELETE", "FILE_RENAME", "SYNC"
        fileTreeJson: JSON.stringify(sanitizedTree),
        activeFileId,
        senderId: this.clientId,
        senderName: userName,
      }),
    });
  }

  requestTreeSync(roomCode, userName) {
    if (!this.connected || !this.client) return;
    this.client.publish({
      destination: `/app/room/${roomCode}/tree/sync`,
      body: JSON.stringify({
        roomCode,
        type: 'SYNC',
        senderId: this.clientId,
        senderName: userName || 'Developer',
      }),
    });
  }

  sendCodeChange(roomCode, fileId, code, filePathOrOptions, maybeFileName) {
    if (!this.connected || !this.client) return;

    let filePath = null;
    let fileName = null;
    if (typeof filePathOrOptions === 'object' && filePathOrOptions !== null) {
      filePath = filePathOrOptions.filePath || null;
      fileName = filePathOrOptions.fileName || null;
    } else if (typeof filePathOrOptions === 'string') {
      filePath = filePathOrOptions;
      fileName = typeof maybeFileName === 'string' ? maybeFileName : null;
    }

    const key = `${roomCode}:${fileId || filePath || fileName}`;
    const now = Date.now();
    const entry = this.pendingCodeChanges.get(key) || { lastSendTime: 0, timer: null };

    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }

    const doPublish = () => {
      entry.timer = null;
      if (!this.connected || !this.client) return;
      try {
        this.client.publish({
          destination: `/app/room/${roomCode}/code`,
          body: JSON.stringify({
            roomCode,
            fileId,
            filePath,
            fileName,
            code,
            senderId: this.clientId,
          }),
        });
      } catch (err) {
        console.warn('[STOMP] sendCodeChange failed:', err);
      }
      entry.lastSendTime = Date.now();
    };

    // Throttle: maximum 1 packet per 60ms per file during rapid typing
    const elapsed = now - entry.lastSendTime;
    if (elapsed >= 60) {
      doPublish();
    } else {
      entry.timer = setTimeout(doPublish, 60 - elapsed);
    }

    this.pendingCodeChanges.set(key, entry);
  }

  sendLanguageChange(roomCode, language) {
    if (!this.connected || !this.client) return;
    this.client.publish({
      destination: `/app/room/${roomCode}/language`,
      body: JSON.stringify({
        roomCode,
        language,
        senderId: this.clientId,
      }),
    });
  }

  sendTitleChange(roomCode, title) {
    if (!this.connected || !this.client) return;
    this.client.publish({
      destination: `/app/room/${roomCode}/title`,
      body: JSON.stringify({
        roomCode,
        title,
        senderId: this.clientId,
      }),
    });
  }

  // --- Collaborative Native Terminal Methods ---

  subscribeTerminal(roomCode, onTerminalOutput) {
    if (!this.connected || !this.client) return null;
    this.unsubscribeTerminal();

    const sub = this.client.subscribe(`/topic/room/${roomCode}/terminal/output`, (message) => {
      try {
        const data = JSON.parse(message.body);
        if (onTerminalOutput) onTerminalOutput(data);
      } catch (e) {
        console.error('Error parsing terminal output message', e);
      }
    });

    this.subscriptions.set('terminal', sub);
    return sub;
  }

  unsubscribeTerminal() {
    const sub = this.subscriptions.get('terminal');
    if (sub) {
      try {
        sub.unsubscribe();
      } catch {}
      this.subscriptions.delete('terminal');
    }
  }

  sendTerminalInit(roomCode, userName) {
    if (!this.connected || !this.client) return;
    this.client.publish({
      destination: `/app/room/${roomCode}/terminal/init`,
      body: JSON.stringify({
        roomCode,
        senderUsername: userName || 'Developer',
        senderId: this.clientId,
      }),
    });
  }

  sendTerminalStart(roomCode, userName) {
    if (this.connected && this.client) {
      try {
        this.client.publish({
          destination: `/app/room/${roomCode}/terminal/start`,
          body: JSON.stringify({
            roomCode,
            senderUsername: userName || 'Developer',
            senderId: this.clientId,
          }),
        });
      } catch (err) {
        console.warn('[Terminal] STOMP start failed, calling REST:', err);
      }
    }
    // Also trigger REST for reliable start
    terminalApi.start(roomCode).catch(() => {});
  }

  sendTerminalStop(roomCode, userName) {
    if (this.connected && this.client) {
      try {
        this.client.publish({
          destination: `/app/room/${roomCode}/terminal/stop`,
          body: JSON.stringify({
            roomCode,
            senderUsername: userName || 'Developer',
            senderId: this.clientId,
          }),
        });
      } catch (err) {
        console.warn('[Terminal] STOMP stop failed, calling REST:', err);
      }
    }
    terminalApi.stop(roomCode).catch(() => {});
  }

  sendTerminalInput(roomCode, data, userName) {
    if (this.connected && this.client) {
      try {
        this.client.publish({
          destination: `/app/room/${roomCode}/terminal/input`,
          body: JSON.stringify({
            roomCode,
            data,
            senderUsername: userName || 'Developer',
            senderId: this.clientId,
          }),
        });
        return;
      } catch (err) {
        console.warn('[Terminal] STOMP input failed, falling back to REST:', err);
      }
    }
    // Fallback to direct REST API so keystrokes are never dropped
    terminalApi.sendInput(roomCode, data, userName).catch((err) => {
      console.error('[Terminal] REST sendInput error:', err);
    });
  }

  sendTerminalPermission(roomCode, allowTeammateInput, requestedBy) {
    if (!this.connected || !this.client) return;
    this.client.publish({
      destination: `/app/room/${roomCode}/terminal/permission`,
      body: JSON.stringify({
        roomCode,
        allowTeammateInput,
        requestedBy,
      }),
    });
  }

  getClientId() {
    return this.clientId;
  }

  disconnect() {
    if (this.subscriptions) {
      this.subscriptions.forEach((sub) => {
        try {
          sub.unsubscribe();
        } catch {}
      });
      this.subscriptions.clear();
    }

    if (this.client && this.connected) {
      try {
        this.client.deactivate();
      } catch {}
    }

    if (this.pendingCodeChanges) {
      this.pendingCodeChanges.forEach((entry) => {
        if (entry.timer) clearTimeout(entry.timer);
      });
      this.pendingCodeChanges.clear();
    }

    this.connected = false;
    this.client = null;
  }
}

export const stompService = new StompCollaborationService();
