import React, { useState } from "react";
import Join from "./components/Join";
import Chat from "./components/Chat";

const App: React.FC = () => {
  const [username, setUsername] = useState<string>("");
  const [chatUser, setChatUser] = useState<string>("");
  const [darkMode, setDarkMode] = useState(false);

  if (!username) {
    return (
      <div style={{ height: "100vh", width: "100vw", margin: 0, padding: 0 }}>
        <Join onJoin={setUsername} />
      </div>
    );
  }

  const goBack = () => setChatUser("");

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        margin: 0,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <Chat
        username={username}
        chatUser={chatUser}
        goBack={goBack}
        onSelectUser={setChatUser}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />
    </div>
  );
};

export default App;
