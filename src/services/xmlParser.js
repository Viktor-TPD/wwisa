class XMLParser {
  parseSoundBanksInfo(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    // Check for parse errors
    const parseError = xmlDoc.querySelector("parsererror");
    if (parseError) {
      throw new Error("Failed to parse XML: " + parseError.textContent);
    }

    const soundBanks = [];
    const allEvents = [];
    const allMedia = [];

    // Get all SoundBank elements
    const soundBankElements = xmlDoc.querySelectorAll("SoundBank");

    soundBankElements.forEach((sbElement) => {
      const bankId = sbElement.getAttribute("Id");
      const bankType = sbElement.getAttribute("Type");
      const shortName = sbElement.querySelector("ShortName")?.textContent;
      const path = sbElement.querySelector("Path")?.textContent;

      // Parse Events
      const events = [];
      const eventElements = sbElement.querySelectorAll("Events > Event");
      eventElements.forEach((eventEl) => {
        const event = {
          id: eventEl.getAttribute("Id"),
          name: eventEl.getAttribute("Name"),
          mediaRefs: [],
        };

        // Get media references
        const mediaRefEls = eventEl.querySelectorAll("MediaRefs > MediaRef");
        mediaRefEls.forEach((refEl) => {
          event.mediaRefs.push(refEl.getAttribute("Id"));
        });

        events.push(event);
        allEvents.push(event);
      });

      // Parse Media files
      const media = [];
      const mediaElements = sbElement.querySelectorAll("Media > File");
      mediaElements.forEach((mediaEl) => {
        const mediaFile = {
          id: mediaEl.getAttribute("Id"),
          language: mediaEl.getAttribute("Language"),
          streaming: mediaEl.getAttribute("Streaming") === "true",
          location: mediaEl.getAttribute("Location"),
          shortName: mediaEl.querySelector("ShortName")?.textContent,
          cachePath: mediaEl.querySelector("CachePath")?.textContent,
        };

        media.push(mediaFile);
        allMedia.push(mediaFile);
      });

      soundBanks.push({
        id: bankId,
        type: bankType,
        name: shortName,
        path: path,
        events: events,
        media: media,
      });
    });

    console.log("📋 Parsed SoundbanksInfo.xml:");
    console.log(`  - ${soundBanks.length} bank(s)`);
    console.log(`  - ${allEvents.length} event(s)`);
    console.log(`  - ${allMedia.length} media file(s)`);

    return {
      soundBanks,
      events: allEvents,
      media: allMedia,
    };
  }

  // Get just the event names for display
  getEventNames(parsedData) {
    return parsedData.events.map((e) => ({
      name: e.name,
      id: e.id,
    }));
  }

  // Get required .wem files
  getRequiredWemFiles(parsedData) {
    return parsedData.media.map((m) => ({
      filename: m.cachePath,
      id: m.id,
    }));
  }
}

const xmlParser = new XMLParser();
export default xmlParser;
