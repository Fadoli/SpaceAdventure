import { expect, it } from 'bun:test';

it('does not reconnect after an intentional disconnect', async () => {
  const originalWebSocket = globalThis.WebSocket;
  const originalWindow = globalThis.window;
  let reconnects = 0;

  class FakeWebSocket {
    static OPEN = 1;
    static CONNECTING = 0;
    readyState = FakeWebSocket.OPEN;

    constructor() {
      reconnects++;
    }

    close() {
      this.onclose?.({ code: 1000, reason: 'closed' });
    }
  }

  globalThis.WebSocket = FakeWebSocket;
  globalThis.window = { location: { protocol: 'http:', host: 'example.test' } };

  try {
    const { GameSocket } = await import('../../src/client/js/socket.js');
    const socket = new GameSocket();
    socket.connect();
    socket.reconnectInterval = 1;
    socket.socket.onclose({ code: 1006, reason: 'network lost' });
    socket.disconnect();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(reconnects).toBe(1);
  } finally {
    if (originalWebSocket === undefined) delete globalThis.WebSocket;
    else globalThis.WebSocket = originalWebSocket;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

it('sends keepalive pings and accepts pongs', async () => {
  const originalWebSocket = globalThis.WebSocket;
  const originalWindow = globalThis.window;
  const sent = [];

  class FakeWebSocket {
    static OPEN = 1;
    static CONNECTING = 0;
    readyState = FakeWebSocket.OPEN;

    constructor() {
      this.send = (message) => {
        sent.push(JSON.parse(message));
        this.onmessage?.({ data: JSON.stringify({ type: 'PONG' }) });
      };
    }

    close() {
      this.readyState = 3;
      this.onclose?.({ code: 1000, reason: 'closed' });
    }
  }

  globalThis.WebSocket = FakeWebSocket;
  globalThis.window = { location: { protocol: 'http:', host: 'example.test' } };

  try {
    const { GameSocket } = await import('../../src/client/js/socket.js');
    const socket = new GameSocket();
    socket.keepAliveInterval = 5;
    socket.connect();
    socket.socket.onopen();
    await new Promise(resolve => setTimeout(resolve, 15));

    expect(sent.some(message => message.type === 'PING')).toBe(true);
    socket.disconnect();
  } finally {
    if (originalWebSocket === undefined) delete globalThis.WebSocket;
    else globalThis.WebSocket = originalWebSocket;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
