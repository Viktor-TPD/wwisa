import React, { useState } from "react";
import { useAuth } from "./context/AuthContext";
import Login from "./components/Login";
import FileUpload from "./components/FileUpload";
import ActionSlot from "./components/ActionSlot";
import WaveformVisualizer from "./components/WaveformVisualizer";
import AudioInitButton from "./components/AudioInitButton";
import DebugTools from "./components/DebugTools";
import wwiseService from "./services/wwise";
import { files } from "./services/api";
import "./App.css";

function App() {
  const { user, loading, logout } = useAuth();
  const [loadedFiles, setLoadedFiles] = useState(null);
  const [actionSlots, setActionSlots] = useState([]);
  const [nextSlotId, setNextSlotId] = useState(1);

  const handleFilesLoaded = (filesData) => {
    setLoadedFiles(filesData);
  };

  const handleLogout = async () => {
    try {
      // Clear backend files
      await files.deleteAll();

      // Stop Wwise
      if (wwiseService.initialized) {
        wwiseService.stopAudioRendering();
      }

      // Reset state
      setLoadedFiles(null);
      setActionSlots([]);

      // Logout
      await logout();
    } catch (err) {
      console.error("Logout error:", err);
      // Still logout even if file deletion fails
      await logout();
    }
  };

  const handleAddSlot = () => {
    setActionSlots([...actionSlots, { id: nextSlotId }]);
    setNextSlotId(nextSlotId + 1);
  };

  const handleRemoveSlot = (id) => {
    setActionSlots(actionSlots.filter((slot) => slot.id !== id));
  };

  const handleAutoPopulate = () => {
    if (!loadedFiles || !loadedFiles.events) return;

    // Create slots for all events
    const newSlots = loadedFiles.events.map((event, index) => ({
      id: nextSlotId + index,
    }));

    setActionSlots(newSlots);
    setNextSlotId(nextSlotId + newSlots.length);
  };

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="App loading-screen">
        <div className="spinner-large"></div>
        <p className="text-muted">INITIALIZING...</p>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return <Login />;
  }

  // Main app - user is authenticated
  return (
    <div className="App">
      <div className="scanline-overlay"></div>

      <header className="app-header">
        <h1>WWISE // WEB</h1>
        <div className="header-controls">
          <div className="status-indicator">
            <span
              className={`status-dot ${loadedFiles ? "active" : ""}`}
            ></span>
            <span>{loadedFiles ? "SYSTEM READY" : "AWAITING INIT"}</span>
          </div>
          <div className="user-info">
            <span className="text-muted">USER:</span>
            <span className="username">{user.username}</span>
          </div>
          <button onClick={handleLogout} className="btn-danger logout-button">
            LOGOUT
          </button>
        </div>
      </header>

      <div className="grid grid-2">
        <div>
          <AudioInitButton />
          <FileUpload onFilesLoaded={handleFilesLoaded} />
        </div>

        <div>{loadedFiles && <WaveformVisualizer />}</div>
      </div>

      {loadedFiles && (
        <>
          <div className="card action-controls-card">
            <div className="card-header">
              <h2>ACTIONS</h2>
              <div className="action-controls">
                <button onClick={handleAddSlot} className="btn-primary">
                  + ADD ACTION
                </button>
                <button
                  onClick={handleAutoPopulate}
                  className="auto-populate-button"
                  disabled={
                    !loadedFiles.events || loadedFiles.events.length === 0
                  }
                >
                  AUTO-POPULATE
                </button>
              </div>
            </div>

            <div className="action-grid">
              {actionSlots.length === 0 ? (
                <div className="empty-state">
                  <p className="text-muted">
                    No actions yet. Click "+ ADD ACTION" to get started.
                  </p>
                </div>
              ) : (
                actionSlots.map((slot) => (
                  <ActionSlot
                    key={slot.id}
                    id={slot.id}
                    onRemove={handleRemoveSlot}
                    availableEvents={loadedFiles.events || []}
                    availableRTPCs={loadedFiles.rtpcs || []}
                  />
                ))
              )}
            </div>
          </div>
        </>
      )}

      <DebugTools />
    </div>
  );
}

export default App;
