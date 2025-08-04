import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

// Settings icon SVG
const SettingsIcon = ({ onClick }: { onClick: () => void }) => (
  <svg
    onClick={onClick}
    width="28"
    height="28"
    viewBox="0 0 24 24"
    style={{ cursor: "pointer", marginLeft: "8px", fill: "#888" }}
  >
    <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7zm7.43-2.27l1.77-1.02a.5.5 0 0 0 .18-.68l-1.68-2.91a.5.5 0 0 0-.61-.22l-2.08.8a7.03 7.03 0 0 0-1.51-.88l-.32-2.19a.5.5 0 0 0-.5-.42h-3.36a.5.5 0 0 0-.5.42l-.32 2.19c-.54.22-1.05.51-1.51.88l-2.08-.8a.5.5 0 0 0-.61.22l-1.68 2.91a.5.5 0 0 0 .18.68l1.77 1.02c-.04.32-.07.65-.07.98s.03.66.07.98l-1.77 1.02a.5.5 0 0 0-.18.68l1.68 2.91a.5.5 0 0 0 .61.22l2.08-.8c.46.37.97.66 1.51.88l.32 2.19a.5.5 0 0 0 .5.42h3.36a.5.5 0 0 0 .5-.42l.32-2.19c.54-.22 1.05-.51 1.51-.88l2.08.8a.5.5 0 0 0 .61-.22l1.68-2.91a.5.5 0 0 0-.18-.68l-1.77-1.02c.04-.32.07-.65.07-.98s-.03-.66-.07-.98z"/>
  </svg>
);

// Default user icon SVG
const DefaultUserIcon = () => (
  <svg
    width="40"
    height="40"
    viewBox="0 0 40 40"
    style={{ borderRadius: "50%" }}
  >
    <circle cx="20" cy="20" r="20" fill="#ddd" />
    <circle cx="20" cy="16" r="8" fill="#bbb" />
    <ellipse cx="20" cy="30" rx="12" ry="7" fill="#bbb" />
  </svg>
);

interface Message {
  message: string;
  self: boolean;
  time: string;
  sender: string;
}

interface ChatProps {
  username: string;
  chatUser: string;
  goBack: () => void;
  onSelectUser: (user: string) => void;
  darkMode?: boolean;
  setDarkMode?: (v: boolean) => void;
}

const socket = io("http://localhost:5000");

