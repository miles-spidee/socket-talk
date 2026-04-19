import React, { useEffect, useMemo, useState } from "react";
import io from "socket.io-client";

interface JoinProps {
  onJoin: (username: string) => void;
  darkMode?: boolean;
}

const isLocalHost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";
const localSocketUrl =
  import.meta.env.VITE_SOCKET_LOCAL_URL?.trim() || "http://localhost:5000";
const deployedSocketUrl = import.meta.env.VITE_SOCKET_URL?.trim();
const socketUrl =
  (isLocalHost ? localSocketUrl : deployedSocketUrl) || localSocketUrl;
const socket = io(socketUrl);

const Join: React.FC<JoinProps> = ({ onJoin, darkMode = false }) => {
  const [username, setUsername] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  useEffect(() => {
    socket.emit("get_online_users");

    const handleOnlineUsers = (users: string[]) => {
      setOnlineUsers(users);
    };

    socket.on("online_users", handleOnlineUsers);

    return () => {
      socket.off("online_users", handleOnlineUsers);
    };
  }, []);

  const onlineCount = useMemo(() => onlineUsers.length, [onlineUsers]);

  const handleJoin = () => {
    if (username.trim()) {
      onJoin(username.trim());
    }
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        background: darkMode
          ? "radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 28%), radial-gradient(circle at bottom right, rgba(16,185,129,0.14), transparent 24%), linear-gradient(135deg, #0b1020 0%, #121212 55%, #0a0a0a 100%)"
          : "radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 28%), radial-gradient(circle at bottom right, rgba(16,185,129,0.12), transparent 24%), linear-gradient(135deg, #eef4ff 0%, #f8fbff 52%, #edf1f7 100%)",
        color: darkMode ? "#f4f7fb" : "#132238",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(120deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01))",
          backdropFilter: "blur(22px)",
        }}
      />

      <div
        style={{
          position: "relative",
          width: "min(92vw, 460px)",
          padding: "2rem",
          borderRadius: 24,
          background: darkMode
            ? "rgba(15, 23, 42, 0.72)"
            : "rgba(255, 255, 255, 0.55)",
          border: darkMode
            ? "1px solid rgba(148, 163, 184, 0.18)"
            : "1px solid rgba(255, 255, 255, 0.6)",
          boxShadow: darkMode
            ? "0 24px 80px rgba(0,0,0,0.45)"
            : "0 24px 80px rgba(15, 23, 42, 0.15)",
          backdropFilter: "blur(22px)",
          WebkitBackdropFilter: "blur(22px)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "1rem",
            padding: "0.45rem 0.7rem",
            borderRadius: 999,
            background: darkMode
              ? "rgba(59,130,246,0.14)"
              : "rgba(59,130,246,0.1)",
            color: darkMode ? "#cfe1ff" : "#1d4ed8",
            fontSize: "0.85rem",
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          SocketTalk
        </div>

        <h2
          style={{
            margin: 0,
            fontSize: "clamp(2rem, 4vw, 3rem)",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
          }}
        >
          Join the room
        </h2>

        <p
          style={{
            margin: "0.75rem 0 1.5rem",
            fontSize: "0.98rem",
            lineHeight: 1.6,
            opacity: 0.82,
          }}
        >
          Pick a display name and jump into the shared chat space.
        </p>

        <div style={{ display: "grid", gap: "0.85rem" }}>
          <input
            type="text"
            placeholder="Enter your name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            autoFocus
            style={{
              width: "100%",
              padding: "0.95rem 1rem",
              borderRadius: 16,
              border: darkMode
                ? "1px solid rgba(148, 163, 184, 0.18)"
                : "1px solid rgba(148, 163, 184, 0.28)",
              outline: "none",
              background: darkMode ? "rgba(15, 23, 42, 0.72)" : "rgba(255,255,255,0.72)",
              color: darkMode ? "#f8fafc" : "#132238",
              boxShadow: darkMode
                ? "inset 0 1px 0 rgba(255,255,255,0.04)"
                : "inset 0 1px 0 rgba(255,255,255,0.7)",
            }}
          />

          <button
            onClick={handleJoin}
            style={{
              width: "100%",
              padding: "0.95rem 1rem",
              borderRadius: 16,
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              letterSpacing: "0.01em",
              color: "#fff",
              background:
                "linear-gradient(135deg, #2563eb 0%, #3b82f6 45%, #06b6d4 100%)",
              boxShadow: "0 14px 30px rgba(37,99,235,0.28)",
            }}
          >
            Join Chat
          </button>
        </div>

        <div
          style={{
            marginTop: "1rem",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.84rem",
            opacity: 0.82,
            textAlign: "center",
          }}
        >
          <span>users online</span>
          <span style={{ fontWeight: 700 }}>{onlineCount}</span>
        </div>
      </div>
    </div>
  );
};

export default Join;
