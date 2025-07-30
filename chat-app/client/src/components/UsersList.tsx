import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

interface UsersListProps {
  currentUser: string;
  onSelect: (user: string) => void;
}

const UsersList: React.FC<UsersListProps> = ({ currentUser, onSelect }) => {
  const [users, setUsers] = useState<string[]>([]);

  useEffect(() => {
    socket.emit('join', currentUser);
    socket.emit('get_users');
    socket.on('users_list', (userList: string[]) => {
      // Remove current user and deduplicate
      const uniqueUsers = Array.from(new Set(userList.filter(u => u !== currentUser)));
      setUsers(uniqueUsers);
    });
    return () => {
      socket.off('users_list');
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default UsersList;