const Chat: React.FC<ChatProps> = ({
  username,
  chatUser,
  goBack,
  onSelectUser,
  darkMode = false,
  setDarkMode,
}) => {
  const [message, setMessage] = useState<string>("");
  const [chat, setChat] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [recentChats, setRecentChats] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on "/" key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (chatUser && e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [chatUser]);

  // Register username with server on mount
  useEffect(() => {
    if (username) {
      socket.emit("join", username);
    }
    // Request chat history when chatUser changes
    if (username && chatUser) {
      socket.emit("get_history", { user1: username, user2: chatUser });
      setRecentChats((prev) =>
        chatUser && !prev.includes(chatUser) ? [...prev, chatUser] : prev
      );
    }
  }, [username, chatUser]);

  // Listen for online users list
  useEffect(() => {
    const handleOnlineUsers = (users: string[]) => {
      setOnlineUsers(users.filter((u) => u !== username));
    };
    socket.on("online_users", handleOnlineUsers);
    socket.emit("get_online_users");
    return () => {
      socket.off("online_users", handleOnlineUsers);
    };
  }, [username]);

  // Receive messages, chat history, and typing indicators from server
  useEffect(() => {
    const handleReceiveMessage = (data: {
      message: string;
      sender: string;
      recipient: string;
    }) => {
      const time = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      if (
        (data.sender === username && data.recipient === chatUser) ||
        (data.sender === chatUser && data.recipient === username)
      ) {
        setChat((prev) => [
          ...prev,
          {
            message: data.message,
            self: data.sender === username,
            time,
            sender: data.sender,
          },
        ]);
        setRecentChats((prev) =>
          data.sender !== username && !prev.includes(data.sender)
            ? [...prev, data.sender]
            : prev
        );
      }
    };
    const handleChatHistory = (history: any[]) => {
      const mapped = history.map((msg) => ({
        message: msg.message,
        self: msg.sender === username,
        time: new Date(msg.time).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        sender: msg.sender,
      }));
      setChat(mapped);
    };
    const handleTyping = (data: {
      sender: string;
      recipient: string;
      typing: boolean;
    }) => {
      if (data.sender === chatUser && data.recipient === username) {
        setIsTyping(data.typing);
      }
    };
    socket.on("receive_message", handleReceiveMessage);
    socket.on("chat_history", handleChatHistory);
    socket.on("typing", handleTyping);
    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("chat_history", handleChatHistory);
      socket.off("typing", handleTyping);
    };
  }, [username, chatUser]);

  const sendMessage = () => {
    if (message.trim()) {
      socket.emit("send_message", {
        message,
        sender: username,
        recipient: chatUser,
      });
      setMessage("");
      socket.emit("typing", {
        sender: username,
        recipient: chatUser,
        typing: false,
      });
      setRecentChats((prev) =>
        chatUser && !prev.includes(chatUser) ? [...prev, chatUser] : prev
      );
    }
  };

  // Sidebar users: union of online users and recent chats (excluding self)
  const sidebarUsers = Array.from(
    new Set([...onlineUsers, ...recentChats.filter((u) => u !== username)])
  );

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "Arial",
        background: darkMode ? "#181818" : "#fff",
        color: darkMode ? "#eee" : "#222",
        transition: "background 0.2s, color 0.2s",
      }}
    >
      {/* Sidebar: Fixed position */}
      <div
        style={{
          width: "250px",
          borderRight: darkMode ? "1px solid #333" : "1px solid #ccc",
          background: darkMode ? "#222" : "#f5f5f5",
          padding: "1rem 0.5rem",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          left: 0,
          top: 0,
          height: "100vh",
          minHeight: "100vh",
          zIndex: 20,
          boxSizing: "border-box",
          transition: "background 0.2s, border 0.2s",
        }}
      >
        {/* Title */}
        <div
          style={{
            fontSize: "1.4em",
            color: darkMode ? "#eee" : "#222",
            fontFamily: "Inter, Segoe UI, sans-serif",
            margin: "1rem 0",
            fontWeight: 600,
            textTransform: "uppercase",
          }}
        >
          Socket Chat
        </div>

        <h3 style={{ marginBottom: "1rem", color: "#007bff" }}>Chats</h3>
        <div style={{ flex: 1, overflowY: "auto", marginBottom: "70px" }}>
          {sidebarUsers.length === 0 && (
            <div style={{ color: "#888", fontSize: "0.95em" }}>
              No chats yet
            </div>
          )}
          {sidebarUsers.map((user) => (
            <div
              key={user}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0.5rem 0.5rem",
                cursor: "pointer",
                background: user === chatUser
                  ? darkMode
                    ? "#222a"
                    : "#e6f7ff"
                  : "transparent",
                borderRadius: "8px",
                marginBottom: "4px",
              }}
              onClick={() => onSelectUser(user)}
            >
              {/* Show green dot only if online */}
              <span style={{ fontSize: "1.2em", marginRight: "8px" }}>
                {onlineUsers.includes(user) ? (
                  <span style={{ color: "#28a745" }}>🔵</span>
                ) : (
                  <span style={{ color: "#888" }}>⚪</span>
                )}
              </span>
              <span
                style={{
                  fontWeight: user === chatUser ? "bold" : "normal",
                  color: darkMode ? "#eee" : "#333",
                }}
              >
                {user}
              </span>
            </div>
          ))}
        </div>
        {/* Profile section at bottom left */}
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: "100%",
            padding: "1rem 0.5rem",
            borderTop: darkMode ? "1px solid #333" : "1px solid #ddd",
            background: darkMode ? "#222" : "#f5f5f5",
            display: "flex",
            alignItems: "center",
            gap: "0.8rem",
            zIndex: 30,
            boxSizing: "border-box",
          }}
        >
          <DefaultUserIcon />
          <span
            style={{
              fontWeight: "bold",
              fontSize: "1.1em",
              color: darkMode ? "#eee" : "#222",
            }}
          >
            {username}
          </span>
          <SettingsIcon onClick={() => setSettingsOpen(true)} />
        </div>
      </div>

      {/* Chat Interface */}
      <div
        style={{
          flex: 1,
          marginLeft: "250px",
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          padding: "2rem",
          position: "relative",
        }}
      >
        <h2>
          {chatUser ? (
            <>
              Chatting with <span style={{ color: "#007bff" }}>{chatUser}</span>
              {!onlineUsers.includes(chatUser) && (
                <span
                  style={{
                    color: "#888",
                    fontSize: "0.9em",
                    marginLeft: "8px",
                  }}
                >
                  (offline)
                </span>
              )}
            </>
          ) : (
            <span style={{ color: "#888" }}>
              Select a chat to start chatting
            </span>
          )}
        </h2>
        <div
          style={{
            flex: 1,
            margin: "1rem 0",
            overflowY: "auto",
            border: darkMode ? "1px solid #333" : "1px solid #ccc",
            borderRadius: "8px",
            padding: "1rem",
            background: darkMode ? "#222" : "#f9f9f9",
            minHeight: 0,
            maxHeight: "calc(100vh - 180px)",
            transition: "background 0.2s, border 0.2s",
          }}
        >
          {chatUser ? (
            chat.map((c, i) => (
              <div
                key={i}
                style={{
                  textAlign: c.self ? "right" : "left",
                  margin: "0.5rem 0",
                }}
              >
                <div
                  style={{
                    fontSize: "0.75em",
                    color: "#888",
                    marginBottom: "2px",
                  }}
                >
                  {c.sender}
                </div>
                <span
                  style={{
                    background: c.self
                      ? darkMode
                        ? "#2e4d2e"
                        : "#d1ffd6"
                      : darkMode
                      ? "#333"
                      : "#e0e0e0",
                    padding: "0.5rem 1rem",
                    borderRadius: "20px",
                    display: "inline-block",
                    maxWidth: "70%",
                    position: "relative",
                  }}
                >
                  {c.message}
                  <span
                    style={{
                      fontSize: "0.65em",
                      color: "#888",
                      marginLeft: "8px",
                    }}
                  >
                    {c.time}
                  </span>
                </span>
              </div>
            ))
          ) : (
            <div
              style={{ color: "#888", textAlign: "center", marginTop: "100px" }}
            >
              Select a chat to start chatting.
            </div>
          )}
        </div>
        {/* Fixed input at bottom */}
        <div
          style={{
            position: "fixed",
            left: 250, // width of sidebar
            right: 0,
            bottom: 0,
            background: darkMode ? "#181818" : "#fff",
            padding: "1rem 2rem",
            borderTop: darkMode ? "1px solid #333" : "1px solid #eee",
            zIndex: 10,
            transition: "background 0.2s, border 0.2s",
          }}
        >
          {/* Typing indicator above input */}
          {isTyping && chatUser && (
            <div
              style={{
                color: "#007bff",
                marginBottom: "0.5rem",
                fontSize: "0.9em",
                maxWidth: "1000px",
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              {chatUser} is typing...
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              maxWidth: "1000px",
              margin: "0 auto",
            }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a message..."
              value={message}
              disabled={!chatUser}
              onChange={(e) => {
                setMessage(e.target.value);
                if (chatUser) {
                  socket.emit("typing", {
                    sender: username,
                    recipient: chatUser,
                    typing: !!e.target.value,
                  });
                }
              }}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              style={{
                flex: 1,
                padding: "0.5rem 1rem",
                borderRadius: "20px",
                border: darkMode ? "1px solid #333" : "1px solid #ccc",
                outline: "none",
                background: chatUser
                  ? darkMode
                    ? "#222"
                    : "white"
                  : darkMode
                  ? "#333"
                  : "#eee",
                color: darkMode ? "#eee" : "#222",
                transition: "background 0.2s, border 0.2s, color 0.2s",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!chatUser}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "20px",
                backgroundColor: chatUser
                  ? "#007bff"
                  : darkMode
                  ? "#444"
                  : "#aaa",
                color: "white",
                border: "none",
                cursor: chatUser ? "pointer" : "not-allowed",
                transition: "background 0.2s",
              }}
            >
              Send
            </button>
          </div>
        </div>
        {/* Settings Panel */}
        {settingsOpen && (
          <div
            style={{
              position: "fixed",
              left: 0,
              top: 0,
              width: "100vw",
              height: "100vh",
              zIndex: 100,
              background: "rgba(0,0,0,0.2)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={() => setSettingsOpen(false)}
          >
            <div
              style={{
                background: darkMode ? "#222" : "#fff",
                color: darkMode ? "#eee" : "#222",
                padding: "2rem 2.5rem",
                borderRadius: "18px",
                boxShadow: "0 4px 32px rgba(0,0,0,0.15)",
                minWidth: "320px",
                minHeight: "180px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ marginBottom: "2rem" }}>Settings</h2>
              {setDarkMode && (
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  style={{
                    padding: "0.7rem 2rem",
                    borderRadius: "12px",
                    border: "none",
                    background: darkMode ? "#007bff" : "#222",
                    color: "#fff",
                    fontWeight: "bold",
                    fontSize: "1.1em",
                    cursor: "pointer",
                    marginBottom: "1rem",
                    transition: "background 0.2s",
                  }}
                >
                  {darkMode ? "Disable Dark Mode" : "Enable Dark Mode"}
                </button>
              )}
              <button
                onClick={() => setSettingsOpen(false)}
                style={{
                  padding: "0.5rem 1.5rem",
                  borderRadius: "8px",
                  border: "none",
                  background: "#888",
                  color: "#fff",
                  fontWeight: "bold",
                  fontSize: "1em",
                  cursor: "pointer",
                  marginTop: "0.5rem",
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;