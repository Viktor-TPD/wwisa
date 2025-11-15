/* global BigInt */

class WwiseService {
  constructor() {
    this.module = null;
    this.initialized = false;
    this.soundBanks = new Map();
    this.events = [];
    this.gameObjectID = 100;
    this.renderInterval = null;
    this.basePath = "/wem"; // Base path for Wwise to look for audio files
  }

  async loadModule() {
    return new Promise((resolve, reject) => {
      if (this.module) {
        resolve(this.module);
        return;
      }

      const script = document.createElement("script");
      script.src = "/wwise/wwise.profile.js";
      script.async = true;

      script.onload = async () => {
        try {
          this.module = await window.WwiseModule();

          // CRITICAL: Call organizeNamespaces to properly structure the API
          if (this.module.organizeNamespaces) {
            this.module.organizeNamespaces();
            console.log("✓ Organized Wwise API namespaces");
          }

          window.Module = this.module;
          window.__wwiseService = this;

          console.log("✓ Wwise WASM module loaded");
          resolve(this.module);
        } catch (error) {
          reject(error);
        }
      };

      script.onerror = () => {
        reject(new Error("Failed to load Wwise script"));
      };

      document.body.appendChild(script);
    });
  }

  async initialize() {
    if (this.initialized) {
      console.log("Wwise already initialized");
      return;
    }

    try {
      await this.loadModule();

      // Create directories
      if (this.module.FS) {
        try {
          this.module.FS.mkdir("/bnk");
          this.module.FS.mkdir("/wem");
          console.log("✓ Created /bnk and /wem directories");
        } catch (e) {
          // Directories might already exist
        }
      }

      console.log("Initializing Wwise...");

      // 1. Memory Manager
      const memResult = this.module.MemoryMgr.Init();
      console.log(
        "  MemoryMgr:",
        memResult.value === 1 ? "✓" : `✗ (${memResult.value})`
      );

      // 2. Stream Manager - CRITICAL: Set base path for audio files
      const stmResult = this.module.StreamMgr.Create();
      const stmSuccess =
        (typeof stmResult === "object" && stmResult.value === 1) ||
        stmResult === 1;
      console.log(
        "  StreamMgr:",
        stmSuccess ? "✓" : `✗ (${JSON.stringify(stmResult)})`
      );

      // CRITICAL: For embedded audio (Location="Memory"), set base path to empty
      // This tells Wwise to look inside the .bnk files, not in external filesystem
      if (this.module.StreamMgr.SetCurrentLanguage) {
        try {
          this.module.StreamMgr.SetCurrentLanguage("SFX");
          console.log(`  ✓ Language set to: SFX`);
        } catch (e) {
          console.warn("  ⚠️ Failed to set language:", e);
        }
      }

      // Try setting base path to empty or current directory
      if (this.module.StreamMgr.SetBasePath) {
        try {
          // Empty string tells Wwise to look in the .bnk files
          this.module.StreamMgr.SetBasePath("");
          console.log(`  ✓ Base path set to empty (embedded audio mode)`);
        } catch (e) {
          console.warn("  ⚠️ Failed to set base path:", e);
        }
      }

      console.log(`  ℹ️ Audio should be embedded in .bnk files`);

      // 3. Music Engine
      const musicResult = this.module.MusicEngine.Init();
      console.log(
        "  MusicEngine:",
        musicResult.value === 1 ? "✓" : `✗ (${musicResult.value})`
      );

      // 4. Sound Engine
      const seResult = this.module.SoundEngine.Init();
      console.log(
        "  SoundEngine:",
        seResult.value === 1 ? "✅ SUCCESS!" : `✗ (${seResult.value})`
      );

      if (seResult.value !== 1) {
        throw new Error(`SoundEngine_Init failed: ${seResult.value}`);
      }

      // 5. Register game object
      try {
        const gameObjIDBigInt = BigInt(this.gameObjectID);
        this.module.SoundEngine.RegisterGameObj(gameObjIDBigInt, "Player");
        console.log("  ✓ Game object registered (ID: 100)");
      } catch (e) {
        console.warn("  RegisterGameObj failed:", e.message);
      }

      this.initialized = true;
      console.log(
        "🎵 WWISE INITIALIZED! (Audio rendering will start after user gesture)"
      );

      // CRITICAL: Initialize the AudioWorklet after Wwise is ready
      // Wait a bit for worklet to be created, then send init message
      setTimeout(() => {
        this.initializeAudioWorklet();
      }, 500);
    } catch (error) {
      console.error("❌ Init failed:", error);
      throw error;
    }
  }

