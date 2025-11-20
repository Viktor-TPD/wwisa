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
        // Get signed upload URL from our backend
        const urlResponse = await fetch("/api/files/upload-url", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ filename: file.name }),
        });

        if (!urlResponse.ok) {
          throw new Error(`Failed to get upload URL for ${file.name}`);
        }

        const { url, pathname } = await urlResponse.json();

        // Upload directly to Blob Storage using the signed URL
        const uploadResponse = await fetch(url, {
          method: "PUT",
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed for ${file.name}`);
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
              accept=".bnk,.xml,.wwu,.wem"
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
