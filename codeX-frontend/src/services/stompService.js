import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

class StompCollaborationService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.subscriptions = new Map();
    this.clientId = 'client-' + Math.random().toString(36).substring(2, 9);
  }

  connect(roomCode, callbacks = {}) {
    this.disconnect();

    return new Promise((resolve, reject) => {
      this.client = new Client({
        webSocketFactory: () => new SockJS('/ws'),
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
    this.client.publish({
      destination: `/app/room/${roomCode}/tree`,
      body: JSON.stringify({
        roomCode,
        type, // "TREE_UPDATE", "FILE_CREATE", "FILE_DELETE", "FILE_RENAME", "SYNC"
        fileTreeJson: JSON.stringify(fileTree),
        activeFileId,
        senderId: this.clientId,
        senderName: userName,
      }),
    });
  }

  sendCodeChange(roomCode, fileId, code) {
    if (!this.connected || !this.client) return;
    this.client.publish({
      destination: `/app/room/${roomCode}/code`,
      body: JSON.stringify({
        roomCode,
        fileId,
        code,
        senderId: this.clientId,
      }),
    });
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

    this.connected = false;
    this.client = null;
  }
}

export const stompService = new StompCollaborationService();
