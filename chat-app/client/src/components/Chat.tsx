import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

interface Message {
  message: string;
  self: boolean;
}

// Connect to backend server
const socket = io('http://localhost:5000');

interface ChatProps {
  username: string;
}

const Chat: React.FC<ChatProps> = ({ username }) => {
  const [message, setMessage] = useState<string>('');
  const [chat, setChat] = useState<Message[]>([]);

  // Send message to server
  const sendMessage = () => {
    if (message.trim()) {
      socket.emit('send_message', { message });
      setChat((prev) => [...prev, { message, self: true }]);
      setMessage('');
    }
  };

  // Receive messages from server
  useEffect(() => {
    socket.on('receive_message', (data: { message: string }) => {
      setChat((prev) => [...prev, { message: data.message, self: false }]);
    });

    return () => {
      socket.off('receive_message'); // Cleanup listener on unmount
    };
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial' }}>
      <h2>💬 Real-Time Chat - {username}</h2>

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
            <span
              style={{
                background: c.self ? '#d1ffd6' : '#e0e0e0',
                padding: '0.5rem 1rem',
                borderRadius: '20px',
                display: 'inline-block',
                maxWidth: '70%',
              }}
            >
              {c.message}
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
