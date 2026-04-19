import React, { useEffect, useMemo, useRef, useState } from "react";
import io from "socket.io-client";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase.ts";

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
const adminAccessCode = import.meta.env.VITE_ADMIN_ACCESS_CODE?.trim() || "";

const Chat: React.FC<ChatProps> = ({
  username,
  darkMode = false,
  setDarkMode,
  onLogout,
}) => {
  const SIDEBAR_OPEN_WIDTH = 260;
  const SIDEBAR_COLLAPSED_WIDTH = 18;
  const isAdminUser = username === "aki";

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [activeChatUser, setActiveChatUser] = useState<string>("");
  const [typingSender, setTypingSender] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string>("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [adminAccessUnlocked, setAdminAccessUnlocked] = useState(
    () => window.localStorage.getItem("sockettalk_admin_unlocked") === "true"
  );
  const [adminAccessInput, setAdminAccessInput] = useState("");
  const [adminResetInProgress, setAdminResetInProgress] = useState(false);
  const [adminResetMessage, setAdminResetMessage] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<number | null>(null);
  const typingClearTimerRef = useRef<number | null>(null);

  const roomRef = useMemo(() => doc(db, "rooms", "global"), []);
  const messagesRef = useMemo(
    () => collection(db, "rooms", "global", "messages"),
    []
  );
  const membersRef = useMemo(
    () => collection(db, "rooms", "global", "members"),
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
  const sidebarExpanded = sidebarOpen;
  const sidebarWidth = sidebarExpanded
    ? SIDEBAR_OPEN_WIDTH
    : SIDEBAR_COLLAPSED_WIDTH;

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

  const handleAdminReset = async () => {
    const confirmed = window.confirm(
      "Reset room data? This will delete all messages and room members."
    );

    if (!confirmed) {
      return;
    }

    setAdminResetInProgress(true);
    setAdminResetMessage("");

    try {
      const messagesSnapshot = await getDocs(messagesRef);
      if (!messagesSnapshot.empty) {
        const batch = writeBatch(db);
        messagesSnapshot.docs.forEach((messageDoc) => {
          batch.delete(messageDoc.ref);
        });
        await batch.commit();
      }

      const membersSnapshot = await getDocs(membersRef);
      if (!membersSnapshot.empty) {
        const batch = writeBatch(db);
        membersSnapshot.docs.forEach((memberDoc) => {
          batch.delete(memberDoc.ref);
        });
        await batch.commit();
      }

      await setDoc(
        roomRef,
        {
          lastMessage: "",
          lastMessageAt: serverTimestamp(),
          lastMessageSender: "",
          activeCount: 0,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setAdminResetMessage("Room messages and members were reset.");
    } catch (err) {
      setAdminResetMessage(
        formatFirestoreError(err, "Reset failed. Check Firestore rules and config")
      );
    } finally {
      setAdminResetInProgress(false);
    }
  };

  const handleAdminUnlock = () => {
    if (!isAdminUser) {
      setAdminResetMessage("Admin settings are restricted to aki.");
      return;
    }

    if (!adminAccessCode) {
      setAdminResetMessage("Admin access is not configured on this build.");
      return;
    }

    if (adminAccessInput.trim() !== adminAccessCode) {
      setAdminResetMessage("Invalid admin code.");
      return;
    }

    window.localStorage.setItem("sockettalk_admin_unlocked", "true");
    setAdminAccessUnlocked(true);
    setAdminAccessInput("");
    setAdminResetMessage("Admin access unlocked.");
  };

  const handleAdminLock = () => {
    window.localStorage.removeItem("sockettalk_admin_unlocked");
    setAdminAccessUnlocked(false);
    setAdminResetInProgress(false);
    setAdminAccessInput("");
    setAdminResetMessage("");
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `${sidebarWidth}px 1fr`,
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
        background: darkMode
          ? "radial-gradient(circle at top left, rgba(59,130,246,0.08), transparent 28%), radial-gradient(circle at bottom right, rgba(16,185,129,0.06), transparent 24%), linear-gradient(135deg, #090d18 0%, #0d0f14 56%, #07080c 100%)"
          : "radial-gradient(circle at top left, rgba(59,130,246,0.12), transparent 30%), radial-gradient(circle at bottom right, rgba(16,185,129,0.08), transparent 26%), linear-gradient(135deg, #eef4ff 0%, #f8fbff 52%, #edf1f7 100%)",
        color: darkMode ? "#f0f0f0" : "#20242b",
        transition: "grid-template-columns 0.24s ease",
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
          backgroundColor: darkMode
            ? "rgba(10, 14, 24, 0.82)"
            : "rgba(255, 255, 255, 0.72)",
          backgroundImage: darkMode
            ? "radial-gradient(rgba(255,255,255,0.07) 0.8px, transparent 0.8px), radial-gradient(rgba(255,255,255,0.05) 0.8px, transparent 0.8px)"
            : "radial-gradient(rgba(0,0,0,0.1) 0.8px, transparent 0.8px), radial-gradient(rgba(0,0,0,0.07) 0.8px, transparent 0.8px)",
          backgroundSize: "3px 3px, 4px 4px",
          backgroundPosition: "0 0, 1px 1px",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          overflow: "hidden",
          position: "relative",
          transition: "padding 0.24s ease",
          paddingLeft: sidebarExpanded ? "1rem" : "0.2rem",
          paddingRight: sidebarExpanded ? "1rem" : "0.2rem",
        }}
      >
        <button
          onClick={() => {
            setAccountMenuOpen(false);
            setSidebarOpen((open) => !open);
          }}
          aria-label={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
          style={{
            position: "absolute",
            right: -13,
            top: 16,
            width: 26,
            height: 26,
            borderRadius: "50%",
            border: darkMode ? "1px solid #3a3a3a" : "1px solid #d1d9e8",
            cursor: "pointer",
            background: darkMode ? "#202020" : "#fff",
            color: darkMode ? "#f0f0f0" : "#20242b",
            zIndex: 30,
            display: "grid",
            placeItems: "center",
            boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
          }}
        >
          {sidebarExpanded ? "◀" : "▶"}
        </button>

        {sidebarExpanded && (
          <>
        <h2 className="bbh-bartle-regular" style={{ margin: 0 }}>Socket Chat</h2>
        <h3 className="anonymous-pro-regular" style={{ marginBottom: "0.25rem" }}>Chats</h3>
        <button
          className="nunito"
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
            <div className="nunito" style={{ opacity: 0.7, fontSize: "0.9rem" }}>
              No direct chats yet
            </div>
          )}
          {chatContacts.map((user) => {
            const online = isUserOnline(user);

            return (
              <button
                className="nunito"
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
                <span className="nunito">{user}</span>
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
            display: "flex",
            flexDirection: "column",
            gap: "0.85rem",
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
            <div className="anonymous-pro-regular" style={{ fontSize: "0.9rem", opacity: 0.8, minWidth: 0 }}>
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
                  className="anonymous-pro-regular"
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
              {isAdminUser && (
                <div
                  style={{
                    paddingTop: "0.35rem",
                    marginTop: "0.15rem",
                    borderTop: darkMode ? "1px solid #313131" : "1px solid #e4e9f2",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <div
                    className="anonymous-pro-regular"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                      fontSize: "0.76rem",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      opacity: 0.75,
                    }}
                  >
                    <span>Admin</span>
                    <span style={{ opacity: 0.6 }}>{adminAccessUnlocked ? "unlocked" : "restricted"}</span>
                  </div>

                  {!adminAccessUnlocked ? (
                    <>
                      <input
                        className="nunito"
                        type="password"
                        value={adminAccessInput}
                        onChange={(event) => setAdminAccessInput(event.target.value)}
                        placeholder="Admin passcode"
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          borderRadius: 8,
                          border: darkMode ? "1px solid #31384a" : "1px solid #cfd8e6",
                          background: darkMode ? "#0d1220" : "#fff",
                          color: darkMode ? "#f0f0f0" : "#20242b",
                          padding: "0.55rem 0.7rem",
                        }}
                      />
                      <button
                        className="anonymous-pro-regular"
                        onClick={handleAdminUnlock}
                        style={{
                          width: "100%",
                          border: "none",
                          borderRadius: 8,
                          padding: "0.58rem 0.75rem",
                          cursor: "pointer",
                          textAlign: "left",
                          background: darkMode ? "#243248" : "#e7eefc",
                          color: darkMode ? "#e9f0ff" : "#1f2b44",
                        }}
                      >
                        Unlock admin settings
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="anonymous-pro-regular"
                        onClick={handleAdminReset}
                        disabled={adminResetInProgress}
                        style={{
                          width: "100%",
                          border: "none",
                          borderRadius: 8,
                          padding: "0.58rem 0.75rem",
                          cursor: adminResetInProgress ? "not-allowed" : "pointer",
                          textAlign: "left",
                          background: darkMode ? "#3a1f1f" : "#ffe8e8",
                          color: darkMode ? "#ffd6d6" : "#8b1d1d",
                          opacity: adminResetInProgress ? 0.75 : 1,
                        }}
                      >
                        {adminResetInProgress ? "Resetting..." : "Reset room messages & members"}
                      </button>
                      <button
                        className="anonymous-pro-regular"
                        onClick={handleAdminLock}
                        style={{
                          width: "100%",
                          border: "none",
                          borderRadius: 8,
                          padding: "0.55rem 0.75rem",
                          cursor: "pointer",
                          textAlign: "left",
                          background: darkMode ? "#262626" : "#eef2f7",
                          color: darkMode ? "#f0f0f0" : "#20242b",
                        }}
                      >
                        Lock admin settings
                      </button>
                    </>
                  )}

                  {adminResetMessage && (
                    <div
                      className="nunito"
                      style={{
                        fontSize: "0.76rem",
                        color: darkMode ? "#9fe2b0" : "#166534",
                        lineHeight: 1.35,
                      }}
                    >
                      {adminResetMessage}
                    </div>
                  )}
                </div>
              )}
              {onLogout && (
                <button
                  className="anonymous-pro-regular"
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

          </>
        )}
      </aside>

      <main style={{ display: "grid", gridTemplateRows: "auto 1fr auto", minHeight: 0 }}>
        <div
          className="anonymous-pro-regular"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            padding: "0.85rem 1rem",
            fontSize: "0.9rem",
            opacity: 0.9,
            borderBottom: darkMode ? "1px solid #2a2a2a" : "1px solid #d8deea",
            background: darkMode
              ? "rgba(8, 12, 20, 0.86)"
              : "rgba(248, 251, 255, 0.8)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          {activeChatUser ? `Chatting with ${activeChatUser}` : "Global room messages"}
        </div>
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
            background: darkMode
              ? "rgba(6, 8, 14, 0.72)"
              : "rgba(247, 250, 255, 0.62)",
          }}
        >
          {activeChatUser && isOtherUserTyping && (
            <div
              className="nunito"
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
              className="nunito"
              style={{
                alignSelf: m.senderName === username ? "flex-end" : "flex-start",
                maxWidth: "70%",
              }}
            >
              <div className="nunito" style={{ fontSize: "0.75rem", opacity: 0.8, marginBottom: 4 }}>
                {m.senderName}
              </div>
              <div
                className="nunito"
                style={{
                  borderRadius: 12,
                  padding: "0.6rem 0.8rem",
                  background:
                    m.senderName === username
                      ? darkMode
                          ? "#0f2a3f"
                        : "#d6e9ff"
                      : darkMode
                        ? "#151821"
                      : "#ffffff",
                    border: darkMode ? "1px solid #252935" : "1px solid #dde3ef",
                }}
              >
                {m.text}
              </div>
              <div
                className="nunito"
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
            background: darkMode
              ? "rgba(8, 12, 20, 0.88)"
              : "rgba(255, 255, 255, 0.82)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <input
            className="nunito"
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
              border: darkMode ? "1px solid #242936" : "1px solid #ced7e7",
              padding: "0.6rem 0.75rem",
              background: darkMode ? "#0b0e15" : "#f8fbff",
              color: darkMode ? "#f0f0f0" : "#20242b",
            }}
          />
          <button
            className="nunito"
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
            className="nunito"
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
