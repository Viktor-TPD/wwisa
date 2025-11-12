import React, { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [wwiseLoaded, setWwiseLoaded] = useState(false);
  const [wwiseModule, setWwiseModule] = useState(null);

  useEffect(() => {
    // Load Wwise module
    const script = document.createElement("script");
    script.src = "/wwise/wwise.profile.js";
    script.async = true;

    script.onload = () => {
      window
        .WwiseModule()
        .then((module) => {
          console.log("✓ Wwise loaded!");
          setWwiseModule(module);
          setWwiseLoaded(true);
        })
        .catch((err) => {
          console.error("Failed to load Wwise:", err);
        });
    };

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Wwise Web Player</h1>
        <p>Status: {wwiseLoaded ? "✅ Wwise Loaded" : "⏳ Loading..."}</p>
      </header>
    </div>
  );
}

export default App;
