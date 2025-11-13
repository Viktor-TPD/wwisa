import React, { useState } from "react";
import wwiseService from "../services/wwise";

const AudioInitButton = ({ onAudioEnabled }) => {
  const [enabled, setEnabled] = useState(false);

  const handleClick = async () => {
    try {
      console.log("🎵 Starting Wwise audio rendering...");

      // NOW start the audio rendering loop
      wwiseService.startAudioRendering();

      // Wait for AudioContext to initialize
      await new Promise((resolve) => setTimeout(resolve, 500));

      setEnabled(true);
      if (onAudioEnabled) onAudioEnabled();

      console.log("🔊 Audio enabled and rendering started!");
    } catch (error) {
      console.error("Failed to enable audio:", error);
    }
  };

  if (enabled) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 9999,
        background: "rgba(0,0,0,0.8)",
        padding: "40px",
        borderRadius: "10px",
        textAlign: "center",
      }}
    >
      <h2 style={{ color: "white", marginBottom: "20px" }}>🔊 Enable Audio</h2>
      <button
        onClick={handleClick}
        style={{
          padding: "15px 30px",
          fontSize: "18px",
          cursor: "pointer",
          background: "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: "5px",
        }}
      >
        Click to Enable Audio
      </button>
    </div>
  );
};

export default AudioInitButton;
