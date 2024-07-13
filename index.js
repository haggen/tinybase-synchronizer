import { createServer } from "http";
import { WebSocketServer } from "ws";
import { createWsServer } from "tinybase/synchronizers/synchronizer-ws-server";

/**
 * @typedef {Object} Channel
 * @property {string} key
 * @property {WebSocketServer} webSocketServer
 * @property {import("tinybase/synchronizers/synchronizer-ws-server").WsServer} synchronizer
 */

const webServer = createServer();

/**
 * @type {Map<string, Channel>}
 */
const channels = new Map();

/**
 * @param {string} key
 * @returns {Channel}
 */
function createChannel(key) {
  const webSocketServer = new WebSocketServer({ noServer: true });
  const synchronizer = createWsServer(webSocketServer);

  return {
    key,
    webSocketServer,
    synchronizer,
  };
}

/**
 * @param {string} key
 * @returns {Channel}
 */
function acquireChannel(key) {
  if (!channels.has(key)) {
    channels.set(key, createChannel(key));
  }
  return channels.get(key);
}

/**
 * @param {string} key
 * @returns {void}
 */
function disposeChannel(key) {
  const channel = channels.get(key);

  if (!channel) {
    return;
  }

  if (channel.webSocketServer.clients.size > 0) {
    return;
  }

  channel.webSocketServer.close();
  channel.synchronizer.destroy();
  channels.delete(key);
}

webServer.on("upgrade", (request, socket, head) => {
  if (request.url === "/") {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }

  const channel = acquireChannel(request.url);

  channel.webSocketServer.handleUpgrade(request, socket, head, (client) => {
    client.on("close", () => {
      disposeChannel(request.url);
    });

    channel.webSocketServer.emit("connection", client, request);
  });
});

webServer.listen(5000);