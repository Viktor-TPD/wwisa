import React, { useState } from "react";
import { useAuth } from "./context/AuthContext";
import Login from "./components/Login";
import FileManager from "./components/FileManager";
import FileUpload from "./components/FileUpload";
import ActionSlot from "./components/ActionSlot";
import DebugTools from "./components/DebugTools";
import wwiseService from "./services/wwise";
import "./App.css";

function App() {
  const { user, loading, logout } = useAuth();
  const [loadedFiles, setLoadedFiles] = useState(null);
  const [actionSlots, setActionSlots] = useState([]);
  const [nextSlotId, setNextSlotId] = useState(1);
  const [fileManagerKey, setFileManagerKey] = useState(0);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(false);

  // ✅ Enable Audio handler (moved from AudioInitButton)
  const handleEnableAudio = () => {
    if (
      window.WwiseAudioContext &&
      window.WwiseAudioContext.state === "suspended"
    ) {
      window.WwiseAudioContext.resume();
    }

    wwiseService.startAudioRendering();
    setAudioEnabled(true);
    console.log("♪ Audio enabled");
  };

  const handleFilesLoaded = (filesData) => {
    setLoadedFiles(filesData);
  };

  const handleUploadComplete = () => {
    setFileManagerKey((prev) => prev + 1);
  };

  const handleLogout = async () => {
    try {
      if (wwiseService.initialized) {
        wwiseService.stopAudioRendering();
      }

      setLoadedFiles(null);
      setActionSlots([]);
      setAudioEnabled(false);

      await logout();
    } catch (err) {
      console.error("Logout error:", err);
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

  const handleClearAll = () => {
    if (actionSlots.length === 0) return;
    setActionSlots([]);
    console.log("✓ Cleared all actions");
  };

  const handleStopAll = () => {
    if (!wwiseService.initialized) {
      console.warn("Wwise not initialized");
      return;
    }

    try {
      wwiseService.module.SoundEngine.StopAll();
      console.log("⏹ Stopped all audio");
    } catch (error) {
      console.error("Failed to stop all audio:", error);
    }
  };

  const handleAutoPopulate = () => {
    if (!loadedFiles) return;

    const newSlots = [];
    let currentId = nextSlotId;

    if (loadedFiles.events && loadedFiles.events.length > 0) {
      loadedFiles.events.forEach((event) => {
        newSlots.push({
          id: currentId++,
          type: "event",
          item: event,
        });
      });
    }

    if (loadedFiles.rtpcs && loadedFiles.rtpcs.length > 0) {
      loadedFiles.rtpcs.forEach((rtpc) => {
        newSlots.push({
          id: currentId++,
          type: "rtpc",
          item: rtpc,
        });
      });
    }

    setActionSlots(newSlots);
    setNextSlotId(currentId);

    console.log(`✓ Auto-populated ${newSlots.length} actions (Events + RTPCs)`);
  };

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (index) => {
    if (draggedIndex === null || draggedIndex === index) return;

    const newSlots = [...actionSlots];
    const draggedSlot = newSlots[draggedIndex];

    newSlots.splice(draggedIndex, 1);
    newSlots.splice(index, 0, draggedSlot);

    setActionSlots(newSlots);
    setDraggedIndex(index);
  };

  const handleDrop = () => {
    setDraggedIndex(null);
  };

  if (loading) {
    return (
      <div className="App loading-screen">
        <div className="spinner-large"></div>
        <p className="text-muted">INITIALIZING...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="App">
      <div className="scanline-overlay"></div>

      <header className="app-header">
        <h1>WWISE // WEB</h1>
        <div className="header-controls">
          {/* ✅ Enable Audio Button in header */}
          <button
            onClick={handleEnableAudio}
            className={`btn-primary enable-audio-button ${
              audioEnabled ? "enabled" : ""
            }`}
            disabled={audioEnabled}
          >
            <span className="audio-icon">♪</span>
            <span>{audioEnabled ? "AUDIO ENABLED" : "ENABLE AUDIO"}</span>
          </button>

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

      <div className="main-content">
        <FileManager key={fileManagerKey} onFilesLoaded={handleFilesLoaded} />
        <FileUpload onUploadComplete={handleUploadComplete} />
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
                  className="btn-secondary auto-populate-button"
                  disabled={
                    !loadedFiles.events?.length && !loadedFiles.rtpcs?.length
                  }
                >
                  AUTO-POPULATE
                </button>
                <button
                  onClick={handleStopAll}
                  className="btn-warning stop-all-button"
                  disabled={!wwiseService.initialized}
                >
                  ⏹ STOP ALL
                </button>
                <button
                  onClick={handleClearAll}
                  className="btn-danger clear-all-button"
                  disabled={actionSlots.length === 0}
                >
                  CLEAR ALL
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
                actionSlots.map((slot, index) => (
                  <ActionSlot
                    key={slot.id}
                    id={slot.id}
                    index={index}
                    onRemove={handleRemoveSlot}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    availableEvents={loadedFiles.events || []}
                    availableRTPCs={loadedFiles.rtpcs || []}
                    initialType={slot.type || null}
                    initialItem={slot.item || null}
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
