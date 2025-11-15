/* global BigInt */

class WwiseService {
  constructor() {
    this.module = null;
    this.initialized = false;
    this.soundBanks = new Map();
    this.events = [];
    this.gameObjectID = 100;
    this.renderInterval = null;
    this.basePath = "/wem";
  }

  async loadModule() {
    return new Promise((resolve, reject) => {
      if (this.module) {
        resolve(this.module);
        return;
      }

      const script = document.createElement("script");
      script.src = "/wwise/wwise.profile.js"; // ← YOUR NEW FILE!
      script.async = true;

      script.onload = async () => {
        try {
          this.module = await window.WwiseModule(); // ← Works now!

          // Call organizeNamespaces to structure the API
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

      console.log("Initializing Wwise subsystems...");

      // 1. Memory Manager
      const memResult = this.module.MemoryMgr.Init();
      console.log(
        "  MemoryMgr:",
        memResult.value === 1 ? "✓" : `✗ (${memResult.value})`
      );

      // 2. Stream Manager
      const stmResult = this.module.StreamMgr.Create();
      const stmSuccess =
        (typeof stmResult === "object" && stmResult.value === 1) ||
        stmResult === 1;
      console.log(
        "  StreamMgr:",
        stmSuccess ? "✓" : `✗ (${JSON.stringify(stmResult)})`
      );

      // Set language
      if (this.module.StreamMgr.SetCurrentLanguage) {
        try {
          this.module.StreamMgr.SetCurrentLanguage("SFX");
          console.log(`  ✓ Language set to: SFX`);
        } catch (e) {
          console.warn("  ⚠️ Failed to set language:", e);
        }
      }

      // Set base path to empty for embedded audio
      if (this.module.StreamMgr.SetBasePath) {
        try {
          this.module.StreamMgr.SetBasePath("");
          console.log(`  ✓ Base path set (embedded audio mode)`);
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
        seResult.value === 1 ? "✅" : `✗ (${seResult.value})`
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
      console.log("🎵 WWISE INITIALIZED!");

      return true;
    } catch (error) {
      console.error("Failed to initialize Wwise:", error);
      throw error;
    }
  }

  startAudioRendering() {
    if (this.renderInterval) {
      console.log("Audio rendering already started");
      return;
    }

    if (!this.initialized || !this.module) {
      console.error("Cannot start rendering - Wwise not initialized");
      return;
    }

    // Define the render loop function
    const renderLoop = () => {
      if (this.module && this.module.SoundEngine && this.module.StreamMgr) {
        // CRITICAL: Call PerformIO BEFORE RenderAudio
        this.module.StreamMgr.PerformIO();

        // Then render audio
        this.module.SoundEngine.RenderAudio();
      }

      // Schedule next frame
      this.renderInterval = requestAnimationFrame(renderLoop);
    };

    // Start the loop
    this.renderInterval = requestAnimationFrame(renderLoop);
    console.log("✓ Audio rendering started with requestAnimationFrame");
  }

  stopAudioRendering() {
    if (this.renderInterval) {
      cancelAnimationFrame(this.renderInterval);
      this.renderInterval = null;
      console.log("✓ Audio rendering stopped");
    }
  }

  stopAll() {
    if (!this.initialized) {
      console.warn("Cannot stop - Wwise not initialized");
      return;
    }

    try {
      this.module.SoundEngine.StopAll();
      console.log("🔇 Stopped all sounds");
    } catch (error) {
      console.error("Failed to stop all sounds:", error);
    }
  }

  listFiles() {
    if (!this.module || !this.module.FS) {
      console.warn("Filesystem not available");
      return;
    }

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
    } catch (e) {
      console.error("Failed to list files:", e);
    }
  }

  async loadSoundBank(filename, fileData) {
    if (!this.initialized) {
      throw new Error("Wwise not initialized");
    }

    if (this.soundBanks.has(filename)) {
      console.log(`  ℹ️ Bank "${filename}" already loaded, skipping`);
      return { success: true, filename, alreadyLoaded: true };
    }

    try {
      const uint8Array = new Uint8Array(fileData);
      const path = `/bnk/${filename}`;

      console.log(`📁 Loading bank: ${filename}`);

      try {
        const exists = this.module.FS.analyzePath(path).exists;
        if (exists) {
          console.log(`  ⚠️ File already exists at ${path}, overwriting...`);
          this.module.FS.unlink(path);
        }
      } catch (e) {
        // File doesn't exist
      }

      this.module.FS.writeFile(path, uint8Array);
      console.log(`  ✓ Written to ${path} (${uint8Array.length} bytes)`);

      const result = this.module.SoundEngine.LoadBank(path);
      console.log(`  LoadBank result:`, result);

      const success = result === 1 || result?.value === 1;
      if (success) {
        console.log(`  ✅ Bank loaded successfully!`);
        this.soundBanks.set(filename, path);

        // List files after loading
        this.listFiles();

        return { success: true, filename };
      } else {
        const errorCodes = {
          69: "AK_FileNotFound",
          50: "AK_InvalidFile",
          2: "AK_Fail",
          52: "AK_InvalidParameter",
        };
        const errorValue = typeof result === "object" ? result.value : result;
        const errorMsg =
          errorCodes[errorValue] || `Unknown error: ${errorValue}`;
        throw new Error(`LoadBank failed: ${errorMsg}`);
      }
    } catch (error) {
      console.error("Failed to load sound bank:", error);
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
        console.warn(`⚠️ Playing ID is 0 - event may not have triggered`);
        return {
          success: false,
          eventName,
          playingID,
          error: "Event not triggered",
        };
      }
    } catch (error) {
      console.error("Failed to post event:", error);
      throw error;
    }
  }
}

const wwiseService = new WwiseService();
export default wwiseService;
