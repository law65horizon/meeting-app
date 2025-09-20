const { getOrCreateRoom, getRoom, deleteRoom } = require("../mediasoup/roomManager");
const { getNextWorker } = require("../mediasoup/workerManager");
const os = require("os");
const config = require("../config");
const { closeRoom } = require("../firebase/utils");

/** Get the first non-loopback IPv4 address of this machine. */
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const info of iface) {
      if (info.family === "IPv4" && !info.internal) return info.address;
    }
  }
  return "127.0.0.1";
}

/**
 * Safely invoke a socket callback.
 * Guards against the client not sending one (optional cb pattern).
 */
function safeCb(cb, payload) {
  if (typeof cb === "function") cb(payload);
}

module.exports = (io, socket) => {
  // ── joinRoom ─────────────────────────────────────────────────────────────
  socket.on("joinRoom", async ({ roomId, rtpCapabilities, appUserId, appUserName }, cb) => {
    try {
      if (!roomId || !appUserId) return safeCb(cb, { error: "Missing roomId or appUserId" });

      const worker = getNextWorker();
      const room = await getOrCreateRoom(worker, roomId, socket.user);

      socket.data.roomId = roomId;
      socket.data.appUserId = appUserId;
      socket.join(roomId);

      const peer = {
        appUserId,
        appUserName: appUserName || "Guest",
        rtpCapabilities,
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
      };

      room.addPeer(socket.id, peer);

      const peers = [...room.peers.values()].map((p) => ({
        id: p.appUserId,
        name: p.appUserId === appUserId ? `You (${p.appUserName})` : p.appUserName,
      }));

      console.log(`[room] Peer ${socket.id} (uid=${appUserId}) joined room ${roomId}`);

      socket.broadcast.to(roomId).emit("peerJoined", {
        peerId: appUserId,
        peerUserName: appUserName,
        socketId: socket.id,
      });

      safeCb(cb, { rtpCapabilities: room.router.rtpCapabilities, peers });
    } catch (error) {
      console.error("[joinRoom] error:", error.message);
      safeCb(cb, { error: error.message });
    }
  });

  // ── createWebRtcTransport ─────────────────────────────────────────────────
  socket.on("createWebRtcTransport", async ({ roomId, direction }, cb) => {
    try {
      const room = getRoom(roomId);
      if (!room) return safeCb(cb, { error: "Room not found" });

      const localIp = getLocalIp();
      const announcedAddress = process.env.ANNOUNCED_IP || localIp;

      const transport = await room.router.createWebRtcTransport({
        listenInfos: [
          { protocol: "udp", ip: "0.0.0.0", announcedAddress },
          { protocol: "tcp", ip: "0.0.0.0", announcedAddress },
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate: 600_000,
      });

      transport.on("dtlsstatechange", (state) => {
        if (state === "failed" || state === "closed") {
          console.warn(`[transport] ${transport.id} DTLS ${state}`);
          transport.close();
        }
      });

      const peer = room.peers.get(socket.id);
      if (!peer) return safeCb(cb, { error: "Peer not found" });
      peer.transports.set(transport.id, transport);

      safeCb(cb, {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        iceServers: config.iceServers,
      });
    } catch (error) {
      console.error("[createWebRtcTransport] error:", error.message);
      safeCb(cb, { error: error.message });
    }
  });

  // ── connectTransport ──────────────────────────────────────────────────────
  socket.on("connectTransport", async ({ roomId, transportId, dtlsParameters }, cb) => {
    try {
      const room = getRoom(roomId);
      if (!room) return safeCb(cb, { error: "Room not found" });

      const peer = room.peers.get(socket.id);
      if (!peer) return safeCb(cb, { error: "Peer not found" });

      const transport = peer.transports.get(transportId);
      if (!transport) return safeCb(cb, { error: "Transport not found" });

      await transport.connect({ dtlsParameters });
      safeCb(cb, { connected: true });
    } catch (error) {
      console.error("[connectTransport] error:", error.message);
      safeCb(cb, { error: error.message });
    }
  });

  // ── produce ───────────────────────────────────────────────────────────────
  socket.on("produce", async ({ roomId, transportId, kind, rtpParameters, appData }, cb) => {
    try {
      const room = getRoom(roomId);
      if (!room) return safeCb(cb, { error: "Room not found" });

      const peer = room.peers.get(socket.id);
      if (!peer) return safeCb(cb, { error: "Peer not found" });

      const transport = peer.transports.get(transportId);
      if (!transport) return safeCb(cb, { error: "Transport not found" });

      const producer = await transport.produce({ kind, rtpParameters, appData: appData || {} });
      peer.producers.set(producer.id, producer);

      producer.on("transportclose", () => {
        producer.close();
        room.peers.get(socket.id)?.producers.delete(producer.id);
      });

      // Use server-stored appUserId — never trust client appData for identity
      const producerPeerAppId = peer.appUserId ?? socket.id;
      socket.broadcast.to(roomId).emit("newProducer", {
        producerId: producer.id,
        kind,
        appData: { ...(appData || {}), peerId: producerPeerAppId },
      });

      safeCb(cb, { id: producer.id });
    } catch (error) {
      console.error("[produce] error:", error.message);
      safeCb(cb, { error: error.message });
    }
  });

  // ── closeProducer ─────────────────────────────────────────────────────────
  socket.on("closeProducer", ({ roomId, producerId }, cb) => {
    try {
      const room = getRoom(roomId);
      if (!room) return safeCb(cb, { error: "Room not found" });

      const producers = room.peers.get(socket.id)?.producers;
      const producer = producers?.get(producerId);
      if (!producer) return safeCb(cb, { error: "Producer not found" });

      producer.close();
      producers.delete(producerId);
      socket.broadcast.to(roomId).emit("producerClosed", { producerId });
      safeCb(cb, { closed: true });
    } catch (error) {
      console.error("[closeProducer] error:", error.message);
      safeCb(cb, { error: error.message });
    }
  });

  // ── pauseProducer ─────────────────────────────────────────────────────────
  socket.on("pauseProducer", async ({ roomId, producerId }, cb) => {
    try {
      const room = getRoom(roomId);
      const producer = room?.peers.get(socket.id)?.producers.get(producerId);
      if (!producer) return safeCb(cb, { error: "Producer not found" });
      await producer.pause();
      safeCb(cb, { paused: true });
    } catch (error) {
      console.error("[pauseProducer] error:", error.message);
      safeCb(cb, { error: error.message });
    }
  });

  // ── resumeProducer ────────────────────────────────────────────────────────
  socket.on("resumeProducer", async ({ roomId, producerId }, cb) => {
    try {
      const room = getRoom(roomId);
      const producer = room?.peers.get(socket.id)?.producers.get(producerId);
      if (!producer) return safeCb(cb, { error: "Producer not found" });
      await producer.resume();
      safeCb(cb, { resumed: true });
    } catch (error) {
      console.error("[resumeProducer] error:", error.message);
      safeCb(cb, { error: error.message });
    }
  });

  // ── getProducers ──────────────────────────────────────────────────────────
  socket.on("getProducers", ({ roomId, clientRtpCapabilities }, cb) => {
    try {
      const room = getRoom(roomId);
      if (!room) return safeCb(cb, { error: "Room not found" });

      const myConsumers = room.peers.get(socket.id)?.consumers ?? new Map();

      for (const [peerId, peerInfo] of room.peers.entries()) {
        if (peerId === socket.id) continue;

        for (const [producerId, producer] of peerInfo.producers.entries()) {
          const alreadyConsuming = [...myConsumers.values()].some(
            (c) => c.producerId === producerId
          );
          if (alreadyConsuming) continue;

          if (!room.router.canConsume({ producerId, rtpCapabilities: clientRtpCapabilities })) {
            console.warn(`[getProducers] Cannot consume ${producerId} for ${socket.id}`);
            continue;
          }

          socket.emit("newProducer", {
            producerId,
            kind: producer.kind,
            appData: { ...(producer.appData || {}), peerId: peerInfo.appUserId ?? peerId },
          });
        }
      }
      safeCb(cb, {});
    } catch (error) {
      console.error("[getProducers] error:", error.message);
      safeCb(cb, { error: error.message });
    }
  });

  // ── consume ───────────────────────────────────────────────────────────────
  socket.on("consume", async ({ roomId, consumerTransportId, producerId, clientRtpCapabilities }, cb) => {
    try {
      const room = getRoom(roomId);
      if (!room) return safeCb(cb, { error: "Room not found" });

      const peerInfo = room.peers.get(socket.id);
      if (!peerInfo) return safeCb(cb, { error: "Peer not found" });

      if (!room.router.canConsume({ producerId, rtpCapabilities: clientRtpCapabilities })) {
        return safeCb(cb, { error: "Cannot consume" });
      }

      const transport = peerInfo.transports.get(consumerTransportId);
      if (!transport) return safeCb(cb, { error: "Transport not found" });

      const consumer = await transport.consume({
        producerId,
        rtpCapabilities: clientRtpCapabilities,
        paused: true, // always start paused; client resumes after binding
      });

      peerInfo.consumers.set(consumer.id, consumer);

      consumer.on("transportclose", () => {
        consumer.close();
        peerInfo.consumers.delete(consumer.id);
      });

      consumer.on("producerclose", () => {
        consumer.close();
        peerInfo.consumers.delete(consumer.id);
        socket.emit("consumerClosed", { consumerId: consumer.id, producerId });
      });

      safeCb(cb, {
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        appData: consumer.appData,
      });
    } catch (error) {
      console.error("[consume] error:", error.message);
      safeCb(cb, { error: error.message });
    }
  });

  // ── consumerResume ────────────────────────────────────────────────────────
  socket.on("consumerResume", async ({ roomId, consumerId }, cb) => {
    try {
      const room = getRoom(roomId);
      const consumer = room?.peers.get(socket.id)?.consumers.get(consumerId);
      if (!consumer) return safeCb(cb, { error: "Consumer not found" });
      await consumer.resume();
      safeCb(cb, { resumed: true });
    } catch (error) {
      console.error("[consumerResume] error:", error.message);
      safeCb(cb, { error: error.message });
    }
  });

  // ── requestKeyFrame ───────────────────────────────────────────────────────
  socket.on("requestKeyFrame", ({ roomId, consumerId }) => {
    const room = getRoom(roomId);
    if (!room) return;

    for (const peerInfo of room.peers.values()) {
      const c = peerInfo.consumers.get(consumerId);
      if (c) {
        c.requestKeyFrame().catch(() => {});
        break;
      }
    }
  });

  // ── sendMessage ───────────────────────────────────────────────────────────
  socket.on("sendMessage", ({ roomId, message }) => {
    try {
      const room = getRoom(roomId);
      if (!room) return;

      if (
        !message?.id ||
        !message?.senderId ||
        typeof message?.content !== "string" ||
        !message.content.trim()
      ) {
        console.warn(`[chat] Malformed message from ${socket.id}`);
        return;
      }

      const safe = {
        ...message,
        content: message.content.slice(0, 2000),
        // Always use the server-verified identity for the senderId
        senderId: room.peers.get(socket.id)?.appUserId ?? message.senderId,
      };

      console.log(`[chat] ${safe.senderName}: ${safe.content.slice(0, 60)}`);
      socket.broadcast.to(roomId).emit("chatMessage", safe);
    } catch (error) {
      console.error("[sendMessage] error:", error.message);
    }
  });

  // ── disconnect ────────────────────────────────────────────────────────────
  socket.on("disconnect", async () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = getRoom(roomId);
    if (!room) return;

    const peerInfo = room.peers.get(socket.id);
    if (!peerInfo) return;

    const producerIds = [...peerInfo.producers.keys()];

    room.removePeer(socket.id);
    console.log(`[room] Peer ${socket.id} (uid=${peerInfo.appUserId}) disconnected from room ${roomId}`);

    socket.broadcast.to(roomId).emit("peerLeft", {
      peerId: peerInfo.appUserId ?? socket.id,
      socketId: socket.id,
      producerIds,
    });

    // Close the room if empty or the host has left
    if (room.peers.size === 0) {
    // if (room.peers.size === 0 || peerInfo.appUserId === room.rules.host) {
      deleteRoom(roomId);
      await closeRoom(roomId).catch((e) =>
        console.error("[disconnect] closeRoom error:", e.message)
      );
    }
  });
};
