import React, { useState } from "react";
import wwiseService from "../services/wwise";
import "./EventList.css";

function EventList({ events }) {
  const [playingEvents, setPlayingEvents] = useState(new Set());

  const handlePlayEvent = (eventName) => {
    try {
      wwiseService.postEvent(eventName);

      setPlayingEvents((prev) => new Set(prev).add(eventName));

      setTimeout(() => {
        setPlayingEvents((prev) => {
          const next = new Set(prev);
          next.delete(eventName);
          return next;
        });
      }, 1000);
    } catch (error) {
      console.error("Failed to play event:", error);
    }
  };

  if (!events || events.length === 0) {
    return null;
  }

  return (
    <div className="card event-list-card">
      <div className="card-header">
        <h2>EVENTS</h2>
        <span className="text-muted">{events.length} AVAILABLE</span>
      </div>

      <div className="event-grid">
        {events.map((event) => (
          <button
            key={event.name}
            onClick={() => handlePlayEvent(event.name)}
            className={`event-button ${
              playingEvents.has(event.name) ? "playing" : ""
            }`}
          >
            <span className="event-play-icon">▶</span>
            <span className="event-name">{event.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default EventList;
