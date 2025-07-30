import React, { useState } from 'react';

interface JoinProps {
  onJoin: (username: string) => void;
}

const Join: React.FC<JoinProps> = ({ onJoin }) => {
  const [username, setUsername] = useState('');

  const handleJoin = () => {
    if (username.trim()) {
      onJoin(username.trim());
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>🚀 Join Chat</h2>
      <input
        type="text"
        placeholder="Enter your name"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
        style={{ padding: '0.5rem', width: '60%' }}
      />
      <button onClick={handleJoin} style={{ padding: '0.5rem 1rem', marginLeft: '0.5rem' }}>
        Join
      </button>
    </div>
  );
};

export default Join;
