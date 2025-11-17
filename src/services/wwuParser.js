const wwuParser = {
  /**
   * Parse Wwise Work Unit file to extract RTPC/GameParameter info
   */
  parseWorkUnit(wwuText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(wwuText, "text/xml");

    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      throw new Error("Failed to parse WWU file: " + parserError.textContent);
    }

    const rtpcs = this.extractGameParameters(xmlDoc);

    console.log("📋 Parsed Work Unit file:");
    console.log(`  - ${rtpcs.length} Game Parameter(s) found`);

    return { rtpcs };
  },

  /**
   * Extract GameParameters (RTPCs) from WWU
   */
  extractGameParameters(xmlDoc) {
    const rtpcs = [];

    // Find all GameParameter nodes in the work unit
    const gameParamNodes = xmlDoc.querySelectorAll("GameParameter");

    gameParamNodes.forEach((node) => {
      const rtpc = {
        id: node.getAttribute("ID"),
        name: node.getAttribute("Name"),

        // Look for PropertyList > Property nodes for min/max/default
        min: 0,
        max: 100,
        defaultValue: 50,
      };

      // Find PropertyList within this GameParameter
      const propertyList = node.querySelector("PropertyList");
      if (propertyList) {
        const properties = propertyList.querySelectorAll("Property");

        properties.forEach((prop) => {
          const name = prop.getAttribute("Name");
          const value = prop.getAttribute("Value");

          switch (name) {
            case "Min":
              rtpc.min = parseFloat(value);
              break;
            case "Max":
              rtpc.max = parseFloat(value);
              break;
            case "Default":
            case "InitialValue":
              rtpc.defaultValue = parseFloat(value);
              break;
          }
        });
      }

      // Also check for direct attributes (some WWU formats use this)
      if (node.hasAttribute("Min")) {
        rtpc.min = parseFloat(node.getAttribute("Min"));
      }
      if (node.hasAttribute("Max")) {
        rtpc.max = parseFloat(node.getAttribute("Max"));
      }
      if (node.hasAttribute("Default")) {
        rtpc.defaultValue = parseFloat(node.getAttribute("Default"));
      }

      console.log(`  Found RTPC: ${rtpc.name} (${rtpc.min} - ${rtpc.max})`);
      rtpcs.push(rtpc);
    });

    return rtpcs;
  },

  /**
   * Merge WWU RTPCs with XML metadata RTPCs
   * WWU values take precedence for min/max/default
   */
  mergeWithXmlRtpcs(wwuRtpcs, xmlRtpcs) {
    const merged = [...xmlRtpcs];

    wwuRtpcs.forEach((wwuRtpc) => {
      const existingIndex = merged.findIndex(
        (r) => r.name === wwuRtpc.name || r.id === wwuRtpc.id
      );

      if (existingIndex >= 0) {
        // Update with WWU values (more accurate)
        merged[existingIndex] = {
          ...merged[existingIndex],
          min: wwuRtpc.min,
          max: wwuRtpc.max,
          defaultValue: wwuRtpc.defaultValue,
        };
      } else {
        // Add new RTPC from WWU
        merged.push(wwuRtpc);
      }
    });

    return merged;
  },
};

export default wwuParser;
