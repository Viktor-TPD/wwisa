import React, { useState } from "react";
import { useAuth } from "./context/AuthContext";
import Login from "./components/Login";
import FileManager from "./components/FileManager";
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
  const [fileManagerKey, setFileManagerKey] = useState(0); // For forcing FileManager refresh

  const handleFilesLoaded = (filesData) => {
    setLoadedFiles(filesData);
  };

  const handleUploadComplete = () => {
    // Refresh FileManager by changing key
    setFileManagerKey((prev) => prev + 1);
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
    if (!loadedFiles) return;

    const newSlots = [];
    let currentId = nextSlotId;

    // Add all events
    if (loadedFiles.events && loadedFiles.events.length > 0) {
      loadedFiles.events.forEach((event) => {
        newSlots.push({
          id: currentId++,
          type: "event",
          item: event,
        });
      });
    }

    // Add all RTPCs
    if (loadedFiles.rtpcs && loadedFiles.rtpcs.length > 0) {
      loadedFiles.rtpcs.forEach((rtpc) => {
        newSlots.push({
          id: currentId++,
          type: "rtpc",
          item: rtpc,
        });
      });
    }

    // Add all Switches
    if (loadedFiles.switches && loadedFiles.switches.length > 0) {
      loadedFiles.switches.forEach((switchItem) => {
        newSlots.push({
          id: currentId++,
          type: "switch",
          item: switchItem,
        });
      });
    }

    // Add all States
    if (loadedFiles.states && loadedFiles.states.length > 0) {
      loadedFiles.states.forEach((state) => {
        newSlots.push({
          id: currentId++,
          type: "state",
          item: state,
        });
      });
    }

    setActionSlots(newSlots);
    setNextSlotId(currentId);

    console.log(`✓ Auto-populated ${newSlots.length} actions`);
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
          <FileManager key={fileManagerKey} onFilesLoaded={handleFilesLoaded} />
          <FileUpload onUploadComplete={handleUploadComplete} />
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
                    !loadedFiles.events?.length &&
                    !loadedFiles.rtpcs?.length &&
                    !loadedFiles.switches?.length &&
                    !loadedFiles.states?.length
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
                    availableSwitches={loadedFiles.switches || []}
                    availableStates={loadedFiles.states || []}
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
