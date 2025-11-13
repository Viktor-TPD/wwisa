import React from "react";
import wwiseService from "../services/wwise";
import "../styles/EventList.css";

function EventList({ events }) {
  const handlePlayEvent = (eventName) => {
    try {
      wwiseService.postEvent(eventName);
      console.log(`▶ Playing: ${eventName}`);
    } catch (error) {
      console.error("Failed to play event:", error);
    }
  };

  const handleStopAll = () => {
    wwiseService.stopAll();
  };

  if (!events || events.length === 0) {
    return (
      <div className="event-list-container">
        <div className="no-events">
          <p>📭 No events loaded yet</p>
          <p className="hint">
            Upload a SoundBank (.bnk) file to see available events
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="event-list-container">
      <div className="events-header">
        <h3>Available Events ({events.length})</h3>
        <button className="stop-all-button" onClick={handleStopAll}>
          ⏹ Stop All
        </button>
      </div>

      <div className="events-grid">
        {events.map((event, index) => (
          <div
            key={index}
            className="event-item"
            onClick={() => handlePlayEvent(event.name)}
          >
            <div className="event-icon">▶️</div>
            <div className="event-name">{event.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EventList;