  initializeAudioWorklet() {
    try {
      // Get the first (and should be only) audio context
      const contextIds = Object.keys(this.module.Wwise.AudioContexts);
      if (contextIds.length === 0) {
        console.warn("⚠️ No Wwise AudioContexts found yet");
        return;
      }

      const ctxId = contextIds[0];
      const ctx = this.module.Wwise.AudioContexts[ctxId];

      if (!ctx.AudioWorkletNode) {
        console.warn("⚠️ AudioWorkletNode not created yet, will retry...");
        // Retry after another delay
        setTimeout(() => this.initializeAudioWorklet(), 500);
        return;
      }

      // Send initialization message to worklet
      const opts = {
        buffer: ctx.buffer,
        state: ctx.state,
        bufferlen: ctx.bufferLen,
        numbuffers: ctx.numBuffers,
        channelcount: ctx.channelCount,
        fields: this.module.Wwise.Fields,
      };

      console.log("📤 Initializing AudioWorklet with options:", opts);
      ctx.AudioWorkletNode.port.postMessage(opts);

      // Set up error handler
      ctx.AudioWorkletNode.onprocessorerror = (event) => {
        console.error("❌ AudioWorklet processor error:", event);
      };

      console.log("✅ AudioWorklet initialized and ready!");
    } catch (error) {
      console.error("❌ Failed to initialize AudioWorklet:", error);
    }
  }

  startAudioRendering() {
    if (this.renderInterval) {
      console.log("Audio rendering already started");
      return;
    }

    let frameCount = 0;
    this.renderInterval = setInterval(() => {
      try {
        if (
          this.module &&
          this.module.SoundEngine &&
          this.module.SoundEngine.RenderAudio
        ) {
          this.module.SoundEngine.RenderAudio();
          frameCount++;

          // Log every 5 seconds (at ~100fps = 500 frames)
          if (frameCount % 500 === 0) {
            console.log(`🎵 Rendered ${frameCount} audio frames`);

            // Check the Wwise audio contexts
            if (this.module.Wwise?.AudioContexts) {
              const contexts = Object.keys(this.module.Wwise.AudioContexts);
              console.log(`  Active audio contexts: ${contexts.length}`);

              // Check AudioContext state
              contexts.forEach((id) => {
                const ctx = this.module.Wwise.AudioContexts[id];
                if (ctx.WebAudioContext) {
                  console.log(
                    `  Context ${id} state: ${ctx.WebAudioContext.state}`
                  );
                }
              });
            }
          }
        }
      } catch (e) {
        console.error("RenderAudio error:", e);
      }
    }, 10); // 10ms = ~100fps audio rendering

    console.log("🎵 Audio rendering loop started!");
  }

  stopAudioRendering() {
    if (this.renderInterval) {
      clearInterval(this.renderInterval);
      this.renderInterval = null;
      console.log("⏹ Audio rendering stopped");
    }
  }

  listFiles() {
    if (!this.module || !this.module.FS) return;

    console.log("=== Virtual Filesystem ===");
    try {
      const bnkFiles = this.module.FS.readdir("/bnk");
      console.log(
        "📁 /bnk:",
        bnkFiles.filter((f) => f !== "." && f !== "..")
      );

      const wemFiles = this.module.FS.readdir("/wem");
      console.log(
        "📁 /wem:",
        wemFiles.filter((f) => f !== "." && f !== "..")
      );

      // Check inside subdirectories
      try {
        const sfxFiles = this.module.FS.readdir("/wem/SFX");
        console.log(
          "📁 /wem/SFX:",
          sfxFiles.filter((f) => f !== "." && f !== "..")
        );
      } catch (e) {
        // SFX folder doesn't exist yet
      }
    } catch (e) {
      console.error("Failed to list files:", e);
    }
  }

  async loadSoundBank(filename, fileData) {
    if (!this.initialized) {
      throw new Error("Wwise not initialized");
    }

    // Check if bank is already loaded
    if (this.soundBanks.has(filename)) {
      console.log(`  ℹ️ Bank "${filename}" already loaded, skipping`);
      return { success: true, filename, alreadyLoaded: true };
    }

    try {
      const uint8Array = new Uint8Array(fileData);
      const path = `/bnk/${filename}`;

      console.log(`📁 Loading bank: ${filename}`);

      // Check if file already exists in filesystem
      try {
        const exists = this.module.FS.analyzePath(path).exists;
        if (exists) {
          console.log(`  ⚠️ File already exists at ${path}, overwriting...`);
          this.module.FS.unlink(path);
        }
      } catch (e) {
        // File doesn't exist, which is fine
      }

      this.module.FS.writeFile(path, uint8Array);
      console.log(`  ✓ Written to ${path} (${uint8Array.length} bytes)`);

      // Verify file was written
      const written = this.module.FS.readFile(path);
      console.log(`  ✓ Verified: ${written.length} bytes in filesystem`);

      // Try loading the bank - use namespaced API (after organizeNamespaces)
      let result;
      try {
        if (this.module.SoundEngine && this.module.SoundEngine.LoadBank) {
          result = this.module.SoundEngine.LoadBank(path);
        } else {
          // Fallback to flat API
          result = this.module.SoundEngine_LoadBank(path);
        }
        console.log(`  LoadBank result:`, result);
        console.log(`  LoadBank result type:`, typeof result);
        console.log(`  LoadBank result value:`, result?.value);
      } catch (loadError) {
        console.error(`  ❌ LoadBank threw error:`, loadError);
        throw loadError;
      }

      // Handle different return types
      if (result === 1 || (result && result.value === 1)) {
        console.log(`  ✅ Bank loaded successfully!`);
        this.soundBanks.set(filename, path);

        // After loading a bank, list files to verify
        this.listFiles();

        return { success: true, filename };
      } else {
        const errorCodes = {
          69: "AK_FileNotFound - Audio files referenced by bank not found",
          50: "AK_InvalidFile - Invalid or corrupted bank file",
          2: "AK_Fail - General failure",
          52: "AK_InvalidParameter - Invalid parameter",
        };
        const errorValue =
          typeof result === "object" && result.value ? result.value : result;
        const errorMsg =
          errorCodes[errorValue] || `Unknown error code: ${errorValue}`;
        console.error(`  ❌ LoadBank failed: ${errorMsg}`);
        throw new Error(`LoadBank failed: ${errorMsg}`);
      }

      this.soundBanks.set(filename, path);
      return { success: true, filename };
    } catch (error) {
      console.error("Failed to load sound bank:", error);
      throw error;
    }
  }

