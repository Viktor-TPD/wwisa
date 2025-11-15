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
      script.src = "/wwise/IntegrationDemo.js";
      script.async = true;

      script.onload = () => {
        console.log("✓ Script loaded, waiting for module initialization...");

        // IntegrationDemo.js doesn't use WwiseModule export
        // Instead it sets up the module globally or via Module object
        const checkModule = setInterval(() => {
          // Check for Module object (Emscripten default)
          if (window.Module && typeof window.Module === "object") {
            clearInterval(checkModule);

            this.module = window.Module;
            console.log("✓ Found Emscripten Module object");

            // Wait for WASM to be ready
            if (this.module.calledRun) {
              this.setupModule();
              resolve(this.module);
            } else {
              this.module.onRuntimeInitialized = () => {
                console.log("✓ WASM runtime initialized");
                this.setupModule();
                resolve(this.module);
              };
            }
          }
        }, 100);

        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkModule);
          reject(new Error("Module initialization timeout"));
        }, 10000);
      };

      script.onerror = () => {
        reject(new Error("Failed to load Wwise script"));
      };

      document.body.appendChild(script);
    });
  }

  setupModule() {
    // The IntegrationDemo might already have namespaces organized
    // Check if we need to call organizeNamespaces
    if (
      this.module.organizeNamespaces &&
      typeof this.module.organizeNamespaces === "function"
    ) {
      this.module.organizeNamespaces();
      console.log("✓ Organized Wwise API namespaces");
    } else if (this.module.SoundEngine && this.module.MemoryMgr) {
      console.log("✓ Namespaces already organized");
    } else {
      console.warn("⚠️ Wwise API structure unclear, attempting to continue...");
    }

    window.Module = this.module;
    window.__wwiseService = this;
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
          console.log("ℹ️ Directories may already exist");
        }
      }

      console.log("Initializing Wwise subsystems...");

      // Access the API - try both namespaced and flat approaches
      const MemoryMgr = this.module.MemoryMgr || this.module;
      const StreamMgr = this.module.StreamMgr || this.module;
      const MusicEngine = this.module.MusicEngine || this.module;
      const SoundEngine = this.module.SoundEngine || this.module;

      // 1. Memory Manager
      const memInit = MemoryMgr.Init || MemoryMgr.MemoryMgr_Init;
      if (memInit) {
        const memResult = memInit.call(MemoryMgr);
        console.log(
          "  MemoryMgr:",
          memResult?.value === 1 ? "✓" : `✗ (${memResult})`
        );
      }

      // 2. Stream Manager
      const stmCreate = StreamMgr.Create || StreamMgr.StreamMgr_Create;
      if (stmCreate) {
        const stmResult = stmCreate.call(StreamMgr);
        console.log(
          "  StreamMgr:",
          stmResult?.value === 1 || stmResult === 1 ? "✓" : `✗ (${stmResult})`
        );

        // Set language
        const setLang =
          StreamMgr.SetCurrentLanguage ||
          StreamMgr.StreamMgr_SetCurrentLanguage;
        if (setLang) {
          try {
            setLang.call(StreamMgr, "SFX");
            console.log("  ✓ Language set to: SFX");
          } catch (e) {
            console.warn("  ⚠️ Failed to set language:", e);
          }
        }

        // Set base path
        const setBase =
          StreamMgr.SetBasePath || StreamMgr.StreamMgr_SetBasePath;
        if (setBase) {
          try {
            setBase.call(StreamMgr, "");
            console.log("  ✓ Base path set (embedded audio mode)");
          } catch (e) {
            console.warn("  ⚠️ Failed to set base path:", e);
          }
        }
      }

      // 3. Music Engine
      const musicInit = MusicEngine.Init || MusicEngine.MusicEngine_Init;
      if (musicInit) {
        const musicResult = musicInit.call(MusicEngine);
        console.log(
          "  MusicEngine:",
          musicResult?.value === 1 ? "✓" : `✗ (${musicResult})`
        );
      }

      // 4. Sound Engine
      const seInit = SoundEngine.Init || SoundEngine.SoundEngine_Init;
      if (seInit) {
        const seResult = seInit.call(SoundEngine);
        console.log(
          "  SoundEngine:",
          seResult?.value === 1 ? "✅" : `✗ (${seResult})`
        );

        if (seResult?.value !== 1 && seResult !== 1) {
          throw new Error(`SoundEngine_Init failed: ${seResult}`);
        }
      }

      // 5. Register game object
      const regObj =
        SoundEngine.RegisterGameObj || SoundEngine.SoundEngine_RegisterGameObj;
      if (regObj) {
        try {
          const gameObjIDBigInt = BigInt(this.gameObjectID);
          regObj.call(SoundEngine, gameObjIDBigInt, "Player");
          console.log("  ✓ Game object registered (ID: 100)");
        } catch (e) {
          console.warn("  RegisterGameObj failed:", e.message);
        }
      }

      this.initialized = true;
      console.log("🎵 WWISE INITIALIZED!");

      return true;
    } catch (error) {
      console.error("Failed to initialize Wwise:", error);
      throw error;
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

      // Load the bank - try both API styles
      const SoundEngine = this.module.SoundEngine || this.module;
      const loadBank = SoundEngine.LoadBank || SoundEngine.SoundEngine_LoadBank;

      let result;
      if (loadBank) {
        result = loadBank.call(SoundEngine, path);
        console.log(`  LoadBank result:`, result);
      } else {
        throw new Error("LoadBank function not found");
      }

      const success = result === 1 || result?.value === 1;
      if (success) {
        console.log(`  ✅ Bank loaded successfully!`);
        this.soundBanks.set(filename, path);
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

      const SoundEngine = this.module.SoundEngine || this.module;
      const postEvent =
        SoundEngine.PostEvent || SoundEngine.SoundEngine_PostEvent;

      if (!postEvent) {
        throw new Error("PostEvent function not found");
      }

      const gameObjIDBigInt = BigInt(this.gameObjectID);
      const playingID = postEvent.call(SoundEngine, eventName, gameObjIDBigInt);

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

export default new WwiseService();
