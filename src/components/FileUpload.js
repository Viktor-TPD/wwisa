import React, { useState, useEffect } from "react";
import wwiseService from "../services/wwise";
import xmlParser from "../services/xmlParser.js";
import { files } from "../services/api";
import "./FileUpload.css";

function FileUpload({ onFilesLoaded }) {
  const [uploadStatus, setUploadStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Auto-load existing files on mount
  useEffect(() => {
    autoLoadExistingFiles();
  }, []);

  const autoLoadExistingFiles = async () => {
    try {
      const response = await files.list();
      const filesList = response.files || [];

      if (filesList.length === 0) {
        return;
      }

      const recentInit = filesList.find(
        (f) => f.originalName === "Init.bnk" && f.fileType === ".bnk"
      );
      const recentBank = filesList.find(
        (f) => f.originalName === "TestBank.bnk" && f.fileType === ".bnk"
      );
      const recentXml = filesList.find((f) => f.fileType === ".xml");

      if (recentInit && recentBank && recentXml) {
        setIsLoading(true);
        const xmlText = await loadXmlFromBackend(recentXml);
        const parsedData = xmlParser.parseSoundBanksInfo(xmlText);

        if (!wwiseService.initialized) {
          await wwiseService.initialize();
          wwiseService.startAudioRendering();
        }

        await loadFileFromBackend(recentInit);
        await loadFileFromBackend(recentBank);

        const events = xmlParser.getEventNames(parsedData);
        const rtpcs = xmlParser.getRTPCNames(parsedData);
        wwiseService.setEvents(events);

        if (onFilesLoaded) {
          onFilesLoaded({
            initBank: recentInit,
            soundBank: recentBank,
            xmlFile: recentXml,
            events,
            rtpcs,
          });
        }

        setUploadStatus("Files loaded from session");
        setIsLoading(false);
      }
    } catch (err) {
      setIsLoading(false);
      // Silent fail on auto-load
    }
  };

  const loadXmlFromBackend = async (xmlFile) => {
    const blob = await files.download(xmlFile.id);
    return await blob.text();
  };

  const loadFileFromBackend = async (fileMetadata) => {
    const blob = await files.download(fileMetadata.id);
    const arrayBuffer = await blob.arrayBuffer();
    await wwiseService.loadSoundBank(fileMetadata.originalName, arrayBuffer);
  };

  const handleFileUpload = async (event) => {
    const uploadedFiles = Array.from(event.target.files);
    setIsLoading(true);
    setUploadStatus("Processing files...");

    try {
      // Find XML file first
      const xmlFile = uploadedFiles.find((f) => f.name.endsWith(".xml"));
      if (!xmlFile) {
        throw new Error("SoundbanksInfo.xml not found");
      }

      // Parse XML
      const xmlText = await xmlFile.text();
      const parsedData = xmlParser.parseSoundBanksInfo(xmlText);

      // Initialize Wwise if not already done
      if (!wwiseService.initialized) {
        await wwiseService.initialize();
        wwiseService.startAudioRendering();
      }

      // Load banks
      const bankFiles = uploadedFiles.filter((f) => f.name.endsWith(".bnk"));
      for (const bankFile of bankFiles) {
        const arrayBuffer = await bankFile.arrayBuffer();
        await wwiseService.loadSoundBank(bankFile.name, arrayBuffer);
      }

      // Get events and RTPCs from XML
      const events = xmlParser.getEventNames(parsedData);
      const rtpcs = xmlParser.getRTPCNames(parsedData);
      wwiseService.setEvents(events);

      // Upload to backend - pass the files array directly
      await files.upload(uploadedFiles);

      if (onFilesLoaded) {
        onFilesLoaded({
          initBank: bankFiles[0],
          soundBank: bankFiles[1],
          xmlFile: xmlFile,
          events,
          rtpcs,
        });
      }

      setUploadStatus("✓ All files loaded successfully");
      setIsLoading(false);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus(`✗ Error: ${error.message}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="card file-upload-card">
      <div className="card-header">
        <h2>AUDIO BANKS</h2>
        {isLoading && <div className="spinner"></div>}
      </div>

      <div className="upload-zone">
        <input
          type="file"
          multiple
          accept=".bnk,.xml"
          onChange={handleFileUpload}
          id="file-input"
          className="file-input-hidden"
        />
        <label htmlFor="file-input" className="file-input-label">
          <div className="upload-icon">↑</div>
          <div className="upload-text">
            <div>DROP FILES OR CLICK TO SELECT</div>
            <div className="text-muted">
              Init.bnk + SoundBank.bnk + SoundbanksInfo.xml
            </div>
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
  );
}

export default FileUpload;
