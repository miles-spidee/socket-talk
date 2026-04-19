import React, { useEffect, useMemo, useRef, useState } from "react";
import io from "socket.io-client";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";

interface ChatProps {
  username: string;
  darkMode?: boolean;
  setDarkMode?: (v: boolean) => void;
  onLogout?: () => void;
}

interface RoomMessage {
  id: string;
  senderName: string;
  text: string;
  recipientName?: string;
  createdAt?: { seconds?: number; toDate?: () => Date };
}

const formatFirestoreError = (err: unknown, fallback: string) => {
  if (
    err &&
    typeof err === "object" &&
    "code" in err &&
    typeof (err as { code?: unknown }).code === "string"
  ) {
    const code = (err as { code: string }).code;
    const message =
      "message" in err && typeof (err as { message?: unknown }).message === "string"
        ? (err as { message: string }).message
        : "";
    return message ? `${fallback} (${code}): ${message}` : `${fallback} (${code})`;
  }
  return fallback;
};

const formatMessageTime = (createdAt?: { seconds?: number; toDate?: () => Date }) => {
  if (!createdAt) {
    return "";
  }

  if (typeof createdAt.toDate === "function") {
    return createdAt.toDate().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (typeof createdAt.seconds === "number") {
    return new Date(createdAt.seconds * 1000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return "";
};

const isLocalHost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";
const localSocketUrl =
  import.meta.env.VITE_SOCKET_LOCAL_URL?.trim() || "http://localhost:5000";
const deployedSocketUrl = import.meta.env.VITE_SOCKET_URL?.trim();
const socketUrl =
  (isLocalHost ? localSocketUrl : deployedSocketUrl) || localSocketUrl;
const socket = io(socketUrl);

const Chat: React.FC<ChatProps> = ({
  username,
  darkMode = false,
  setDarkMode,
  onLogout,
}) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [activeChatUser, setActiveChatUser] = useState<string>("");
  const [typingSender, setTypingSender] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string>("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<number | null>(null);
  const typingClearTimerRef = useRef<number | null>(null);

  const roomRef = useMemo(() => doc(db, "rooms", "global"), []);
  const messagesRef = useMemo(
    () => collection(db, "rooms", "global", "messages"),
    []
  );
  const presenceRef = useMemo(() => doc(db, "presence", username), [username]);
  const memberRef = useMemo(
    () => doc(db, "rooms", "global", "members", username),
    [username]
  );

  useEffect(() => {
    socket.emit("join", username);
    socket.emit("get_online_users");

    const handleOnlineUsers = (users: string[]) => {
      setOnlineUsers(users);
    };

    socket.on("online_users", handleOnlineUsers);

    return () => {
      socket.off("online_users", handleOnlineUsers);
    };
  }, [username]);

  useEffect(() => {
    const handleTyping = (data: {
      sender: string;
      recipient: string;
      typing: boolean;
    }) => {
      const dmMatch =
        activeChatUser &&
        ((data.sender === activeChatUser && data.recipient === username) ||
          (data.sender === username && data.recipient === activeChatUser));

      if (dmMatch) {
        setTypingSender(data.typing ? data.sender : null);

        if (typingClearTimerRef.current) {
          window.clearTimeout(typingClearTimerRef.current);
          typingClearTimerRef.current = null;
        }

        if (data.typing) {
          typingClearTimerRef.current = window.setTimeout(() => {
            setTypingSender(null);
            typingClearTimerRef.current = null;
          }, 1300);
        }
      }
    };

    socket.on("typing", handleTyping);

    return () => {
      socket.off("typing", handleTyping);
    };
  }, [activeChatUser, username]);

  useEffect(() => {
    const q = query(messagesRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => {
          const raw = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            senderName: String(raw.senderName || raw.sender || "Unknown"),
            text: String(raw.text || raw.message || ""),
            recipientName:
              typeof raw.recipientName === "string"
                ? raw.recipientName
                : typeof raw.recipient === "string"
                ? raw.recipient
                : undefined,
            createdAt: raw.createdAt as { seconds?: number } | undefined,
          };
        });
        setMessages(data);
      },
      (err) => {
        setSendError(
          formatFirestoreError(err, "Could not read messages from Firestore")
        );
      }
    );
    return () => unsub();
  }, [messagesRef]);

  useEffect(() => {
    setDoc(
      roomRef,
      {
        name: "Global Room",
        description: "Public chat room",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch(() => undefined);

    setDoc(
      presenceRef,
      {
        isOnline: true,
        inRoom: true,
        roomId: "global",
        username,
        updatedAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
      },
      { merge: true }
    ).catch(() => undefined);

    setDoc(
      memberRef,
      {
        username,
        isOnline: true,
        joinedAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
      },
      { merge: true }
    ).catch(() => undefined);

    return () => {
      updateDoc(presenceRef, {
        isOnline: false,
        inRoom: false,
        updatedAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
      }).catch(() => undefined);

      updateDoc(memberRef, {
        isOnline: false,
        lastSeenAt: serverTimestamp(),
      }).catch(() => undefined);
    };
  }, [memberRef, presenceRef, roomRef, username]);

  useEffect(() => {
    if (!listRef.current) {
      return;
    }
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, activeChatUser]);

  useEffect(() => {
    setTypingSender(null);

    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    if (typingClearTimerRef.current) {
      window.clearTimeout(typingClearTimerRef.current);
      typingClearTimerRef.current = null;
    }

    socket.emit("typing", {
      sender: username,
      recipient: activeChatUser,
      typing: false,
    });
  }, [activeChatUser, username]);

  const visibleMessages = useMemo(() => {
    if (!activeChatUser) {
      return messages.filter((m) => !m.recipientName);
    }

    return messages.filter(
      (m) =>
        (m.senderName === username && m.recipientName === activeChatUser) ||
        (m.senderName === activeChatUser && m.recipientName === username)
    );
  }, [activeChatUser, messages, username]);

  const directMessageContacts = useMemo(() => {
    const contacts = new Set<string>();

    messages.forEach((m) => {
      if (!m.recipientName) {
        return;
      }

      if (m.senderName === username && m.recipientName !== username) {
        contacts.add(m.recipientName);
      }

      if (m.recipientName === username && m.senderName !== username) {
        contacts.add(m.senderName);
      }
    });

    return Array.from(contacts);
  }, [messages, username]);

  const chatContacts = useMemo(() => {
    const contacts = new Set<string>([
      ...directMessageContacts,
      ...onlineUsers.filter((user) => user !== username),
    ]);

    return Array.from(contacts).sort((left, right) =>
      left.localeCompare(right)
    );
  }, [directMessageContacts, onlineUsers, username]);

  const isUserOnline = (user: string) => onlineUsers.includes(user);
  const isOtherUserTyping = Boolean(typingSender && activeChatUser);

  const sendMessage = async () => {
    const text = message.trim();
    if (!text) {
      return;
    }

    if (activeChatUser) {
      socket.emit("typing", {
        sender: username,
        recipient: activeChatUser,
        typing: false,
      });
    }

    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    setSendError("");

    try {
      await addDoc(messagesRef, {
        senderName: username,
        senderId: username,
        recipientName: activeChatUser || null,
        text,
        type: "text",
        senderOnline: true,
        senderLastSeenAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      await updateDoc(roomRef, {
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
        lastMessageSender: activeChatUser
          ? `${username} -> ${activeChatUser}`
          : username,
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);

      setMessage("");
    } catch (err) {
      setSendError(
        formatFirestoreError(
          err,
          "Message failed to send. Check Firestore rules and config"
        )
      );
    }
  };

  const handleMessageChange = (value: string) => {
    setMessage(value);

    if (!activeChatUser) {
      return;
    }

    socket.emit("typing", {
      sender: username,
      recipient: activeChatUser,
      typing: true,
    });

    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = window.setTimeout(() => {
      socket.emit("typing", {
        sender: username,
        recipient: activeChatUser,
        typing: false,
      });
      typingTimerRef.current = null;
    }, 1000);
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "260px 1fr",
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
        background: darkMode ? "#141414" : "#f5f7fb",
        color: darkMode ? "#f0f0f0" : "#20242b",
      }}
    >
      <style>{`
        .typing-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: currentColor;
          display: inline-block;
          animation: typingPulse 1s infinite ease-in-out;
        }

        .typing-dot-1 {
          animation-delay: 0s;
        }

        .typing-dot-2 {
          animation-delay: 0.15s;
        }

        .typing-dot-3 {
          animation-delay: 0.3s;
        }

        @keyframes typingPulse {
          0%, 80%, 100% {
            transform: translateY(0);
            opacity: 0.45;
          }
          40% {
            transform: translateY(-3px);
            opacity: 1;
          }
        }
      `}</style>
      <aside
        style={{
          borderRight: darkMode ? "1px solid #2a2a2a" : "1px solid #d8deea",
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          minHeight: 0,
          minWidth: 0,
          background: darkMode ? "#171717" : "#ffffff",
        }}
      >
        <h2 style={{ margin: 0 }}>Socket Chat</h2>
        <h3 style={{ marginBottom: "0.25rem" }}>Chats</h3>
        <button
          onClick={() => setActiveChatUser("")}
          style={{
            border: "none",
            borderRadius: 8,
            padding: "0.5rem 0.6rem",
            cursor: "pointer",
            textAlign: "left",
            background: activeChatUser
              ? darkMode
                ? "#262626"
                : "#f4f7ff"
              : darkMode
              ? "#123047"
              : "#d6e9ff",
            color: darkMode ? "#f0f0f0" : "#20242b",
          }}
        >
          Global Room Chat
        </button>
        <div style={{ overflowY: "auto", minHeight: 0, minWidth: 0 }}>
          {chatContacts.length === 0 && (
            <div style={{ opacity: 0.7, fontSize: "0.9rem" }}>
              No direct chats yet
            </div>
          )}
          {chatContacts.map((user) => {
            const online = isUserOnline(user);

            return (
              <button
                key={user}
                onClick={() => setActiveChatUser(user)}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: 8,
                  padding: "0.55rem 0.65rem",
                  cursor: "pointer",
                  textAlign: "left",
                  marginBottom: "0.35rem",
                  fontSize: "0.95rem",
                  background:
                    activeChatUser === user
                      ? darkMode
                        ? "#123047"
                        : "#d6e9ff"
                      : darkMode
                      ? "#1c1c1c"
                      : "transparent",
                  color: darkMode ? "#f0f0f0" : "#20242b",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: online ? "#22c55e" : "#ef4444",
                    boxShadow: online ? "0 0 0 3px rgba(34,197,94,0.15)" : "0 0 0 3px rgba(239,68,68,0.12)",
                    flex: "0 0 auto",
                  }}
                />
                <span>{user}</span>
              </button>
            );
          })}
        </div>

        <div
          style={{
            marginTop: "auto",
            borderTop: darkMode ? "1px solid #2a2a2a" : "1px solid #e1e7f0",
            paddingTop: "0.9rem",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.5rem",
            }}
          >
            <div style={{ fontSize: "0.9rem", opacity: 0.8, minWidth: 0 }}>
              Logged in as {username}
            </div>
            <button
              onClick={() => setAccountMenuOpen((open) => !open)}
              aria-label="Account menu"
              style={{
                border: "none",
                borderRadius: 8,
                width: 34,
                height: 34,
                cursor: "pointer",
                background: darkMode ? "#2a2a2a" : "#eef2ff",
                color: darkMode ? "#f0f0f0" : "#20242b",
                flex: "0 0 auto",
                fontSize: "1.2rem",
                lineHeight: 1,
              }}
            >
              ⋮
            </button>
          </div>

          {accountMenuOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                bottom: "3.2rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                minWidth: 170,
                padding: "0.65rem",
                borderRadius: 12,
                background: darkMode ? "#222222" : "#fff",
                border: darkMode ? "1px solid #333" : "1px solid #d8deea",
                boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
                zIndex: 20,
              }}
            >
              {setDarkMode && (
                <button
                  onClick={() => {
                    setDarkMode(!darkMode);
                    setAccountMenuOpen(false);
                  }}
                  style={{
                    border: "none",
                    borderRadius: 8,
                    padding: "0.6rem 0.75rem",
                    cursor: "pointer",
                    textAlign: "left",
                    background: darkMode ? "#2b2b2b" : "#eef2ff",
                    color: darkMode ? "#f0f0f0" : "#20242b",
                  }}
                >
                  {darkMode ? "Light Mode" : "Dark Mode"}
                </button>
              )}
              {onLogout && (
                <button
                  onClick={() => {
                    setAccountMenuOpen(false);
                    onLogout();
                  }}
                  style={{
                    border: "none",
                    borderRadius: 8,
                    padding: "0.6rem 0.75rem",
                    cursor: "pointer",
                    textAlign: "left",
                    background: darkMode ? "#3a1f1f" : "#ffe3e3",
                    color: darkMode ? "#ffd6d6" : "#7f1d1d",
                  }}
                >
                  Logout
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      <main style={{ display: "grid", gridTemplateRows: "1fr auto", minHeight: 0 }}>
        <div
          ref={listRef}
          style={{
            overflowY: "auto",
            overflowX: "hidden",
            padding: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.65rem",
            minHeight: 0,
            minWidth: 0,
            background: darkMode ? "#141414" : "#f5f7fb",
          }}
        >
          <div style={{ fontSize: "0.9rem", opacity: 0.8 }}>
            {activeChatUser ? `Chatting with ${activeChatUser}` : "Global room messages"}
          </div>
          {activeChatUser && isOtherUserTyping && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                marginTop: "0.35rem",
                marginBottom: "0.55rem",
                padding: "0.45rem 0.65rem",
                width: "fit-content",
                borderRadius: 999,
                color: darkMode ? "#cfe0ff" : "#1d4ed8",
                background: darkMode ? "rgba(31, 41, 55, 0.9)" : "#e8efff",
                border: darkMode ? "1px solid #31415a" : "1px solid #bfd2ff",
              }}
            >
              <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                {typingSender}
              </span>
              <span style={{ fontSize: "0.85rem", opacity: 0.85 }}>
                is typing
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.28rem",
                  padding: "0.35rem 0.5rem",
                  borderRadius: 999,
                  background: darkMode ? "#111827" : "#dbeafe",
                }}
                aria-label={`${typingSender} is typing`}
              >
                <span className="typing-dot typing-dot-1" />
                <span className="typing-dot typing-dot-2" />
                <span className="typing-dot typing-dot-3" />
              </span>
            </div>
          )}
          {visibleMessages.map((m) => (
            <div
              key={m.id}
              style={{
                alignSelf: m.senderName === username ? "flex-end" : "flex-start",
                maxWidth: "70%",
              }}
            >
              <div style={{ fontSize: "0.75rem", opacity: 0.8, marginBottom: 4 }}>
                {m.senderName}
              </div>
              <div
                style={{
                  borderRadius: 12,
                  padding: "0.6rem 0.8rem",
                  background:
                    m.senderName === username
                      ? darkMode
                        ? "#123047"
                        : "#d6e9ff"
                      : darkMode
                      ? "#1f1f1f"
                      : "#ffffff",
                  border: darkMode ? "1px solid #2f2f2f" : "1px solid #dde3ef",
                }}
              >
                {m.text}
              </div>
              <div
                style={{
                  fontSize: "0.7rem",
                  opacity: 0.65,
                  marginTop: 3,
                  textAlign: m.senderName === username ? "right" : "left",
                }}
              >
                {formatMessageTime(m.createdAt)}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            borderTop: darkMode ? "1px solid #2a2a2a" : "1px solid #d8deea",
            padding: "0.9rem",
            display: "flex",
            gap: "0.5rem",
            minWidth: 0,
            background: darkMode ? "#171717" : "#ffffff",
          }}
        >
          <input
            type="text"
            value={message}
            onChange={(e) => handleMessageChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            onBlur={() => {
              if (!activeChatUser) {
                return;
              }

              socket.emit("typing", {
                sender: username,
                recipient: activeChatUser,
                typing: false,
              });
            }}
            placeholder={
              activeChatUser
                ? `Type a message to ${activeChatUser}`
                : "Type a message"
            }
            style={{
              flex: 1,
              borderRadius: 8,
              border: darkMode ? "1px solid #333" : "1px solid #ced7e7",
              padding: "0.6rem 0.75rem",
              background: darkMode ? "#101010" : "#f8fbff",
              color: darkMode ? "#f0f0f0" : "#20242b",
            }}
          />
          <button
            onClick={sendMessage}
            style={{
              border: "none",
              borderRadius: 8,
              padding: "0.6rem 1rem",
              cursor: "pointer",
              background: "#1f7aec",
              color: "#fff",
            }}
          >
            Send
          </button>
        </div>
        {sendError && (
          <div
            style={{
              padding: "0 0.9rem 0.8rem 0.9rem",
              color: "#d7263d",
              fontSize: "0.85rem",
            }}
          >
            {sendError}
          </div>
        )}
      </main>
    </div>
  );
};

export default Chat;
