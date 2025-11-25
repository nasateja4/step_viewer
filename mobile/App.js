import "./polyfills";
import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  StatusBar,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Text,
  Platform,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import Viewer from "./src/components/Viewer";
import MinimalViewer from "./src/components/MinimalViewer";
import Sidebar from "./src/components/Sidebar";

// Replace with your computer's IP address if running on device
// For Android Emulator, 10.0.2.2 points to host localhost
const BACKEND_URL =
  Platform.OS === "android"
    ? "http://10.0.2.2:8000"
    : "http://localhost:8000";

export default function App() {
  const [objects, setObjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [matingCmd, setMatingCmd] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*", // Allow all types, we'll filter or let backend handle
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      const fileName = file.name.toLowerCase();

      // Check file types
      const isStep = fileName.endsWith(".step") || fileName.endsWith(".stp");
      const isStl = fileName.endsWith(".stl");
      const isObj = fileName.endsWith(".obj");
      const isPly = fileName.endsWith(".ply");

      // Formats that load directly on mobile (no server)
      const isDirectLoad = isStl || isObj || isPly;

      if (isStep) {
        setLoading(true);
        setLoadingProgress(0);
        // Upload to backend
        const formData = new FormData();
        formData.append("file", {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || "application/octet-stream",
        });

        try {
          const response = await fetch(`${BACKEND_URL}/convert`, {
            method: "POST",
            body: formData,
            headers: {
              "Content-Type": "multipart/form-data",
            },
          });

          setLoadingProgress(30);

          if (!response.ok) {
            throw new Error(`Conversion failed: ${response.statusText}`);
          }

          setLoadingProgress(60);

          // Get blob and save to file
          const blob = await response.blob();

          // Convert blob to base64
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
            const base64data = reader.result.split(",")[1];
            const filename = `converted_${Date.now()}.stl`;
            const fileUri = FileSystem.documentDirectory + filename;

            await FileSystem.writeAsStringAsync(fileUri, base64data, {
              encoding: FileSystem.EncodingType.Base64,
            });

            setLoadingProgress(90);
            addObjectToScene(file.name, fileUri);
            setLoadingProgress(100);
            setLoading(false);
          };
        } catch (err) {
          console.error("Upload error:", err);
          Alert.alert("Error", "Failed to convert file. Check backend connection.");
          setLoading(false);
          setLoadingProgress(0);
        }
      } else if (isDirectLoad) {
        setLoading(true);
        setLoadingProgress(50);
        // Direct load for STL, OBJ, PLY
        addObjectToScene(file.name, file.uri);
        setLoadingProgress(100);
        setTimeout(() => {
          setLoading(false);
          setLoadingProgress(0);
        }, 500);
      } else {
        Alert.alert(
          "Unsupported File",
          "Please select: .step/.stp, .stl, .obj, or .ply file."
        );
      }
    } catch (err) {
      console.error("Import error:", err);
      Alert.alert("Error", "Failed to pick file");
      setLoading(false);
    }
  };

  const addObjectToScene = (name, uri) => {
    const newObj = {
      id: `obj_${Date.now()}`,
      name: name,
      url: uri,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      color: "#cccccc",
      visible: true,
      showEdges: true,
    };

    if (viewMode === "wireframe") {
      setObjects((prev) => {
        const restored = prev.map((obj) => {
          if (obj.color === "#000000" && obj.savedColor) {
            return { ...obj, color: obj.savedColor };
          }
          return obj;
        });
        return [...restored, newObj];
      });
      setViewMode("shaded"); // Reset to shaded on import if in wireframe, or keep it? 
      // Let's keep it simple and reset to shaded or edges default
    } else {
      setObjects((prev) => [...prev, newObj]);
    }

    setSelectedId(newObj.id);
    setIsSidebarOpen(false); // Close sidebar to show model
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

  const handleDeleteObject = (id) => {
    setObjects((prev) => prev.filter((obj) => obj.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
    }
  };

  const handleResetPosition = (id) => {
    if (!id) return;
    handleUpdateObject(id, { position: [0, 0, 0], rotation: [0, 0, 0] });
  };

  const [viewMode, setViewMode] = useState("edges"); // 'shaded', 'edges', 'wireframe'
  const [showGrid, setShowGrid] = useState(true);
  const [showViewSelector, setShowViewSelector] = useState(false);
  const [showOrigin, setShowOrigin] = useState(false);

  const handleCycleViewMode = () => {
    setViewMode((prevMode) => {
      let nextMode;
      if (prevMode === "shaded") nextMode = "edges";
      else if (prevMode === "edges") nextMode = "wireframe";
      else nextMode = "shaded";

      if (nextMode === "wireframe") {
        // Switching TO Wireframe: Save color and set to Black
        setObjects((prev) =>
          prev.map((obj) => ({
            ...obj,
            savedColor: obj.color,
            color: "#000000",
          }))
        );
      } else if (prevMode === "wireframe") {
        // Switching FROM Wireframe: Restore color
        setObjects((prev) =>
          prev.map((obj) => {
            if (obj.color === "#000000" && obj.savedColor) {
              return { ...obj, color: obj.savedColor };
            }
            return obj;
          })
        );
      }

      return nextMode;
    });
  };

  const [sidebarAnim] = useState(new Animated.Value(-300)); // Start off-screen left

  const toggleSidebar = () => {
    const toValue = isSidebarOpen ? -300 : 0;
    Animated.timing(sidebarAnim, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setIsSidebarOpen(!isSidebarOpen);
  };

  const [panMode, setPanMode] = useState(false);
  const [zoomCmd, setZoomCmd] = useState(null);
  const [theme, setTheme] = useState("light");

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleZoom = (type) => {
    setZoomCmd({ type, timestamp: Date.now() });
  };

  const isDark = theme === "dark";
  const bgColor = isDark ? "#1a1a1a" : "#f0f0f0";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={bgColor}
      />

      <View style={styles.viewerContainer}>
        <Viewer
          objects={objects}
          selectedId={selectedId}
          onSelect={setSelectedId}
          matingCmd={matingCmd}
          onMatingComplete={handleMatingComplete}
          onUpdateObject={handleUpdateObject}
          panMode={panMode}
          zoomCmd={zoomCmd}
          theme={theme}
          viewMode={viewMode}
          showGrid={showGrid}
          showViewSelector={showViewSelector}
          showOrigin={showOrigin}
          onViewSelect={() => setShowViewSelector(false)}
        />

        {/* Top Left Menu Button */}
        <TouchableOpacity
          style={[
            styles.menuButton,
            { backgroundColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" },
          ]}
          onPress={toggleSidebar}
        >
          <Text style={[styles.menuButtonText, { color: isDark ? "white" : "black" }]}>
            ☰
          </Text>
        </TouchableOpacity>

        {/*Origin Toggle Button (below menu) */}
        <TouchableOpacity
          style={[
            styles.originButton,
            { backgroundColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" },
            showOrigin && { backgroundColor: isDark ? "rgba(100, 150, 255, 0.4)" : "rgba(100, 150, 255, 0.3)" },
          ]}
          onPress={() => setShowOrigin(!showOrigin)}
        >
          <Text style={[styles.originButtonText, { color: isDark ? "white" : "black" }]}>
            ⌖
          </Text>
        </TouchableOpacity>

        {/* View Controls (Zoom & Pan) */}
        <View style={styles.viewControls}>
          <TouchableOpacity
            style={[
              styles.controlButton,
              {
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.1)",
                borderColor: isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.2)",
              },
              panMode && styles.activeControlButton,
            ]}
            onPress={() => setPanMode(!panMode)}
          >
            <Text style={[styles.controlButtonText, { color: isDark ? "white" : "black" }]}>
              {panMode ? "✋" : "🔄"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.controlButton,
              {
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.1)",
                borderColor: isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.2)",
              },
            ]}
            onPress={() => handleZoom("in")}
          >
            <Text style={[styles.controlButtonText, { color: isDark ? "white" : "black" }]}>
              +
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.controlButton,
              {
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.1)",
                borderColor: isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.2)",
              },
            ]}
            onPress={() => handleZoom("out")}
          >
            <Text style={[styles.controlButtonText, { color: isDark ? "white" : "black" }]}>
              -
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Center Import Button */}
        <TouchableOpacity
          style={[styles.importButton, loading && styles.importButtonLoading]}
          onPress={handleImport}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { width: `${loadingProgress}%` }]} />
              <Text style={styles.progressText}>{Math.round(loadingProgress)}%</Text>
            </View>
          ) : (
            <Text style={styles.importButtonText}>Import</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Overlay to close sidebar on outside tap */}
      {
        isSidebarOpen && (
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={toggleSidebar}
          />
        )
      }

      {/* Sliding Sidebar */}
      <Animated.View
        style={[
          styles.sidebarContainer,
          {
            transform: [{ translateX: sidebarAnim }],
            backgroundColor: isDark ? "rgba(34, 34, 34, 0.95)" : "rgba(255, 255, 255, 0.95)",
            borderRightColor: isDark ? "#333" : "#ddd",
          },
        ]}
      >
        <Sidebar
          objects={objects}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onUpdateObject={handleUpdateObject}
          onImport={handleImport}
          onDeleteObject={handleDeleteObject}
          onMate={handleMate}
          onClose={toggleSidebar}
          theme={theme}
          toggleTheme={toggleTheme}
          viewMode={viewMode}
          onCycleViewMode={handleCycleViewMode}
          showGrid={showGrid}
          onToggleGrid={() => setShowGrid(!showGrid)}
          showViewSelector={showViewSelector}
          onToggleViewSelector={() => setShowViewSelector(!showViewSelector)}
          onResetPosition={handleResetPosition}
        />
      </Animated.View>
    </SafeAreaView >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 25, // Below sidebar (30) but above controls (20)
    backgroundColor: "transparent",
  },
  viewerContainer: {
    flex: 1,
    position: "relative",
  },
  menuButton: {
    position: "absolute",
    top: 20,
    left: 20,
    width: 40,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  menuButtonText: {
    color: "white",
    fontSize: 24,
  },
  originButton: {
    position: "absolute",
    top: 70, // Below menuButton (20 + 40 + 10)
    left: 20,
    width: 40,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  originButtonText: {
    color: "white",
    fontSize: 24,
  },
  canvasContainer: {
    flex: 1,
  },
  viewControls: {
    position: "absolute",
    bottom: 40,
    right: 20,
    flexDirection: "row",
    gap: 8,
    zIndex: 20,
  },
  controlButton: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  activeControlButton: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  controlButtonText: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
  },
  importButton: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    marginLeft: -60,
    backgroundColor: "#fef08a", // Light yellow accent
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 5,
    zIndex: 10,
    minWidth: 120,
    alignItems: "center",
  },
  importButtonLoading: {
    opacity: 0.8,
  },
  importButtonText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 16,
  },
  sidebarContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "70%", // Take up 70% of width
    backgroundColor: "rgba(34, 34, 34, 0.95)", // Slightly translucent
    zIndex: 30,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    borderRightWidth: 1,
    borderRightColor: "#333",
  },
});