  // DEPRECATED: .wem files are embedded in .bnk files
  // This method is kept for backwards compatibility but should not be used
  async loadWemFile(filename, fileData) {
    console.warn(
      "⚠️ loadWemFile is deprecated - .wem files are embedded in .bnk files"
    );
    console.warn(
      "   If you're seeing this, remove the .wem upload functionality"
    );

    // Still implement it in case someone has old code calling it
    if (!this.initialized) {
      throw new Error("Wwise not initialized");
    }

    try {
      const uint8Array = new Uint8Array(fileData);
      const path = `/wem/${filename}`;

      // Create subdirectories if needed
      const parts = filename.split("/");
      if (parts.length > 1) {
        let currentPath = "/wem";
        for (let i = 0; i < parts.length - 1; i++) {
          currentPath += "/" + parts[i];
          try {
            this.module.FS.mkdir(currentPath);
            console.log(`  ✓ Created: ${currentPath}`);
          } catch (e) {
            // Directory already exists
          }
        }
      }

      console.log(`📁 Loading .wem: ${filename}`);
      this.module.FS.writeFile(path, uint8Array);
      console.log(`  ✓ Written to ${path}`);

      return { success: true, filename };
    } catch (error) {
      console.error("Failed to load .wem:", error);
      throw error;
    }
  }

  setEvents(events) {
    this.events = events;
    console.log(
      `📋 ${events.length} event(s) set:`,
      events.map((e) => e.name)
    );
  }

  getEvents() {
    return this.events;
  }

  postEvent(eventName) {
    if (!this.initialized) {
      throw new Error("Wwise not initialized");
    }

    try {
      console.log(`▶ Posting event: "${eventName}"`);

      // Show filesystem state before posting
      this.listFiles();

      const gameObjIDBigInt = BigInt(this.gameObjectID);
      const playingID = this.module.SoundEngine.PostEvent(
        eventName,
        gameObjIDBigInt
      );

      console.log(`  Playing ID returned: ${playingID}`);

      if (playingID > 0) {
        console.log(`🔊 Event posted successfully! Playing ID: ${playingID}`);
        return { success: true, eventName, playingID };
      } else {
        console.warn(`⚠️ Playing ID is 0 or negative`);
        console.warn(`   This usually means:`);
        console.warn(`   1. Event name not found in loaded banks`);
        console.warn(`   2. Banks not loaded properly`);
        console.warn(`   3. Audio files missing`);
        return { success: false, eventName };
      }
    } catch (error) {
      console.error("PostEvent error:", error);
      throw error;
    }
  }

  stopAll() {
    if (!this.initialized) return;

    try {
      const gameObjIDBigInt = BigInt(this.gameObjectID);
      this.module.SoundEngine.StopAll(gameObjIDBigInt);
      console.log("⏹ Stopped all audio");
    } catch (error) {
      console.error("Stop error:", error);
    }
  }

  clearAll() {
    this.stopAll();
    this.soundBanks.clear();
    this.events = [];

    if (
      this.module &&
      this.module.SoundEngine &&
      this.module.SoundEngine.ClearBanks
    ) {
      try {
        this.module.SoundEngine.ClearBanks();
        console.log("✓ Cleared all banks");
      } catch (e) {
        console.error("Error clearing banks:", e);
      }
    }
  }

  terminate() {
    this.stopAudioRendering();

    if (this.initialized && this.module) {
      try {
        const gameObjIDBigInt = BigInt(this.gameObjectID);
        if (
          this.module.SoundEngine &&
          this.module.SoundEngine.UnregisterGameObj
        ) {
          this.module.SoundEngine.UnregisterGameObj(gameObjIDBigInt);
        }
        if (this.module.SoundEngine && this.module.SoundEngine.Term) {
          this.module.SoundEngine.Term();
        }
        if (this.module.MusicEngine && this.module.MusicEngine.Term) {
          this.module.MusicEngine.Term();
        }
        if (this.module.MemoryMgr && this.module.MemoryMgr.Term) {
          this.module.MemoryMgr.Term();
        }
        console.log("✓ Wwise terminated");
      } catch (e) {
        console.error("Error during termination:", e);
      }
    }

    this.initialized = false;
  }
}

export default new WwiseService();
