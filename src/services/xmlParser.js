const xmlParser = {
  /**
   * Parse SoundbanksInfo.xml and extract all data
   */
  parseSoundBanksInfo(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      throw new Error("Failed to parse XML: " + parserError.textContent);
    }

    const banks = this.extractBanks(xmlDoc);
    const events = this.extractEvents(xmlDoc);
    const media = this.extractMedia(xmlDoc);
    const rtpcs = this.extractRTPCs(xmlDoc);
    const switches = this.extractSwitches(xmlDoc);
    const states = this.extractStates(xmlDoc);

    // console.log("📋 Parsed SoundbanksInfo.xml:");
    // console.log(`  - ${banks.length} bank(s)`);
    // console.log(`  - ${events.length} event(s)`);
    // console.log(`  - ${media.length} media file(s)`);
    // console.log(`  - ${rtpcs.length} RTPC(s)`);
    // console.log(`  - ${switches.length} switch(es)`);
    // console.log(`  - ${states.length} state(s)`);

    return {
      banks,
      events,
      media,
      rtpcs,
      switches,
      states,
    };
  },

  /**
   * Extract soundbank information
   */
  extractBanks(xmlDoc) {
    const banks = [];
    const bankNodes = xmlDoc.querySelectorAll("SoundBank");

    bankNodes.forEach((node) => {
      banks.push({
        id: node.getAttribute("Id"),
        name: node.querySelector("ShortName")?.textContent || "",
        path: node.querySelector("Path")?.textContent || "",
        type: node.getAttribute("Type"),
        language: node.getAttribute("Language"),
      });
    });

    return banks;
  },

  /**
   * Extract events
   */
  extractEvents(xmlDoc) {
    const events = [];
    const eventNodes = xmlDoc.querySelectorAll("Event");

    eventNodes.forEach((node) => {
      events.push({
        id: node.getAttribute("Id"),
        name: node.getAttribute("Name"),
      });
    });

    return events;
  },

  /**
   * Extract media files
   */
  extractMedia(xmlDoc) {
    const media = [];
    const fileNodes = xmlDoc.querySelectorAll("File");

    fileNodes.forEach((node) => {
      media.push({
        id: node.getAttribute("Id"),
        shortName: node.querySelector("ShortName")?.textContent || "",
        cachePath: node.querySelector("CachePath")?.textContent || "",
        language: node.getAttribute("Language"),
        streaming: node.getAttribute("Streaming") === "true",
        location: node.getAttribute("Location"),
      });
    });

    return media;
  },

  /**
   * Extract RTPCs (Game Parameters)
   * ✅ FIX: Deduplicate by ID - Wwise sometimes exports duplicates
   */
  extractRTPCs(xmlDoc) {
    const rtpcNodes = xmlDoc.querySelectorAll("GameParameter");
    const seenIds = new Set();
    const rtpcs = [];

    rtpcNodes.forEach((node) => {
      const id = node.getAttribute("Id");

      // ✅ Skip if we've already seen this ID
      if (seenIds.has(id)) {
        // console.log(`  ℹ️ Skipping duplicate RTPC ID: ${id}`);
        return;
      }

      const rtpc = {
        id: id,
        name: node.getAttribute("Name"),
        min: parseFloat(node.getAttribute("Min") || 0),
        max: parseFloat(node.getAttribute("Max") || 100),
        defaultValue: parseFloat(node.getAttribute("Default") || 50),
      };

      // Filter out factory acoustic textures (optional)
      if (!rtpc.name.includes("Factory Acoustic Textures")) {
        rtpcs.push(rtpc);
        seenIds.add(id);
      }
    });

    return rtpcs;
  },

  /**
   * Extract Switches
   */
  extractSwitches(xmlDoc) {
    const switches = [];
    const switchNodes = xmlDoc.querySelectorAll("SwitchGroup");

    switchNodes.forEach((groupNode) => {
      const groupName = groupNode.getAttribute("Name");
      const values = [];

      groupNode.querySelectorAll("SwitchValue").forEach((valueNode) => {
        values.push({
          id: valueNode.getAttribute("Id"),
          name: valueNode.getAttribute("Name"),
        });
      });

      switches.push({
        id: groupNode.getAttribute("Id"),
        name: groupName,
        values,
      });
    });

    return switches;
  },

  /**
   * Extract States
   */
  extractStates(xmlDoc) {
    const states = [];
    const stateNodes = xmlDoc.querySelectorAll("StateGroup");

    stateNodes.forEach((groupNode) => {
      const groupName = groupNode.getAttribute("Name");
      const values = [];

      groupNode.querySelectorAll("StateValue").forEach((valueNode) => {
        values.push({
          id: valueNode.getAttribute("Id"),
          name: valueNode.getAttribute("Name"),
        });
      });

      states.push({
        id: groupNode.getAttribute("Id"),
        name: groupName,
        values,
      });
    });

    return states;
  },

  /**
   * Get event names as simple array
   */
  getEventNames(parsedData) {
    return parsedData.events.map((event) => ({
      name: event.name,
      id: event.id,
    }));
  },

  /**
   * Get RTPC names as simple array
   */
  getRTPCNames(parsedData) {
    return parsedData.rtpcs.map((rtpc) => ({
      name: rtpc.name,
      id: rtpc.id,
      min: rtpc.min,
      max: rtpc.max,
      defaultValue: rtpc.defaultValue,
    }));
  },
};

export default xmlParser;
