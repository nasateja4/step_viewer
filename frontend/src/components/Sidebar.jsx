import React, { useState } from "react";

const Sidebar = ({
  objects,
  selectedId,
  onSelect,
  onUpdateObject,
  onImport,
  onClear,
  onMate,
}) => {
  const selectedObj = objects.find((o) => o.id === selectedId);
  const [mateTargetId, setMateTargetId] = useState("");
  const [mateOffset, setMateOffset] = useState(0);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onImport(e.target.files[0]);
    }
  };

  const updateTransform = (axis, value, type = "position") => {
    if (!selectedObj) return;
    const newVals = [...selectedObj[type]];
    const idx = axis === "x" ? 0 : axis === "y" ? 1 : 2;
    newVals[idx] = parseFloat(value);
    onUpdateObject(selectedId, { [type]: newVals });
  };

  return (
    <div className="sidebar">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "10px",
        }}
      >
        <div
          style={{
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            background: "#3b82f6",
          }}
        ></div>
        <h2 style={{ fontSize: "1.25rem", color: "white" }}>
          Assembly Control
        </h2>
      </div>

      {/* File Operations */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: "10px",
        }}
      >
        <label className="btn btn-primary">
          <span>Import Model</span>
          <input
            type="file"
            accept=".step,.stp,.stl"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </label>
        <button
          onClick={onClear}
          className="btn btn-danger"
          title="Clear Scene"
        >
          🗑️
        </button>
      </div>

      {/* Object List */}
      <div>
        <h3
          style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            marginBottom: "0.5rem",
          }}
        >
          Loaded Parts ({objects.length})
        </h3>
        <div className="object-list">
          {objects.length === 0 && (
            <div
              style={{
                padding: "1rem",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: "0.875rem",
              }}
            >
              No parts loaded
            </div>
          )}
          {objects.map((obj, idx) => (
            <div
              key={obj.id}
              onClick={() => onSelect(obj.id)}
              className={`object-item ${obj.id === selectedId ? "active" : ""}`}
            >
              <span style={{ marginRight: "8px", opacity: 0.5 }}>
                {idx + 1}.
              </span>
              <span
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {obj.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          opacity: selectedObj ? 1 : 0.5,
          pointerEvents: selectedObj ? "auto" : "none",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        {/* Appearance */}
        <div className="input-group">
          <h4>Appearance</h4>
          <label className="checkbox-wrapper">
            <input
              type="checkbox"
              checked={selectedObj?.visible ?? true}
              onChange={(e) =>
                onUpdateObject(selectedId, { visible: e.target.checked })
              }
            />
            <span>Visible in Scene</span>
          </label>

          <label className="checkbox-wrapper">
            <input
              type="checkbox"
              checked={selectedObj?.showEdges ?? false}
              onChange={(e) =>
                onUpdateObject(selectedId, { showEdges: e.target.checked })
              }
            />
            <span>Show Feature Edges</span>
          </label>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginTop: "5px",
            }}
          >
            <input
              type="color"
              value={selectedObj?.color || "#cccccc"}
              onChange={(e) =>
                onUpdateObject(selectedId, { color: e.target.value })
              }
              style={{
                width: "40px",
                height: "40px",
                padding: 0,
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            />
            <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
              Object Color
            </span>
          </div>
        </div>

        {/* Mating */}
        <div className="input-group">
          <h4>Mating & Alignment</h4>

          <select
            value={mateTargetId}
            onChange={(e) => setMateTargetId(e.target.value)}
            style={{ marginBottom: "0.5rem" }}
          >
            <option value="">Select Target Object...</option>
            {objects
              .filter((o) => o.id !== selectedId)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
          </select>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
            }}
          >
            <button
              className="btn btn-secondary"
              onClick={() => onMate("concentric", selectedId, mateTargetId)}
              disabled={!mateTargetId}
            >
              ◎ Concentric
            </button>
            <button
              className="btn btn-secondary"
              onClick={() =>
                onMate("coincident", selectedId, mateTargetId, mateOffset)
              }
              disabled={!mateTargetId}
            >
              ⬆ Face/Top
            </button>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginTop: "5px",
            }}
          >
            <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
              Z-Offset:
            </span>
            <input
              type="number"
              value={mateOffset}
              onChange={(e) => setMateOffset(parseFloat(e.target.value))}
              style={{ width: "80px" }}
            />
          </div>
        </div>

        {/* Transforms */}
        <div className="input-group">
          <h4>Transform</h4>

          {["x", "y", "z"].map((axis) => (
            <div
              key={axis}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  width: "15px",
                  textTransform: "uppercase",
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  fontWeight: "bold",
                }}
              >
                {axis}
              </span>
              <input
                type="range"
                min="-200"
                max="200"
                value={
                  selectedObj?.position[
                    axis === "x" ? 0 : axis === "y" ? 1 : 2
                  ] || 0
                }
                onChange={(e) =>
                  updateTransform(axis, e.target.value, "position")
                }
                style={{ flex: 1 }}
              />
              <span
                style={{
                  width: "35px",
                  textAlign: "right",
                  fontSize: "0.75rem",
                  fontFamily: "monospace",
                }}
              >
                {Math.round(
                  selectedObj?.position[
                    axis === "x" ? 0 : axis === "y" ? 1 : 2
                  ] || 0
                )}
              </span>
            </div>
          ))}

          <div
            style={{
              height: "1px",
              background: "var(--border)",
              margin: "10px 0",
            }}
          ></div>

          {["x", "y", "z"].map((axis) => (
            <div
              key={`rot-${axis}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  width: "15px",
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                }}
              >
                R{axis.toUpperCase()}
              </span>
              <input
                type="range"
                min="-180"
                max="180"
                value={
                  selectedObj?.rotation[
                    axis === "x" ? 0 : axis === "y" ? 1 : 2
                  ] || 0
                }
                onChange={(e) =>
                  updateTransform(axis, e.target.value, "rotation")
                }
                style={{ flex: 1 }}
              />
              <span
                style={{
                  width: "35px",
                  textAlign: "right",
                  fontSize: "0.75rem",
                  fontFamily: "monospace",
                }}
              >
                {Math.round(
                  selectedObj?.rotation[
                    axis === "x" ? 0 : axis === "y" ? 1 : 2
                  ] || 0
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
