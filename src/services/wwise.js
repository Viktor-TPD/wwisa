/* global BigInt */

class WwiseService {
  constructor() {
    this.module = null;
    this.initialized = false;
    this.soundBanks = new Map();
    this.events = [];
    this.gameObjectID = 100;
    this.renderInterval = null;
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
          console.log("✓ Created directories");
        } catch (e) {
          console.log("Directories exist");
        }
      }

      console.log("Initializing Wwise Sound Engine...");

      // Initialize Memory Manager with settings
      try {
        const memResult = this.module.MemoryMgr_Init();
        console.log("  MemoryMgr result:", memResult);
      } catch (e) {
        console.error("MemoryMgr failed:", e);
      }

      // Initialize Music Engine with settings
      try {
        const musicResult = this.module.MusicEngine_Init();
        console.log("  MusicEngine result:", musicResult);
      } catch (e) {
        console.error("MusicEngine failed:", e);
      }

      // Initialize Sound Engine with AkAudioSettings
      try {
        const seResult = this.module.SoundEngine_Init();
        console.log("  SoundEngine_Init result:", seResult);

        if (seResult && seResult.value === 1) {
          console.log("✓ Sound Engine initialized successfully!");
        } else if (seResult && seResult.value) {
          console.warn(`  ⚠️ Init returned: ${seResult.value}`);
        }
      } catch (e) {
        console.error("SoundEngine_Init error:", e);
        throw e;
      }

      // Register game object
      try {
        const gameObjIDBigInt = BigInt(this.gameObjectID);
        const regResult = this.module.SoundEngine_RegisterGameObj(
          gameObjIDBigInt,
          "Player"
        );
        console.log("  RegisterGameObj result:", regResult);
        console.log("✓ Game object registered");
      } catch (e) {
        console.warn("RegisterGameObj failed:", e.message);
      }

      this.startAudioRendering();

      this.initialized = true;
      console.log("✅ Wwise fully initialized!");
    } catch (error) {
      console.error("❌ Initialization failed:", error);
      throw error;
    }
  }

  startAudioRendering() {
    this.renderInterval = setInterval(() => {
      try {
        if (this.module && this.module.SoundEngine_RenderAudio) {
          this.module.SoundEngine_RenderAudio(false);
        }
      } catch (e) {}
    }, 16);
  }

  stopAudioRendering() {
    if (this.renderInterval) {
      clearInterval(this.renderInterval);
      this.renderInterval = null;
    }
  }

  listFiles() {
    if (!this.module || !this.module.FS) return;

    console.log("=== Virtual Filesystem ===");
    try {
      const bnkFiles = this.module.FS.readdir("/bnk");
      console.log(
        "/bnk:",
        bnkFiles.filter((f) => f !== "." && f !== "..")
      );

      const wemFiles = this.module.FS.readdir("/wem");
      console.log(
        "/wem:",
        wemFiles.filter((f) => f !== "." && f !== "..")
      );

      // Check inside SFX folder
      try {
        const sfxFiles = this.module.FS.readdir("/wem/SFX");
        console.log(
          "/wem/SFX:",
          sfxFiles.filter((f) => f !== "." && f !== "..")
        );
      } catch (e) {}
    } catch (e) {
      console.error("Failed to list files:", e);
    }
  }

  async loadSoundBank(filename, fileData) {
    if (!this.initialized) {
      throw new Error("Wwise not initialized");
    }

    try {
      const uint8Array = new Uint8Array(fileData);
      const path = `/bnk/${filename}`;

      console.log(`📁 Loading bank: ${filename}`);

      this.module.FS.writeFile(path, uint8Array);
      console.log(`  ✓ Written to ${path}`);

      const result = this.module.SoundEngine_LoadBank(path);
      console.log(`  LoadBank result:`, result);

      if (result && result.value) {
        if (result.value === 1) {
          console.log(`  ✅ Bank loaded successfully!`);
          this.soundBanks.set(filename, path);
          return { success: true, filename };
        } else {
          console.error(`  ❌ LoadBank failed with code: ${result.value}`);
          throw new Error(`LoadBank failed: ${result.value}`);
        }
      }

      this.soundBanks.set(filename, path);
      return { success: true, filename };
    } catch (error) {
      console.error("Failed to load sound bank:", error);
      throw error;
    }
  }

  async loadWemFile(filename, fileData) {
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
          } catch (e) {}
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
    this.listFiles();
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
      this.listFiles();

      const gameObjIDBigInt = BigInt(this.gameObjectID);
      const playingID = this.module.SoundEngine_PostEvent(
        eventName,
        gameObjIDBigInt
      );

      console.log(`  Playing ID: ${playingID}`);

      if (playingID > 0) {
        console.log(`🔊 AUDIO PLAYING!`);
        return { success: true, eventName, playingID };
      } else {
        console.warn(`⚠️ Playing ID is 0 - check Sound Engine initialization`);
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
      this.module.SoundEngine_StopAll(gameObjIDBigInt);
      console.log("⏹ Stopped");
    } catch (error) {
      console.error("Stop error:", error);
    }
  }

  clearAll() {
    this.stopAll();
    this.soundBanks.clear();
    this.events = [];

    if (this.module && this.module.SoundEngine_ClearBanks) {
      try {
        this.module.SoundEngine_ClearBanks();
      } catch (e) {}
    }

    console.log("✓ Cleared");
  }

  terminate() {
    this.stopAudioRendering();

    if (this.initialized && this.module) {
      try {
        const gameObjIDBigInt = BigInt(this.gameObjectID);
        if (this.module.SoundEngine_UnregisterGameObj) {
          this.module.SoundEngine_UnregisterGameObj(gameObjIDBigInt);
        }
        if (this.module.SoundEngine_Term) this.module.SoundEngine_Term();
        if (this.module.MusicEngine_Term) this.module.MusicEngine_Term();
        if (this.module.MemoryMgr_Term) this.module.MemoryMgr_Term();
      } catch (e) {}
    }

    this.initialized = false;
  }
}

export default new WwiseService();
