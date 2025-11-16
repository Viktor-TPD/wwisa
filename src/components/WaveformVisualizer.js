import React, { useEffect, useRef, useState } from "react";
import "./WaveformVisualizer.css";

function WaveformVisualizer() {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const analyserRef = useRef(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!window.WwiseAudioContext) {
      return;
    }

    const setupAnalyser = () => {
      const audioContext = window.WwiseAudioContext;

      // Create analyser if not exists
      if (!analyserRef.current) {
        analyserRef.current = audioContext.createAnalyser();
        analyserRef.current.fftSize = 2048;
        analyserRef.current.smoothingTimeConstant = 0.8;

        // Connect to destination
        audioContext.destination.connect(analyserRef.current);
      }

      setIsActive(true);
      startVisualization();
    };

    // Wait a bit for AudioContext to be available
    const timeout = setTimeout(setupAnalyser, 500);

    return () => {
      clearTimeout(timeout);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const startVisualization = () => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserRef.current) return;

    const ctx = canvas.getContext("2d");
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(dataArray);

      // Clear with fade effect
      ctx.fillStyle = "rgba(10, 10, 10, 0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw waveform
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#00ff66";
      ctx.beginPath();

      const sliceWidth = (canvas.width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // Draw center line
      ctx.strokeStyle = "rgba(51, 51, 51, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();
  };

  const handleResize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  };

  useEffect(() => {
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="card waveform-card">
      <div className="card-header">
        <h2>WAVEFORM</h2>
        <div className="status-indicator">
          <span className={`status-dot ${isActive ? "active" : ""}`}></span>
          <span>{isActive ? "MONITORING" : "INACTIVE"}</span>
        </div>
      </div>
      <div className="waveform-container">
        <canvas ref={canvasRef} className="waveform-canvas"></canvas>
      </div>
    </div>
  );
}

export default WaveformVisualizer;
