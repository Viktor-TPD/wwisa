import React, { useState, useEffect } from 'react';
import { files as filesAPI } from '../services/api';
import wwiseService from '../services/wwise';
import xmlParser from '../services/xmlParser';
import '../styles/FileUpload.css';

function FileUpload({ onFilesLoaded }) {
  const [uploading, setUploading] = useState(false);
  const [initBank, setInitBank] = useState(null);
  const [soundBank, setSoundBank] = useState(null);
  const [xmlFile, setXmlFile] = useState(null);
  const [xmlData, setXmlData] = useState(null); // Store parsed XML
  const [wemFiles, setWemFiles] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);
  const [error, setError] = useState('');
  const [loadingExisting, setLoadingExisting] = useState(true);

  useEffect(() => {
    loadExistingFiles();
  }, []);

  const loadExistingFiles = async () => {
    try {
      const response = await filesAPI.list();
      setExistingFiles(response.files);
      console.log(`Found ${response.files.length} existing files`);
      
      await autoLoadRecentFiles(response.files);
      
    } catch (err) {
      console.error('Failed to load existing files:', err);
    } finally {
      setLoadingExisting(false);
    }
  };

  const autoLoadRecentFiles = async (files) => {
    const recentInit = files.find(f => f.originalName === 'Init.bnk');
    const recentBank = files.find(f => f.originalName === 'testBank.bnk');
    const recentXml = files.find(f => f.originalName === 'SoundbanksInfo.xml');
    const recentWems = files.filter(f => f.fileType === '.wem');

    if (recentInit && recentBank && recentXml && recentWems.length > 0) {
      console.log('Auto-loading recent files...');
      
      try {
        // First, parse XML to get the correct file paths
        const xmlText = await loadXmlFromBackend(recentXml);
        const parsedData = xmlParser.parseSoundBanksInfo(xmlText);
        setXmlData(parsedData);
        
        // Initialize Wwise
        if (!wwiseService.initialized) {
          await wwiseService.initialize();
        }
        
        // Load banks
        await loadFileFromBackend(recentInit);
        await loadFileFromBackend(recentBank);
        
        // Load .wem files with correct paths from XML
        await loadWemFilesWithPaths(recentWems, parsedData);

        // Set events
        const events = xmlParser.getEventNames(parsedData);
        wwiseService.setEvents(events);

        if (onFilesLoaded) {
          onFilesLoaded({ 
            initBank: recentInit, 
            soundBank: recentBank,
            xmlFile: recentXml,
            wemFiles: recentWems,
            events 
          });
        }

        console.log('✅ Auto-loaded existing files');
      } catch (err) {
        console.error('Auto-load failed:', err);
      }
    }
  };

  const loadWemFilesWithPaths = async (wemFiles, parsedData) => {
    // Create a map of .wem filenames to their CachePaths
    const wemPathMap = {};
    parsedData.media.forEach(media => {
      if (media.cachePath) {
        // Extract just the filename from the uploaded file
        const uploadedFilename = media.cachePath.split('/').pop();
        wemPathMap[uploadedFilename] = media.cachePath;
      }
    });

    console.log('📋 WEM Path mapping:', wemPathMap);

    for (const wemFile of wemFiles) {
      const blob = await filesAPI.download(wemFile.id);
      const arrayBuffer = await blob.arrayBuffer();
      
      // Get the correct path from XML
      const correctPath = wemPathMap[wemFile.originalName] || wemFile.originalName;
      console.log(`Loading ${wemFile.originalName} as ${correctPath}`);
      
      await wwiseService.loadWemFile(correctPath, arrayBuffer);
      setWemFiles(prev => [...prev, wemFile]);
    }
  };

  const loadFileFromBackend = async (fileMetadata) => {
    const blob = await filesAPI.download(fileMetadata.id);
    const arrayBuffer = await blob.arrayBuffer();

    if (!wwiseService.initialized) {
      await wwiseService.initialize();
    }

    if (fileMetadata.fileType === '.bnk') {
      await wwiseService.loadSoundBank(fileMetadata.originalName, arrayBuffer);
      
      if (fileMetadata.originalName === 'Init.bnk') {
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
    setError('');
    
    try {
      const fileArray = Array.from(files);
      
      // Validate file types
      if (type === 'init' || type === 'bank') {
        if (!fileArray[0].name.endsWith('.bnk')) {
          setError('Please upload a .bnk file');
          return;
        }
      } else if (type === 'xml') {
        if (!fileArray[0].name.endsWith('.xml')) {
          setError('Please upload SoundbanksInfo.xml');
          return;
        }
      } else if (type === 'wem') {
        const invalidFiles = fileArray.filter(f => !f.name.endsWith('.wem'));
        if (invalidFiles.length > 0) {
          setError('Please upload only .wem files');
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
        
        if (file.name.endsWith('.bnk')) {
          await wwiseService.loadSoundBank(file.name, arrayBuffer);
          
          if (type === 'init') {
            setInitBank({ name: file.name, size: file.size });
          } else {
            setSoundBank({ name: file.name, size: file.size });
          }
        } else if (file.name.endsWith('.wem')) {
          // Use correct path from XML if available
          let correctPath = file.name;
          if (xmlData) {
            const mediaMatch = xmlData.media.find(m => 
              m.cachePath && m.cachePath.endsWith(file.name)
            );
            if (mediaMatch) {
              correctPath = mediaMatch.cachePath;
            }
          }
          
          await wwiseService.loadWemFile(correctPath, arrayBuffer);
          setWemFiles(prev => [...prev, { name: file.name, size: file.size }]);
        } else if (file.name.endsWith('.xml')) {
          // Parse XML
          const text = await file.text();
          const parsedData = xmlParser.parseSoundBanksInfo(text);
          setXmlData(parsedData);
          
          const events = xmlParser.getEventNames(parsedData);
          wwiseService.setEvents(events);
          
          setXmlFile({ name: file.name, size: file.size });

          if (onFilesLoaded && soundBank) {
            onFilesLoaded({ 
              initBank, 
              soundBank, 
              xmlFile: { name: file.name, size: file.size },
              wemFiles, 
              events 
            });
          }
        }
      }

      await loadExistingFiles();

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload files');
    }
  };

  const FileSection = ({ title, description, type, file, files, accept, multiple = false }) => (
    <div className="file-section">
      <div className="section-header">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      
      <div className="section-body">
        {(file || (files && files.length > 0)) ? (
          <div className="uploaded-file">
            <div className="file-icon">✅</div>
            <div className="file-details">
              {file ? (
                <>
                  <div className="file-name">{file.originalName || file.name}</div>
                  <div className="file-size">{((file.fileSize || file.size) / 1024).toFixed(1)} KB</div>
                  {file.uploadedAt && (
                    <div className="file-timestamp">
                      {new Date(file.uploadedAt).toLocaleString()}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="file-name">{files.length} file(s) loaded</div>
                </>
              )}
            </div>
            <button 
              className="change-button"
              onClick={() => {
                if (type === 'init') setInitBank(null);
                else if (type === 'bank') setSoundBank(null);
                else if (type === 'xml') setXmlFile(null);
                else setWemFiles([]);
              }}
            >
              Change
            </button>
          </div>
        ) : (
          <label className="upload-button">
            <input
              type="file"
              accept={accept}
              multiple={multiple}
              onChange={(e) => handleFileUpload(e.target.files, type)}
              style={{ display: 'none' }}
            />
            📁 Choose File{multiple ? 's' : ''}
          </label>
        )}
      </div>
    </div>
  );

  const handleClearAll = async () => {
    try {
      await filesAPI.deleteAll();
      wwiseService.clearAll();
      setInitBank(null);
      setSoundBank(null);
      setXmlFile(null);
      setXmlData(null);
      setWemFiles([]);
      setError('');
      await loadExistingFiles();
      console.log('✓ Cleared all files');
    } catch (err) {
      console.error('Clear error:', err);
      setError('Failed to clear files');
    }
  };

  const allFilesLoaded = initBank && soundBank && xmlFile && wemFiles.length > 0;

  if (loadingExisting) {
    return <div className="loading">Loading your files...</div>;
  }

  return (
    <div className="file-upload-container">
      <div className="upload-grid">
        <FileSection
          title="1. Init.bnk"
          description="Required initialization bank"
          type="init"
          file={initBank}
          accept=".bnk"
        />

        <FileSection
          title="2. SoundBank (.bnk)"
          description="Your main sound bank with events"
          type="bank"
          file={soundBank}
          accept=".bnk"
        />

        <FileSection
          title="3. SoundbanksInfo.xml"
          description="Event and media metadata"
          type="xml"
          file={xmlFile}
          accept=".xml"
        />

        <FileSection
          title="4. Audio Files (.wem)"
          description="Audio media referenced by the SoundBank"
          type="wem"
          files={wemFiles}
          accept=".wem"
          multiple={true}
        />
      </div>

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

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
