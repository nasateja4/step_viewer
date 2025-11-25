import React, { useState, useCallback } from "react";
import axios from "axios";
import Viewer from "./components/Viewer";
import Sidebar from "./components/Sidebar";

function App() {
  const [objects, setObjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [matingCmd, setMatingCmd] = useState(null);

  const handleImport = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      // 1. Upload to backend for conversion (if STEP) or just use URL if STL
      // For now, we assume backend handles everything and returns a URL to the mesh
      // In a real app, we'd check extension.
      const isStep =
        file.name.toLowerCase().endsWith(".step") ||
        file.name.toLowerCase().endsWith(".stp");

      let url;
      if (isStep) {
        const res = await axios.post(
          "http://localhost:8000/convert",
          formData,
          {
            responseType: "blob",
          }
        );
        url = URL.createObjectURL(res.data);
      } else {
        url = URL.createObjectURL(file);
      }

      const newObj = {
        id: `obj_${Date.now()}`,
        name: file.name,
        url: url,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        color: "#cccccc",
        visible: true,
        showEdges: false,
      };

      setObjects((prev) => [...prev, newObj]);
      setSelectedId(newObj.id);
    } catch (err) {
      console.error("Import failed", err);
      alert("Import failed: " + err.message);
    }
  };

  const handleUpdateObject = (id, updates) => {
    setObjects((prev) =>
      prev.map((obj) => (obj.id === id ? { ...obj, ...updates } : obj))
    );
  };

  const handleMate = (type, sourceId, targetId, offset = 0) => {
    if (!sourceId || !targetId) return;
    setMatingCmd({ type, sourceId, targetId, offset, id: Date.now() });
  };

  const handleMatingComplete = (id, newPos) => {
    handleUpdateObject(id, { position: newPos });
    setMatingCmd(null);
  };

  const handleClear = () => {
    setObjects([]);
    setSelectedId(null);
  };

  return (
    <div
      className="app-container"
      style={{
        display: "flex",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <Sidebar
        objects={objects}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onUpdateObject={handleUpdateObject}
        onImport={handleImport}
        onClear={handleClear}
        onMate={handleMate}
      />
      <div style={{ flex: 1, position: "relative" }}>
        <Viewer
          objects={objects}
          selectedId={selectedId}
          onSelect={setSelectedId}
          matingCmd={matingCmd}
          onMatingComplete={handleMatingComplete}
        />
      </div>
    </div>
  );
}

export default App;
