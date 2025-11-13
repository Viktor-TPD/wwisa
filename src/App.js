import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./components/Login";
import FileUpload from "./components/FileUpload";
import EventList from "./components/EventList";
import "./App.css";

function AppContent() {
  const { user, loading, logout } = useAuth();
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("");

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const handleFilesLoaded = (fileData) => {
    console.log("Files loaded:", fileData);

    // Events are already parsed from XML and set in Wwise service
    if (fileData.events && fileData.events.length > 0) {
      setEvents(fileData.events);
      setStatus(
        `✓ Found ${fileData.events.length} event(s): ${fileData.events
          .map((e) => e.name)
          .join(", ")}`
      );
    } else {
      setStatus("⚠️ No events found in SoundBank");
    }

    setTimeout(() => setStatus(""), 5000);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎵 Wwisa</h1>
        <div className="user-info">
          <span>Welcome, {user.username}!</span>
          <button onClick={logout}>Logout</button>
        </div>
      </header>

      <main className="app-main">
        <section className="upload-section">
          <h2>Upload Wwise Files</h2>
          <FileUpload onFilesLoaded={handleFilesLoaded} />
          {status && <div className="status-banner">{status}</div>}
        </section>

        <section className="events-section">
          <EventList events={events} />
        </section>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
