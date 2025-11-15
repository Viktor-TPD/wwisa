import React, { useState, useEffect } from "react";
import wwiseService from "../services/wwise";
import { files as filesAPI } from "../services/api";
import xmlParser from "../services/xmlParser";
import "../styles/FileUpload.css";

function FileUpload({ onFilesLoaded }) {
  const [initBank, setInitBank] = useState(null);
  const [soundBank, setSoundBank] = useState(null);
  const [xmlFile, setXmlFile] = useState(null);
  const [error, setError] = useState("");

  const allFilesLoaded = initBank && soundBank && xmlFile;

  useEffect(() => {
    autoLoadExistingFiles();
  }, []);

  const autoLoadExistingFiles = async () => {
    try {
      const response = await filesAPI.list();
      const files = response.files || []; // API returns { files: [...] }

      const recentInit = files.find(
        (f) => f.originalName === "Init.bnk" && f.fileType === ".bnk"
      );
      const recentBank = files.find(
        (f) => f.originalName !== "Init.bnk" && f.fileType === ".bnk"
      );
      const recentXml = files.find((f) => f.fileType === ".xml");

      if (recentInit && recentBank && recentXml) {
        console.log("🔄 Auto-loading existing files...");

        // Load and parse XML first
        const xmlText = await loadXmlFromBackend(recentXml);
        const parsedData = xmlParser.parseSoundBanksInfo(xmlText);

        // Initialize Wwise
        if (!wwiseService.initialized) {
          await wwiseService.initialize();
        }

        // Load banks
        await loadFileFromBackend(recentInit);
        await loadFileFromBackend(recentBank);

        // Get events from XML
        const events = xmlParser.getEventNames(parsedData);
        wwiseService.setEvents(events);

        if (onFilesLoaded) {
          onFilesLoaded({
            initBank: recentInit,
            soundBank: recentBank,
            xmlFile: recentXml,
            events,
          });
        }

        console.log("✅ Auto-loaded existing files");
        console.log(
          "📋 Events available:",
          events.map((e) => e.name)
        );
      }
    } catch (err) {
      console.error("Auto-load failed:", err);
    }
  };

  const loadFileFromBackend = async (fileMetadata) => {
    const blob = await filesAPI.download(fileMetadata.id);
    const arrayBuffer = await blob.arrayBuffer();

    if (!wwiseService.initialized) {
      await wwiseService.initialize();
    }

    if (fileMetadata.fileType === ".bnk") {
      await wwiseService.loadSoundBank(fileMetadata.originalName, arrayBuffer);

      if (fileMetadata.originalName === "Init.bnk") {
        setInitBank(fileMetadata);
      } else {
        setSoundBank(fileMetadata);
      }
    }
  };

  const loadXmlFromBackend = async (fileMetadata) => {
    const blob = await filesAPI.download(fileMetadata.id);
    const text = await blob.text();
    setXmlFile(fileMetadata);
    return text;
  };

  const handleFileUpload = async (files, type) => {
    setError("");

    try {
      const fileArray = Array.from(files);

      // Validate file types
      if (type === "init" || type === "bank") {
        if (!fileArray[0].name.endsWith(".bnk")) {
          setError("Please upload a .bnk file");
          return;
        }
      } else if (type === "xml") {
        if (!fileArray[0].name.endsWith(".xml")) {
          setError("Please upload SoundbanksInfo.xml");
          return;
        }
      }

      // Upload to backend
      await filesAPI.upload(fileArray);

      // Initialize Wwise if needed
      if (!wwiseService.initialized) {
        await wwiseService.initialize();
      }

      // Load files
      for (const file of fileArray) {
        const arrayBuffer = await file.arrayBuffer();

        if (file.name.endsWith(".bnk")) {
          await wwiseService.loadSoundBank(file.name, arrayBuffer);

          if (type === "init") {
            setInitBank({ originalName: file.name, size: file.size });
          } else {
            setSoundBank({ originalName: file.name, size: file.size });
          }
        } else if (file.name.endsWith(".xml")) {
          const text = await file.text();
          const parsedData = xmlParser.parseSoundBanksInfo(text);
          const events = xmlParser.getEventNames(parsedData);

          wwiseService.setEvents(events);
          setXmlFile({ originalName: file.name, size: file.size });

          console.log("📋 Parsed events from XML:", events);

          if (onFilesLoaded && initBank && soundBank) {
            onFilesLoaded({
              initBank,
              soundBank,
              xmlFile: { originalName: file.name },
              events,
            });
          }
        }
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message || "Upload failed");
    }
  };

  const handleClearAll = async () => {
    try {
      wwiseService.clearAll();
      await filesAPI.deleteAll();

      setInitBank(null);
      setSoundBank(null);
      setXmlFile(null);
      setError("");

      if (onFilesLoaded) {
        onFilesLoaded({
          initBank: null,
          soundBank: null,
          xmlFile: null,
          events: [],
        });
      }

      console.log("✓ Cleared all files");
    } catch (err) {
      console.error("Clear error:", err);
      setError("Failed to clear files");
    }
  };

  const FileSection = ({
    title,
    description,
    type,
    file,
    accept,
    multiple = false,
  }) => (
    <div className={`file-section ${file ? "uploaded" : ""}`}>
      <div className="file-header">
        <h4>{title}</h4>
        <p className="file-description">{description}</p>
      </div>

      {file ? (
        <div className="file-info">
          <span className="check-icon">✓</span>
          <span className="file-name">{file.originalName}</span>
          <span className="file-size">
            ({(file.size / 1024).toFixed(1)} KB)
          </span>
        </div>
      ) : (
        <label className="file-input-label">
          <input
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={(e) => handleFileUpload(e.target.files, type)}
            className="file-input"
          />
          <span className="upload-button">
            Choose File{multiple ? "s" : ""}
          </span>
        </label>
      )}
    </div>
  );

  return (
    <div className="file-upload-container">
      <div className="upload-header">
        <h2>📁 Upload Wwise Files</h2>
        <p className="upload-subtitle">
          Upload your soundbanks and metadata to play audio
        </p>
      </div>

      <div className="file-sections">
        <FileSection
          title="1. Init.bnk"
          description="Required initialization bank"
          type="init"
          file={initBank}
          accept=".bnk"
        />

        <FileSection
          title="2. SoundBank (.bnk)"
          description="Your main sound bank with events and embedded audio"
          type="bank"
          file={soundBank}
          accept=".bnk"
        />

        <FileSection
          title="3. SoundbanksInfo.xml"
          description="Event metadata (lists available events)"
          type="xml"
          file={xmlFile}
          accept=".xml"
        />
      </div>

      <div className="info-box">
        <h4>ℹ️ About Wwise Files</h4>
        <ul>
          <li>
            <strong>Init.bnk:</strong> Required initialization soundbank
          </li>
          <li>
            <strong>Your soundbank (.bnk):</strong> Contains events AND audio
            (.wem files are embedded inside)
          </li>
          <li>
            <strong>SoundbanksInfo.xml:</strong> Lists available events for the
            UI
          </li>
        </ul>
        <p className="note">
          💡 <strong>Note:</strong> You do NOT need to upload .wem files
          separately - they're embedded in the .bnk file!
        </p>
      </div>

      {error && <div className="error-message">⚠️ {error}</div>}

      {allFilesLoaded && (
        <>
          <div className="status-message success">
            ✅ All files loaded! Ready to play audio.
          </div>
          <div className="action-buttons">
            <button className="clear-button" onClick={handleClearAll}>
              Clear All
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default FileUpload;
