import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import "../styles/Login.css";

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
    <div className="login-container">
      <div className="login-box">
        <h1>🎵 Wwisa</h1>
        <p className="subtitle">Wwise Web Audio Player</p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={loading}
          />

          {isRegister && (
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          )}

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? "Loading..." : isRegister ? "Register" : "Login"}
          </button>
        </form>

        <p className="toggle">
          {isRegister ? "Already have an account? " : "Don't have an account? "}
          <span onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? "Login" : "Register"}
          </span>
        </p>
      </div>
    </div>
  );
}

export default Login;
