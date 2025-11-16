import React, { useState } from "react";
import LoginScreen from "./components/LoginScreen";
import FileUpload from "./components/FileUpload";
import ActionSlot from "./components/ActionSlot";
import WaveformVisualizer from "./components/WaveformVisualizer";
import AudioInitButton from "./components/AudioInitButton";
import DebugTools from "./components/DebugTools";
import wwiseService from "./services/wwise";
import { files as filesAPI } from "./services/api";
import "./App.css";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loadedFiles, setLoadedFiles] = useState(null);
  const [actionSlots, setActionSlots] = useState([]);
  const [nextSlotId, setNextSlotId] = useState(1);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleFilesLoaded = (files) => {
    setLoadedFiles(files);
  };

  const handleLogout = async () => {
    // Clear backend files
    try {
      const response = await filesAPI.list();
      const files = response.files || [];
      for (const file of files) {
        await filesAPI.delete(file.id);
      }
    } catch (err) {
      console.error("Error clearing files:", err);
    }

    // Reset state
    setIsLoggedIn(false);
    setLoadedFiles(null);
    setActionSlots([]);

    // Stop Wwise
    if (wwiseService.initialized) {
      wwiseService.stopAudioRendering();
    }

    // Reload page to clean everything
    window.location.reload();
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

    // Give UI a moment to render, then populate
    setTimeout(() => {
      // This is a simplified auto-populate
      // In practice, you'd need to trigger the selection in ActionSlot
      console.log("Auto-populate triggered - slots created");
    }, 100);
  };

  // Show login screen if not logged in
  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} />;
  }

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
