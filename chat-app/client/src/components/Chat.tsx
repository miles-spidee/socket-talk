import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

interface Message {
  message: string;
  self: boolean;
}

const socket = io('http://localhost:5000');


const Chat: React.FC = () => {
  const [message, setMessage] = useState<string>('');
  const [chat, setChat] = useState<Message[]>([]);

  const sendMessage = () => {
    if (message.trim()) {
      socket.emit('send_message', { message });
      setChat((prev) => [...prev, { message, self: true }]);
      setMessage('');
    }
  };

  useEffect(() => {
    socket.on('receive_message', (data: { message: string }) => {
      setChat((prev) => [...prev, { message: data.message, self: false }]);
    });

    return () => {
      socket.off('receive_message'); // Cleanup
    };
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <h2>💬 Real-Time Chat</h2>
      <div style={{ margin: '1rem 0', height: '300px', overflowY: 'auto', border: '1px solid #ccc', padding: '1rem' }}>
        {chat.map((c, i) => (
          <div key={i} style={{ textAlign: c.self ? 'right' : 'left' }}>
            <span style={{ background: c.self ? '#d1ffd6' : '#e0e0e0', padding: '0.5rem', borderRadius: '5px' }}>
              {c.message}
            </span>
          </div>
        ))}
      </div>
      <input
        type="text"
        placeholder="Type a message..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        style={{ padding: '0.5rem', width: '70%' }}
      />
      <button onClick={sendMessage} style={{ padding: '0.5rem 1rem', marginLeft: '0.5rem' }}>
        Send
      </button>
    </div>
  );
};

export default Chat;
