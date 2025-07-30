import React, { useState } from 'react';
import Join from './components/Join';
import Chat from './components/Chat';

const App: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [chatUser, setChatUser] = useState<string>('');

  if (!username) {
    return <Join onJoin={setUsername} />;
  }

  const goBack = () => setChatUser('');

  return (
    <Chat
      username={username}
      chatUser={chatUser}
      goBack={goBack}
      onSelectUser={setChatUser}
    />
  );
};

export default App;