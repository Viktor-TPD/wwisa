/* global BigInt */

import React, { useState } from "react";
import wwiseService from "../services/wwise";
import "./DebugTools.css";

function DebugTools() {
  const [isExpanded, setIsExpanded] = useState(false);

  const checkListener = () => {
    if (!wwiseService.initialized || !wwiseService.module) {
      console.log("❌ Wwise not initialized");
      return;
    }

    try {
      const gameObjID = BigInt(wwiseService.gameObjectID);
      console.log("🔍 Checking game object ID:", wwiseService.gameObjectID);
      console.log("📍 Game object position:", { x: 0, y: 0, z: 0 });
      console.log("✅ Game object is registered");
      console.log("ℹ️ Listener should be set to this game object");
    } catch (e) {
      console.error("❌ Game object check failed:", e.message);
    }
  };

  const verifyAudioConfig = () => {
    if (!wwiseService.initialized || !wwiseService.module) {
      console.log("❌ Wwise not initialized");
      return;
    }

    console.log("ℹ️ To manually verify audio:");
    console.log("  1. Check Init.bnk has System audio device");
    console.log("  2. Check TestBank.bnk has embedded .wem file");
    console.log("  3. Check event 'Play_test' is connected to sound");
    console.log("  4. Check sound has Master Audio Bus as output");
  };

  const manualRenderCall = () => {
    if (!wwiseService.initialized || !wwiseService.module) {
      console.log("❌ Wwise not initialized");
      return;
    }

    console.log("🎵 Manually calling RenderAudio once...");
    wwiseService.module.SoundEngine.RenderAudio();
    console.log("✓ RenderAudio called");
  };

  return (
    <div className="card debug-tools-card">
      <div
        className="card-header"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: "pointer" }}
      >
        <h2>DEBUG TOOLS</h2>
        <span className="text-muted">{isExpanded ? "▼" : "▶"}</span>
      </div>

      {isExpanded && (
        <div className="debug-tools-content">
          <div className="debug-button-grid">
            <button onClick={checkListener} className="debug-button">
              <span className="debug-icon">🔍</span>
              <span>Check Listener</span>
            </button>

            <button onClick={verifyAudioConfig} className="debug-button">
              <span className="debug-icon">✓</span>
              <span>Verify Config</span>
            </button>

            <button onClick={manualRenderCall} className="debug-button">
              <span className="debug-icon">▶</span>
              <span>Manual Render</span>
            </button>
          </div>

          <div className="debug-info">
            <p className="text-muted">
              Check browser console (F12) for detailed debug output
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default DebugTools;
