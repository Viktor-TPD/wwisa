import React, { useState } from "react";
import "./LoginScreen.css";

function LoginScreen({ onLogin }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = () => {
    setIsLoading(true);
    // Simulate brief loading, then call onLogin
    setTimeout(() => {
      onLogin();
    }, 300);
  };

  return (
    <div className="login-screen">
      <div className="scanline-overlay"></div>

      <div className="login-container">
        <div className="login-header">
          <h1 className="login-title">WWISE // WEB</h1>
          <div className="login-subtitle">
            <span className="subtitle-line">
              BROWSER-BASED AUDIO MIDDLEWARE
            </span>
            <span className="subtitle-line">SOUNDCASTER INTERFACE</span>
          </div>
        </div>

        <div className="login-card">
          <div className="feature-list">
            <div className="feature-item">
              <span className="feature-icon">▶</span>
              <span>Real-time event triggering</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">⚙</span>
              <span>RTPC parameter control</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">📊</span>
              <span>Live waveform visualization</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🎵</span>
              <span>Modular action system</span>
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="login-button btn-primary"
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                <span>INITIALIZING...</span>
              </>
            ) : (
              <>
                <span>ENTER SYSTEM</span>
                <span className="arrow">→</span>
              </>
            )}
          </button>

          <div className="login-info">
            <p className="text-muted">
              Wwise 2022.1.3 | Web Audio API | WebAssembly
            </p>
          </div>
        </div>

        <div className="login-footer">
          <div className="status-indicator">
            <span className="status-dot pulse"></span>
            <span>SYSTEM ONLINE</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
