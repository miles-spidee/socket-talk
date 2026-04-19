import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const isLocalHost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';
const localSocketUrl =
  import.meta.env.VITE_SOCKET_LOCAL_URL?.trim() || 'http://localhost:5000';
const deployedSocketUrl = import.meta.env.VITE_SOCKET_URL?.trim();
const socketUrl = (isLocalHost ? localSocketUrl : deployedSocketUrl) || localSocketUrl;
const socket = io(socketUrl);

interface UsersListProps {
  currentUser: string;
  onSelect: (user: string) => void;
}

const UsersList: React.FC<UsersListProps> = ({ currentUser, onSelect }) => {
  const [users, setUsers] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    socket.emit('join', currentUser);
    socket.emit('get_users');
    socket.on('users_list', (userList: string[]) => {
      // Remove current user and deduplicate
      const uniqueUsers = Array.from(new Set(userList.filter(u => u !== currentUser)));
      setUsers(uniqueUsers);
    });
    // Listen for typing events from other users
    const handleTyping = (data: { sender: string; recipient: string; typing: boolean }) => {
      if (data.recipient === currentUser) {
        setTypingUsers(prev => {
          if (data.typing) {
            return Array.from(new Set([...prev, data.sender]));
          } else {
            return prev.filter(u => u !== data.sender);
          }
        });
      }
    };
    socket.on('typing', handleTyping);
    return () => {
      socket.off('users_list');
      socket.off('typing', handleTyping);
    };
  }, [currentUser]);

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Available Users</h2>
      {users.length === 0 ? (
        <div style={{ color: '#888', margin: '2rem 0' }}>No users online</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {users.map(user => (
            <li key={user} style={{ margin: '1rem 0' }}>
              <button
                onClick={() => onSelect(user)}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #007bff', background: '#f9f9f9', color: '#007bff', cursor: 'pointer' }}
              >
                {user}
              </button>
              {typingUsers.includes(user) && (
                <span style={{ color: '#007bff', marginLeft: '1rem', fontSize: '0.9em' }}>
                  typing...
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default UsersList;
