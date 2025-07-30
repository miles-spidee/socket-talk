import React, { useEffect, useState } from "react";
import io from "socket.io-client";

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
}

const socket = io("http://localhost:5000");

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

const Chat: React.FC<ChatProps> = ({
  username,
  chatUser,
  goBack,
  onSelectUser,
}) => {
  const [message, setMessage] = useState<string>("");
  const [chat, setChat] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [recentChats, setRecentChats] = useState<string[]>([]);

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
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial" }}>
      {/* Sidebar: Fixed position */}
      <div
        style={{
          width: "250px",
          borderRight: "1px solid #ccc",
          background: "#f5f5f5",
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
        }}
      >
        {/* Title */}
        <div
          style={{
            fontWeight: 900,
            fontSize: "2.3em",
            color: "#111",
            marginBottom: "0.5rem",
            letterSpacing: "2px",
            fontFamily: "Segoe UI, Arial, sans-serif",
            textTransform: "uppercase",
            textAlign: "center",
            background: "linear-gradient(90deg, #007bff 0%, #111 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginTop: "0.5rem",
          }}
        >
          SOCKET CHAT
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
                background: user === chatUser ? "#e6f7ff" : "transparent",
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
                  color: "#333",
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
            borderTop: "1px solid #ddd",
            background: "#f5f5f5",
            display: "flex",
            alignItems: "center",
            gap: "0.8rem",
            zIndex: 30,
            boxSizing: "border-box",
          }}
        >
          <DefaultUserIcon />
          <span
            style={{ fontWeight: "bold", fontSize: "1.1em", color: "#222" }}
          >
            {username}
          </span>
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
            border: "1px solid #ccc",
            borderRadius: "8px",
            padding: "1rem",
            background: "#f9f9f9",
            minHeight: 0,
            maxHeight: "calc(100vh - 180px)",
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
                    background: c.self ? "#d1ffd6" : "#e0e0e0",
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
            background: "#fff",
            padding: "1rem 2rem",
            borderTop: "1px solid #eee",
            zIndex: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              maxWidth: "1000px",
              margin: "0 auto",
            }}
          >
            <input
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
                border: "1px solid #ccc",
                outline: "none",
                background: chatUser ? "white" : "#eee",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!chatUser}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "20px",
                backgroundColor: chatUser ? "#007bff" : "#aaa",
                color: "white",
                border: "none",
                cursor: chatUser ? "pointer" : "not-allowed",
              }}
            >
              Send
            </button>
          </div>
          {isTyping && chatUser && (
            <div
              style={{
                color: "#007bff",
                marginTop: "0.5rem",
                fontSize: "0.9em",
                maxWidth: "1000px",
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              {chatUser} is typing...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;