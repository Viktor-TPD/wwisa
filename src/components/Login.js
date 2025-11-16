import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters");
        }
        await register(username, email, password);
      } else {
        await login(username, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
          <div className="login-tabs">
            <button
              className={`tab ${!isRegister ? "active" : ""}`}
              onClick={() => setIsRegister(false)}
              type="button"
            >
              LOGIN
            </button>
            <button
              className={`tab ${isRegister ? "active" : ""}`}
              onClick={() => setIsRegister(true)}
              type="button"
            >
              REGISTER
            </button>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
                autoComplete="username"
              />
            </div>

            {isRegister && (
              <div className="form-group">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
            )}

            <div className="form-group">
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete={isRegister ? "new-password" : "current-password"}
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="submit-button btn-primary"
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  <span>PROCESSING...</span>
                </>
              ) : (
                <span>{isRegister ? "CREATE ACCOUNT" : "ENTER SYSTEM"}</span>
              )}
            </button>
          </form>

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

export default Login;
