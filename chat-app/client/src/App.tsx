import React, { useState } from 'react';
import Join from './components/Join';
import Chat from './components/Chat';
import UsersList from './components/UsersList';

const App: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [chatUser, setChatUser] = useState<string>('');

  if (!username) {
    return <Join onJoin={setUsername} />;
  }

  if (!chatUser) {
    return <UsersList currentUser={username} onSelect={setChatUser} />;
  }

  // Add goBack function to clear chatUser
  const goBack = () => setChatUser('');
  return <Chat username={username} chatUser={chatUser} goBack={goBack} />;
};

export default App;
