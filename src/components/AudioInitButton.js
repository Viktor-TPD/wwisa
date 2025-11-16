import React from "react";
import wwiseService from "../services/wwise";
import "./AudioInitButton.css";

function AudioInitButton() {
  const handleClick = () => {
    // Resume AudioContext on user interaction
    if (
      window.WwiseAudioContext &&
      window.WwiseAudioContext.state === "suspended"
    ) {
      window.WwiseAudioContext.resume();
    }

    wwiseService.startAudioRendering();
  };

  return (
    <div className="card audio-init-card">
      <button onClick={handleClick} className="btn-primary audio-init-button">
        <span className="audio-init-icon">♪</span>
        <span>ENABLE AUDIO</span>
      </button>
      <p className="text-muted text-center mt-sm">
        Click to initialize the audio subsystem
      </p>
    </div>
  );
}

export default AudioInitButton;
