require("dotenv").config();

const isDev = process.env.NODE_ENV !== "production";

module.exports = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",

  mediasoup: {
    worker: {
      rtcMinPort: parseInt(process.env.RTC_MIN_PORT || "10000", 10),
      rtcMaxPort: parseInt(process.env.RTC_MAX_PORT || "10100", 10),
      logLevel: isDev ? "warn" : "error",
      logTags: ["ice", "dtls"],
    },
    router: {
      mediaCodecs: [
        { kind: "audio", mimeType: "audio/opus", clockRate: 48000, channels: 2 },
        { kind: "video", mimeType: "video/VP8", clockRate: 90000, parameters: { "x-google-start-bitrate": 1000 } },
        { kind: "video", mimeType: "video/H264", clockRate: 90000, parameters: { "packetization-mode": 1, "profile-level-id": "42e01f", "level-asymmetry-allowed": 1 } },
      ],
    },
  },

  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    ...(process.env.TURN_URL
      ? [{ urls: [process.env.TURN_URL], username: process.env.TURN_USERNAME || "", credential: process.env.TURN_CREDENTIAL || "" }]
      : isDev
      ? [
          { urls: ["turn:freestun.net:3478"], username: "free", credential: "free" },
          { urls: ["turns:freestun.net:5349"], username: "free", credential: "free" },
        ]
      : []),
  ],
};
