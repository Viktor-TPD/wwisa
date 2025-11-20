import React, { useState } from "react";
import { upload } from "@vercel/blob/client";
import "./FileUpload.css";

function FileUpload({ onUploadComplete }) {
  const [uploadStatus, setUploadStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleFileUpload = async (event) => {
    const uploadedFiles = Array.from(event.target.files);
    setIsLoading(true);
    setUploadStatus("Uploading files...");

    try {
      const results = [];

      for (const file of uploadedFiles) {
        // First, get the upload URL from our authenticated endpoint
        const response = await fetch("/api/files/upload-url", {
          method: "POST",
          credentials: "include", // Send cookies
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || "application/octet-stream",
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to get upload URL");
        }

        const { url } = await response.json();

        // Upload directly to blob storage
        const uploadResponse = await fetch(url, {
          method: "PUT",
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error("Upload failed");
        }

        const blob = await uploadResponse.json();

        results.push({
          originalName: file.name,
          url: blob.url,
          size: file.size,
        });
      }

      setUploadStatus(`✓ Uploaded ${results.length} file(s)`);
      setIsLoading(false);

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus(`✗ Error: ${error.message}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="card file-upload-card">
      <div
        className="card-header"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: "pointer" }}
      >
        <h2>UPLOAD FILES</h2>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-md)",
          }}
        >
          {isLoading && <div className="spinner"></div>}
          <span className="text-muted">{isExpanded ? "▼" : "▶"}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="file-upload-content">
          <div className="upload-zone">
            <input
              type="file"
              multiple
              accept=".bnk,.xml,.wwu"
              onChange={handleFileUpload}
              id="file-input"
              className="file-input-hidden"
            />
            <label htmlFor="file-input" className="file-input-label">
              <div className="upload-icon">↑</div>
              <div className="upload-text">
                <div>DROP FILES OR CLICK TO SELECT</div>
                <div className="text-muted">.bnk, .xml, and .wwu files</div>
              </div>
            </label>
          </div>

          {uploadStatus && (
            <div
              className={`upload-status ${
                uploadStatus.includes("✗") ? "error" : "success"
              }`}
            >
              {uploadStatus}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FileUpload;
