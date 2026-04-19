import React, { useEffect, useMemo, useRef, useState } from "react";
import io from "socket.io-client";

interface JoinProps {
  onJoin: (username: string) => void;
  darkMode?: boolean;
}

const simulatedChats = [
  { id: "c1", user: "maya", text: "Anyone online for the release check?", side: "left", delay: "0s", time: "09:12", status: "" },
  { id: "c2", user: "leo", text: "Yep, give me 2 mins. Booting laptop.", side: "right", delay: "0.7s", time: "09:13", status: "seen" },
  { id: "c3", user: "alex", text: "Theme update looks super clean.", side: "left", delay: "1.3s", time: "09:13", status: "" },
  { id: "c4", user: "riya", text: "Can we test dark mode once before push?", side: "right", delay: "2.1s", time: "09:14", status: "seen" },
  { id: "c5", user: "sam", text: "Typing indicator works now on my side.", side: "left", delay: "2.8s", time: "09:14", status: "" },
  { id: "c6", user: "nora", text: "Nice. I will verify on mobile too.", side: "right", delay: "3.6s", time: "09:15", status: "delivered" },
  { id: "c7", user: "maya", text: "Online count is updating in real time.", side: "left", delay: "4.2s", time: "09:16", status: "" },
  { id: "c8", user: "leo", text: "Join screen split layout feels better now.", side: "right", delay: "4.9s", time: "09:16", status: "seen" },
  { id: "c9", user: "alex", text: "Sidebar grain is subtle, not distracting.", side: "left", delay: "5.5s", time: "09:17", status: "" },
  { id: "c10", user: "riya", text: "I am in. DM me when ready to deploy.", side: "right", delay: "6.1s", time: "09:18", status: "seen" },
  { id: "c11", user: "sam", text: "Final smoke test running...", side: "left", delay: "6.7s", time: "09:18", status: "" },
  { id: "c12", user: "nora", text: "All good from me. Ship it.", side: "right", delay: "7.2s", time: "09:19", status: "sent" },
] as const;

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
  const [isJoining, setIsJoining] = useState(false);
  const joinTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    return () => {
      if (joinTimerRef.current) {
        window.clearTimeout(joinTimerRef.current);
      }
    };
  }, []);

  const onlineCount = useMemo(() => onlineUsers.length, [onlineUsers]);

  const handleJoin = () => {
    const nextUsername = username.trim();
    if (!nextUsername || isJoining) {
      return;
    }

    setIsJoining(true);
    joinTimerRef.current = window.setTimeout(() => {
      onJoin(nextUsername);
    }, 650);
  };

  return (
    <div
      className="join-layout"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "grid",
        gridTemplateColumns: "30% 70%",
        overflow: "hidden",
        background: darkMode
          ? "radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 28%), radial-gradient(circle at bottom right, rgba(16,185,129,0.14), transparent 24%), linear-gradient(135deg, #0b1020 0%, #121212 55%, #0a0a0a 100%)"
          : "radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 28%), radial-gradient(circle at bottom right, rgba(16,185,129,0.12), transparent 24%), linear-gradient(135deg, #eef4ff 0%, #f8fbff 52%, #edf1f7 100%)",
        color: darkMode ? "#f4f7fb" : "#132238",
      }}
    >
      <style>{`
        @keyframes joinSimMessage {
          0% {
            opacity: 0.25;
            transform: translateY(8px);
          }
          50% {
            opacity: 1;
            transform: translateY(0px);
          }
          100% {
            opacity: 0.25;
            transform: translateY(-8px);
          }
        }

        @keyframes joinLoaderSpin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 900px) {
          .join-layout {
            grid-template-columns: 1fr;
          }

          .join-sim-panel {
            display: none;
          }
        }
      `}</style>

      <aside
        className="join-sim-panel"
        style={{
          borderRight: darkMode
            ? "1px solid rgba(148, 163, 184, 0.2)"
            : "1px solid rgba(148, 163, 184, 0.28)",
          background: darkMode
            ? "rgba(15, 23, 42, 0.48)"
            : "rgba(255, 255, 255, 0.52)",
          padding: "1.4rem 1rem",
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          minHeight: 0,
          overflow: "hidden",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <div
          className="anonymous-pro-regular"
          style={{
            fontSize: "0.78rem",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            opacity: 0.72,
            marginBottom: "0.95rem",
          }}
        >
          Live Space Feed
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {simulatedChats.map((chat) => (
            <div
              key={chat.id}
              style={{
                alignSelf: chat.side === "left" ? "flex-start" : "flex-end",
                width: "min(92%, 240px)",
                borderRadius: 14,
                padding: "0.58rem 0.66rem",
                color: darkMode ? "#dbeafe" : "#1e3a8a",
                background: darkMode
                  ? "rgba(30, 41, 59, 0.75)"
                  : "rgba(255, 255, 255, 0.82)",
                border: darkMode
                  ? "1px solid rgba(147, 197, 253, 0.3)"
                  : "1px solid rgba(147, 197, 253, 0.45)",
                boxShadow: darkMode
                  ? "0 8px 24px rgba(15, 23, 42, 0.3)"
                  : "0 10px 26px rgba(37, 99, 235, 0.2)",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                animationName: "joinSimMessage",
                animationDuration: "6.5s",
                animationDelay: chat.delay,
                animationIterationCount: "infinite",
                animationTimingFunction: "ease-in-out",
              }}
            >
              <span
                className="anonymous-pro-regular"
                style={{
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                  textTransform: "uppercase",
                  opacity: 0.9,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>{chat.user}</span>
                <span style={{ opacity: 0.72 }}>{chat.time}</span>
              </span>
              <span
                className="nunito"
                style={{
                  fontSize: "0.75rem",
                  opacity: 0.92,
                  whiteSpace: "normal",
                  lineHeight: 1.25,
                }}
              >
                {chat.text}
              </span>
              {chat.side === "right" && chat.status && (
                <span
                  className="anonymous-pro-regular"
                  style={{
                    fontSize: "0.58rem",
                    letterSpacing: "0.03em",
                    textTransform: "uppercase",
                    opacity: 0.65,
                    alignSelf: "flex-end",
                  }}
                >
                  {chat.status}
                </span>
              )}
            </div>
          ))}
        </div>
      </aside>

      <div
        style={{
          position: "relative",
          display: "grid",
          placeItems: "center",
          minWidth: 0,
          minHeight: 0,
          padding: "1.2rem",
          backgroundColor: darkMode
            ? "rgba(17, 24, 39, 0.7)"
            : "rgba(255, 255, 255, 0.72)",
          backgroundImage: darkMode
            ? "radial-gradient(rgba(255,255,255,0.07) 0.8px, transparent 0.8px), radial-gradient(rgba(255,255,255,0.05) 0.8px, transparent 0.8px)"
            : "radial-gradient(rgba(0,0,0,0.1) 0.8px, transparent 0.8px), radial-gradient(rgba(0,0,0,0.07) 0.8px, transparent 0.8px)",
          backgroundSize: "3px 3px, 4px 4px",
          backgroundPosition: "0 0, 1px 1px",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <div
          style={{
            position: "relative",
            zIndex: 1,
            width: "min(100%, 520px)",
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
            className="bbh-bartle-regular"
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
            Socket Chat
          </div>

          <h2
            className="permanent-marker-regular"
            style={{
              margin: 0,
              fontSize: "clamp(2rem, 4vw, 3rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
            }}
          >
            Join the space
          </h2>

          <p
            className="anonymous-pro-regular"
            style={{
              margin: "0.75rem 0 1.5rem",
              fontSize: "0.98rem",
              lineHeight: 1.6,
              opacity: 0.82,
            }}
          >
            How should they call you?
          </p>

          <div style={{ display: "grid", gap: "0.85rem" }}>
            <input
              type="text"
              placeholder="Enter your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              autoFocus
              disabled={isJoining}
              style={{
                width: "100%",
                padding: "0.95rem 1rem",
                borderRadius: 16,
                border: darkMode
                  ? "1px solid rgba(148, 163, 184, 0.18)"
                  : "1px solid rgba(148, 163, 184, 0.28)",
                outline: "none",
                background: darkMode
                  ? "rgba(15, 23, 42, 0.72)"
                  : "rgba(255,255,255,0.72)",
                color: darkMode ? "#f8fafc" : "#132238",
                boxShadow: darkMode
                  ? "inset 0 1px 0 rgba(255,255,255,0.04)"
                  : "inset 0 1px 0 rgba(255,255,255,0.7)",
                opacity: isJoining ? 0.7 : 1,
              }}
            />

            <button
              onClick={handleJoin}
              className="anonymous-pro-regular"
              disabled={isJoining}
              style={{
                width: "100%",
                padding: "0.95rem 1rem",
                borderRadius: 16,
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
                letterSpacing: "0.01em",
                color: "#fff",
                background: "#2563eb",
                boxShadow: "0 14px 30px rgba(37,99,235,0.28)",
                textTransform: "uppercase",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.55rem",
                opacity: isJoining ? 0.9 : 1,
              }}
            >
              {isJoining && (
                <span
                  aria-hidden="true"
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.4)",
                    borderTopColor: "#ffffff",
                    animation: "joinLoaderSpin 0.75s linear infinite",
                  }}
                />
              )}
              {isJoining ? "Joining..." : "Join Space"}
            </button>
          </div>

          <div
            className="anonymous-pro-regular"
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

        <div
          className="anonymous-pro-regular"
          style={{
            position: "absolute",
            bottom: "1rem",
            fontSize: "0.76rem",
            opacity: 0.68,
            textAlign: "center",
            letterSpacing: "0.03em",
            zIndex: 2,
          }}
        >
          version : V1.0
        </div>
      </div>
    </div>
  );
};

export default Join;
