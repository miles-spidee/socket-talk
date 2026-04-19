import React, { useEffect, useState } from "react";
import Join from "./components/Join";
import Chat from "./components/Chat";

const USERNAME_STORAGE_KEY = "sockettalk_username";
const DARK_MODE_STORAGE_KEY = "sockettalk_dark_mode";

const App: React.FC = () => {
  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem(USERNAME_STORAGE_KEY) || "";
  });
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem(DARK_MODE_STORAGE_KEY);
    return savedTheme === null ? true : savedTheme === "true";
  });

  useEffect(() => {
    if (username) {
      localStorage.setItem(USERNAME_STORAGE_KEY, username);
      return;
    }
    localStorage.removeItem(USERNAME_STORAGE_KEY);
  }, [username]);

  useEffect(() => {
    localStorage.setItem(DARK_MODE_STORAGE_KEY, String(darkMode));
  }, [darkMode]);

  const handleJoin = (nextUsername: string) => {
    setUsername(nextUsername.trim());
  };

  const handleLogout = () => {
    setUsername("");
  };

  if (!username) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          margin: 0,
          padding: 0,
          overflow: "hidden",
          background: darkMode ? "#141414" : "#eef4ff",
        }}
      >
        <Join onJoin={handleJoin} darkMode={darkMode} />
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        margin: 0,
        padding: 0,
        overflow: "hidden",
          background: darkMode ? "#141414" : "#eef4ff",
      }}
    >
      <Chat
        username={username}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onLogout={handleLogout}
      />
    </div>
  );
};

export default App;
