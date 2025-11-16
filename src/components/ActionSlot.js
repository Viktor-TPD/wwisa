import React, { useState } from "react";
import wwiseService from "../services/wwise";
import "./ActionSlot.css";

function ActionSlot({
  id,
  onRemove,
  availableEvents,
  availableRTPCs,
  availableSwitches,
  availableStates,
  initialType = null,
  initialItem = null,
}) {
  const [actionType, setActionType] = useState(initialType); // null, 'event', 'rtpc', 'switch', 'state'
  const [selectedItem, setSelectedItem] = useState(initialItem);
  const [rtpcValue, setRtpcValue] = useState(50);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSwitchValue, setSelectedSwitchValue] = useState(null);
  const [selectedStateValue, setSelectedStateValue] = useState(null);

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
    setRtpcValue(value);
    if (!selectedItem) return;

    try {
      const gameObjID = BigInt(wwiseService.gameObjectID);
      wwiseService.module.SoundEngine.SetRTPCValue(
        selectedItem.name,
        parseFloat(value),
        gameObjID
      );
    } catch (error) {
      console.error("Failed to set RTPC:", error);
    }
  };

  const handleSwitchChange = (switchValue) => {
    setSelectedSwitchValue(switchValue);
    if (!selectedItem) return;

    try {
      const gameObjID = BigInt(wwiseService.gameObjectID);
      wwiseService.module.SoundEngine.SetSwitch(
        selectedItem.name, // Switch group name
        switchValue.name, // Switch value name
        gameObjID
      );
      console.log(`🔀 Switch set: ${selectedItem.name} → ${switchValue.name}`);
    } catch (error) {
      console.error("Failed to set switch:", error);
    }
  };

  const handleStateChange = (stateValue) => {
    setSelectedStateValue(stateValue);
    if (!selectedItem) return;

    try {
      wwiseService.module.SoundEngine.SetState(
        selectedItem.name, // State group name
        stateValue.name // State value name
      );
      console.log(`◉ State set: ${selectedItem.name} → ${stateValue.name}`);
    } catch (error) {
      console.error("Failed to set state:", error);
    }
  };

  const handleRemove = () => {
    setActionType(null);
    setSelectedItem(null);
    if (onRemove) onRemove(id);
  };

  // Empty slot - show type selector
  if (!actionType) {
    return (
      <div className="action-slot empty">
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
          <button
            onClick={() => handleTypeSelect("switch")}
            className="type-button"
            disabled={!availableSwitches || availableSwitches.length === 0}
          >
            <span className="type-icon">⇄</span>
            <span>SWITCH</span>
          </button>
          <button
            onClick={() => handleTypeSelect("state")}
            className="type-button"
            disabled={!availableStates || availableStates.length === 0}
          >
            <span className="type-icon">◉</span>
            <span>STATE</span>
          </button>
        </div>
      </div>
    );
  }

  // Type selected but no item - show item selector
  if (actionType && !selectedItem) {
    let items = [];
    if (actionType === "event") items = availableEvents;
    else if (actionType === "rtpc") items = availableRTPCs;
    else if (actionType === "switch") items = availableSwitches;
    else if (actionType === "state") items = availableStates;

    return (
      <div className="action-slot selecting">
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
            // Initialize switch/state with first value
            if (actionType === "switch" && item?.values?.[0]) {
              setSelectedSwitchValue(item.values[0]);
            }
            if (actionType === "state" && item?.values?.[0]) {
              setSelectedStateValue(item.values[0]);
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

  // Action configured - show control
  if (actionType === "event") {
    return (
      <div className={`action-slot event ${isPlaying ? "playing" : ""}`}>
        <div className="action-slot-header">
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
    return (
      <div className="action-slot rtpc">
        <div className="action-slot-header">
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
              min={selectedItem.min || 0}
              max={selectedItem.max || 100}
              value={rtpcValue}
              onChange={(e) => handleRTPCChange(e.target.value)}
              className="rtpc-slider"
            />
            <div className="rtpc-value">{rtpcValue.toFixed(1)}</div>
          </div>
        </div>
      </div>
    );
  }

  if (actionType === "switch") {
    return (
      <div className="action-slot switch">
        <div className="action-slot-header">
          <span className="action-type-badge">SWITCH</span>
          <button onClick={handleRemove} className="close-button">
            ×
          </button>
        </div>
        <div className="action-content">
          <div className="action-name">{selectedItem.name}</div>
          <div className="switch-control">
            {selectedItem.values?.map((value) => (
              <button
                key={value.name}
                onClick={() => handleSwitchChange(value)}
                className={`switch-button ${
                  selectedSwitchValue?.name === value.name ? "active" : ""
                }`}
              >
                {value.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (actionType === "state") {
    return (
      <div className="action-slot state">
        <div className="action-slot-header">
          <span className="action-type-badge">STATE</span>
          <button onClick={handleRemove} className="close-button">
            ×
          </button>
        </div>
        <div className="action-content">
          <div className="action-name">{selectedItem.name}</div>
          <div className="state-control">
            {selectedItem.values?.map((value) => (
              <button
                key={value.name}
                onClick={() => handleStateChange(value)}
                className={`state-button ${
                  selectedStateValue?.name === value.name ? "active" : ""
                }`}
              >
                {value.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default ActionSlot;
