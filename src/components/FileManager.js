import React, { useState, useEffect } from "react";
import { files } from "../services/api";
import wwiseService from "../services/wwise";
import xmlParser from "../services/xmlParser.js";
import "./FileManager.css";
import wwuParser from "../services/wwuParser";

function FileManager({ onFilesLoaded }) {
  const [availableFiles, setAvailableFiles] = useState({
    init: [],
    banks: [],
    xml: [],
    wwu: [],
  });
  const [selectedFiles, setSelectedFiles] = useState({
    init: null,
    bank: null,
    xml: null,
    wwu: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    loadAvailableFiles();
  }, []);

  const loadAvailableFiles = async () => {
    try {
      const response = await files.list();
      const filesList = response.files || [];

      const init = filesList.filter(
        (f) => f.originalName.toLowerCase() === "init.bnk"
      );
      const banks = filesList.filter(
        (f) => f.fileType === ".bnk" && !init.includes(f)
      );
      const xml = filesList.filter((f) => f.fileType === ".xml");
      const wwu = filesList.filter((f) => f.fileType === ".wwu");

      setAvailableFiles({ init, banks, xml, wwu });

      if (init.length === 1 && banks.length === 1 && xml.length === 1) {
        setSelectedFiles({
          init: init[0],
          bank: banks[0],
          xml: xml[0],
          wwu: wwu.length === 1 ? wwu[0] : null,
        });
      }
    } catch (error) {
      console.error("Failed to load files:", error);
    }
  };

  const handleLoadSelected = async () => {
    if (!selectedFiles.init || !selectedFiles.bank || !selectedFiles.xml) {
      setStatus("❌ Please select Init, Bank, and XML files");
      return;
    }

    setIsLoading(true);
    setStatus("Loading selected files...");

    try {
      // Load XML first
      const xmlBlob = await files.download(selectedFiles.xml.id);
      const xmlText = await xmlBlob.text();
      let parsedData = xmlParser.parseSoundBanksInfo(xmlText);

      // Load and merge WWU data if available
      if (selectedFiles.wwu) {
        setStatus("Parsing Work Unit file for RTPC ranges...");
        const wwuBlob = await files.download(selectedFiles.wwu.id);
        const wwuText = await wwuBlob.text();
        const wwuData = wwuParser.parseWorkUnit(wwuText);

        // Merge RTPC data - WWU values take precedence
        if (wwuData.rtpcs.length > 0) {
          parsedData.rtpcs = wwuParser.mergeWithXmlRtpcs(
            wwuData.rtpcs,
            parsedData.rtpcs
          );
          // console.log("✅ Merged RTPC data from WWU file");
        }
      }
      // Initialize Wwise if needed
      if (!wwiseService.initialized) {
        await wwiseService.initialize();
        wwiseService.startAudioRendering();
      }

      // Load Init bank
      const initBlob = await files.download(selectedFiles.init.id);
      const initBuffer = await initBlob.arrayBuffer();
      await wwiseService.loadSoundBank(
        selectedFiles.init.originalName,
        initBuffer
      );

      // Load main bank
      const bankBlob = await files.download(selectedFiles.bank.id);
      const bankBuffer = await bankBlob.arrayBuffer();
      await wwiseService.loadSoundBank(
        selectedFiles.bank.originalName,
        bankBuffer
      );

      // Extract data
      const events = xmlParser.getEventNames(parsedData);
      const rtpcs = xmlParser.getRTPCNames(parsedData);
      const switches = parsedData.switches || [];
      const states = parsedData.states || [];
      wwiseService.setEvents(events);

      if (onFilesLoaded) {
        onFilesLoaded({
          initBank: selectedFiles.init,
          soundBank: selectedFiles.bank,
          xmlFile: selectedFiles.xml,
          events,
          rtpcs,
          switches,
          states,
        });
      }

      setStatus("✓ Files loaded successfully!");
      setIsLoading(false);
    } catch (error) {
      console.error("Load error:", error);
      setStatus(`❌ Error: ${error.message}`);
      setIsLoading(false);
    }
  };

  const handleDeleteFile = async (fileId, fileType) => {
    try {
      await files.delete(fileId);
      setStatus("✓ File deleted");
      await loadAvailableFiles();

      if (selectedFiles.init?.id === fileId) {
        setSelectedFiles({ ...selectedFiles, init: null });
      }
      if (selectedFiles.bank?.id === fileId) {
        setSelectedFiles({ ...selectedFiles, bank: null });
      }
      if (selectedFiles.xml?.id === fileId) {
        setSelectedFiles({ ...selectedFiles, xml: null });
      }
    } catch (error) {
      console.error("Delete error:", error);
      setStatus(`❌ Delete failed: ${error.message}`);
    }
  };

  const handleDeleteAll = async () => {
    const confirmText = "DELETE ALL FILES";
    const userInput = window.prompt(
      `⚠️ NUCLEAR OPTION ⚠️\n\nThis will DELETE ALL your uploaded files!\n\nType "${confirmText}" to confirm:`
    );

    if (userInput !== confirmText) {
      setStatus("Delete all cancelled");
      return;
    }

    setIsLoading(true);
    setStatus("Deleting all files...");

    try {
      await files.deleteAll();
      setAvailableFiles({ init: [], banks: [], xml: [] });
      setSelectedFiles({ init: null, bank: null, xml: null });
      setStatus("✓ All files deleted");
      setIsLoading(false);

      if (onFilesLoaded) {
        onFilesLoaded(null);
      }
    } catch (error) {
      console.error("Delete all error:", error);
      setStatus(`❌ Delete all failed: ${error.message}`);
      setIsLoading(false);
    }
  };

  const hasFiles =
    availableFiles.init.length > 0 ||
    availableFiles.banks.length > 0 ||
    availableFiles.xml.length > 0;

  return (
    <div className="card file-manager-card">
      <div
        className="card-header"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: "pointer" }}
      >
        <h2>FILE MANAGEMENT</h2>
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
        <div className="file-manager-content">
          {!hasFiles ? (
            <div className="no-files-message">
              <p className="text-muted">
                No files uploaded yet. Upload files below.
              </p>
            </div>
          ) : (
            <>
              <div className="file-selector-grid">
                {/* Init Bank Selector */}
                <div className="file-selector">
                  <label className="file-selector-label">
                    <span className="label-text">INIT BANK</span>
                    <span className="file-count">
                      {availableFiles.init.length}
                    </span>
                  </label>
                  <div className="selector-row">
                    <select
                      value={selectedFiles.init?.id || ""}
                      onChange={(e) => {
                        const file = availableFiles.init.find(
                          (f) => f.id === parseInt(e.target.value)
                        );
                        setSelectedFiles({ ...selectedFiles, init: file });
                      }}
                      disabled={availableFiles.init.length === 0}
                      className="file-dropdown"
                    >
                      <option value="">Choose...</option>
                      {availableFiles.init.map((file) => (
                        <option key={file.id} value={file.id}>
                          {file.originalName}
                        </option>
                      ))}
                    </select>
                    {selectedFiles.init && (
                      <button
                        onClick={() =>
                          handleDeleteFile(selectedFiles.init.id, "init")
                        }
                        className="delete-file-button"
                        title="Delete this file"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Sound Bank Selector */}
                <div className="file-selector">
                  <label className="file-selector-label">
                    <span className="label-text">SOUND BANK</span>
                    <span className="file-count">
                      {availableFiles.banks.length}
                    </span>
                  </label>
                  <div className="selector-row">
                    <select
                      value={selectedFiles.bank?.id || ""}
                      onChange={(e) => {
                        const file = availableFiles.banks.find(
                          (f) => f.id === parseInt(e.target.value)
                        );
                        setSelectedFiles({ ...selectedFiles, bank: file });
                      }}
                      disabled={availableFiles.banks.length === 0}
                      className="file-dropdown"
                    >
                      <option value="">Choose...</option>
                      {availableFiles.banks.map((file) => (
                        <option key={file.id} value={file.id}>
                          {file.originalName}
                        </option>
                      ))}
                    </select>
                    {selectedFiles.bank && (
                      <button
                        onClick={() =>
                          handleDeleteFile(selectedFiles.bank.id, "bank")
                        }
                        className="delete-file-button"
                        title="Delete this file"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* XML Selector */}
                <div className="file-selector">
                  <label className="file-selector-label">
                    <span className="label-text">XML FILE</span>
                    <span className="file-count">
                      {availableFiles.xml.length}
                    </span>
                  </label>
                  <div className="selector-row">
                    <select
                      value={selectedFiles.xml?.id || ""}
                      onChange={(e) => {
                        const file = availableFiles.xml.find(
                          (f) => f.id === parseInt(e.target.value)
                        );
                        setSelectedFiles({ ...selectedFiles, xml: file });
                      }}
                      disabled={availableFiles.xml.length === 0}
                      className="file-dropdown"
                    >
                      <option value="">Choose...</option>
                      {availableFiles.xml.map((file) => (
                        <option key={file.id} value={file.id}>
                          {file.originalName}
                        </option>
                      ))}
                    </select>
                    {selectedFiles.xml && (
                      <button
                        onClick={() =>
                          handleDeleteFile(selectedFiles.xml.id, "xml")
                        }
                        className="delete-file-button"
                        title="Delete this file"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="file-selector">
                <label className="file-selector-label">
                  <span className="label-text">
                    WORK UNIT (Optional - for RTPC ranges)
                  </span>
                  <span className="file-count">
                    {availableFiles.wwu.length}
                  </span>
                </label>
                <div className="selector-row">
                  <select
                    value={selectedFiles.wwu?.id || ""}
                    onChange={(e) => {
                      const file = availableFiles.wwu.find(
                        (f) => f.id === parseInt(e.target.value)
                      );
                      setSelectedFiles({ ...selectedFiles, wwu: file });
                    }}
                    disabled={availableFiles.wwu.length === 0}
                    className="file-dropdown"
                  >
                    <option value="">
                      {availableFiles.wwu.length === 0
                        ? "No WWU files"
                        : "Select for custom RTPC ranges..."}
                    </option>
                    {availableFiles.wwu.map((file) => (
                      <option key={file.id} value={file.id}>
                        {file.originalName}
                      </option>
                    ))}
                  </select>
                  {selectedFiles.wwu && (
                    <button
                      onClick={() =>
                        handleDeleteFile(selectedFiles.wwu.id, "wwu")
                      }
                      className="delete-file-button"
                      title="Delete this file"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              <div className="file-actions">
                <button
                  onClick={handleLoadSelected}
                  disabled={
                    !selectedFiles.init ||
                    !selectedFiles.bank ||
                    !selectedFiles.xml ||
                    isLoading
                  }
                  className="btn-primary load-button"
                >
                  LOAD SELECTED FILES
                </button>

                <button
                  onClick={handleDeleteAll}
                  disabled={isLoading}
                  className="btn-danger nuclear-button"
                >
                  ☢ DELETE ALL FILES
                </button>
              </div>

              {status && (
                <div
                  className={`status-message ${
                    status.includes("✓")
                      ? "success"
                      : status.includes("❌")
                      ? "error"
                      : ""
                  }`}
                >
                  {status}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default FileManager;
