/* global BigInt */

import React, { useState } from "react";
import wwiseService from "../services/wwise";
import "./ActionSlot.css";

function ActionSlot({
  id,
  index,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  availableEvents,
  availableRTPCs,
  initialType = null,
  initialItem = null,
}) {
  const [actionType, setActionType] = useState(initialType);
  const [selectedItem, setSelectedItem] = useState(initialItem);
  const [rtpcValue, setRtpcValue] = useState(
    initialItem?.defaultValue || initialItem?.min || 50
  );
  const [isPlaying, setIsPlaying] = useState(false);

  const handleTypeSelect = (type) => {
    setActionType(type);
    setSelectedItem(null);
  };

  const handleEventPlay = () => {
    if (!selectedItem) return;

    try {
      wwiseService.postEvent(selectedItem.name);
      setIsPlaying(true);
      setTimeout(() => setIsPlaying(false), 1000);
    } catch (error) {
      console.error("Failed to play event:", error);
    }
  };

  const handleRTPCChange = (value) => {
    const numValue = parseFloat(value);
    setRtpcValue(numValue);

    if (!selectedItem) return;

    try {
      const gameObjID = BigInt(wwiseService.gameObjectID);
      wwiseService.module.SoundEngine.SetRTPCValue(
        selectedItem.name,
        numValue,
        gameObjID,
        0,
        0,
        false
      );
      // console.log(`⚙ RTPC set: ${selectedItem.name} = ${numValue}`);
    } catch (error) {
      console.error("Failed to set RTPC:", error);
    }
  };

  const handleRemove = () => {
    setActionType(null);
    setSelectedItem(null);
    if (onRemove) onRemove(id);
  };

  const handleHeaderDragStart = (e) => {
    e.dataTransfer.effectAllowed = "move";
    if (onDragStart) onDragStart(index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (onDragOver) onDragOver(index);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (onDrop) onDrop(index);
  };

  const handleSliderMouseDown = (e) => {
    e.stopPropagation();
  };

  if (!actionType) {
    return (
      <div className="action-slot empty" draggable={false}>
        <div className="action-type-selector">
          <button
            onClick={() => handleTypeSelect("event")}
            className="type-button"
            disabled={!availableEvents || availableEvents.length === 0}
          >
            <span className="type-icon">▶</span>
            <span>EVENT</span>
          </button>
          <button
            onClick={() => handleTypeSelect("rtpc")}
            className="type-button"
            disabled={!availableRTPCs || availableRTPCs.length === 0}
          >
            <span className="type-icon">⚙</span>
            <span>RTPC</span>
          </button>
        </div>
      </div>
    );
  }

  if (actionType && !selectedItem) {
    const items = actionType === "event" ? availableEvents : availableRTPCs;

    return (
      <div className="action-slot selecting" draggable={false}>
        <div className="action-slot-header">
          <span className="text-muted">SELECT {actionType.toUpperCase()}</span>
          <button onClick={() => setActionType(null)} className="close-button">
            ×
          </button>
        </div>
        <select
          onChange={(e) => {
            const item = items.find((i) => i.name === e.target.value);
            setSelectedItem(item);

            if (actionType === "rtpc" && item) {
              const initialValue =
                item.defaultValue !== undefined
                  ? item.defaultValue
                  : item.min !== undefined
                  ? item.min
                  : 0;
              setRtpcValue(initialValue);
            }
          }}
          className="item-selector"
          value={selectedItem?.name || ""}
        >
          <option value="">Choose...</option>
          {items.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (actionType === "event") {
    return (
      <div
        className={`action-slot event ${isPlaying ? "playing" : ""}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div
          className="action-slot-header"
          draggable={true}
          onDragStart={handleHeaderDragStart}
        >
          <span className="drag-handle">⋮⋮</span>
          <span className="action-type-badge">EVENT</span>
          <button onClick={handleRemove} className="close-button">
            ×
          </button>
        </div>
        <div className="action-content">
          <div className="action-name">{selectedItem.name}</div>
          <button onClick={handleEventPlay} className="action-trigger-btn">
            <span>▶</span>
            <span>PLAY</span>
          </button>
        </div>
      </div>
    );
  }

  if (actionType === "rtpc") {
    const minValue = selectedItem.min !== undefined ? selectedItem.min : 0;
    const maxValue = selectedItem.max !== undefined ? selectedItem.max : 100;

    const range = maxValue - minValue;
    const step = range <= 10 ? 0.01 : range <= 100 ? 0.1 : 1;

    return (
      <div
        className="action-slot rtpc"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div
          className="action-slot-header"
          draggable={true}
          onDragStart={handleHeaderDragStart}
        >
          <span className="drag-handle">⋮⋮</span>
          <span className="action-type-badge">RTPC</span>
          <button onClick={handleRemove} className="close-button">
            ×
          </button>
        </div>
        <div className="action-content">
          <div className="action-name">{selectedItem.name}</div>
          <div className="rtpc-control">
            <input
              type="range"
              min={minValue}
              max={maxValue}
              step={step}
              value={rtpcValue}
              onChange={(e) => handleRTPCChange(e.target.value)}
              onMouseDown={handleSliderMouseDown}
              onTouchStart={handleSliderMouseDown}
              className="rtpc-slider"
            />
            <div className="rtpc-value">
              {Number(rtpcValue).toFixed(step < 0.1 ? 2 : 1)}
            </div>
            <div className="rtpc-range">
              {minValue.toFixed(step < 0.1 ? 2 : 1)} →{" "}
              {maxValue.toFixed(step < 0.1 ? 2 : 1)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default ActionSlot;
