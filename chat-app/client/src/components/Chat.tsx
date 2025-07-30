function getChatPartner(myName: string, chat: Message[]): string {
  const other = chat.find(m => !m.self && m.sender && m.sender !== myName);
  return other && other.sender ? other.sender : 'Unknown';
}
import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

interface Message {
  message: string;
  self: boolean;
  time: string;
  sender: string;
}

// Connect to backend server
const socket = io('http://localhost:5000');

interface ChatProps {
  username: string;
  chatUser: string;
  goBack: () => void;
}

const Chat: React.FC<ChatProps> = ({ username, chatUser, goBack }) => {
  // Register username with server on mount
  useEffect(() => {
    if (username) {
      socket.emit('join', username);
    }
  }, [username]);
  const [message, setMessage] = useState<string>('');
  const [chat, setChat] = useState<Message[]>([]);

  // Send message to server
  const sendMessage = () => {
    if (message.trim()) {
      socket.emit('send_message', { message, sender: username, recipient: chatUser });
      setMessage('');
    }
  }

  // Receive messages from server
  useEffect(() => {
    socket.on('receive_message', (data: { message: string; sender: string; recipient: string }) => {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      // Only show messages relevant to this chat
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
      }
    });
    return () => {
      socket.off('receive_message'); // Cleanup listener on unmount
    };
  }, [username, chatUser]);

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial' }}>
      <button
        onClick={goBack}
        style={{
          marginBottom: '1rem',
          padding: '0.3rem 1rem',
          borderRadius: '20px',
          backgroundColor: '#eee',
          color: '#007bff',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 'bold',
        }}
      >
        ← Back
      </button>
      <h2>Chatting with <span style={{ color: '#007bff' }}>{chatUser}</span></h2>

      <div
        style={{
          margin: '1rem 0',
          height: '300px',
          overflowY: 'auto',
          border: '1px solid #ccc',
          borderRadius: '8px',
          padding: '1rem',
          background: '#f9f9f9',
        }}
      >
        {chat.map((c, i) => (
          <div key={i} style={{ textAlign: c.self ? 'right' : 'left', margin: '0.5rem 0' }}>
            <div style={{ fontSize: '0.75em', color: '#888', marginBottom: '2px' }}>
              {c.sender}
            </div>
            <span
              style={{
                background: c.self ? '#d1ffd6' : '#e0e0e0',
                padding: '0.5rem 1rem',
                borderRadius: '20px',
                display: 'inline-block',
                maxWidth: '70%',
                position: 'relative',
              }}
            >
              {c.message}
              <span style={{ fontSize: '0.65em', color: '#888', marginLeft: '8px' }}>
                {c.time}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          style={{
            flex: 1,
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            border: '1px solid #ccc',
            outline: 'none',
          }}
        />
        <button
          onClick={sendMessage}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chat;
