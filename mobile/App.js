import "./polyfills";
import React, { useState, useCallback, useEffect } from "react";
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
import * as FileSystem from "expo-file-system/legacy";
import { Asset } from "expo-asset";
import MinimalViewer from "./src/components/MinimalViewer";
import Sidebar from "./src/components/Sidebar";

import StepLoader from "./src/components/StepLoader";

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
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const stepLoaderRef = React.useRef(null);

  // Step Loader State
  const [stepFileContent, setStepFileContent] = useState(null);
  const [stepFileName, setStepFileName] = useState(null);
  const [stepFileType, setStepFileType] = useState('step');

  // Quality Mode: 'draft' or 'high'
  const [qualityMode, setQualityMode] = useState('high');

  // Asset libraries (loaded once on mount)
  const [threeJsCode, setThreeJsCode] = useState('');
  const [stlLoaderCode, setStlLoaderCode] = useState('');
  const [objLoaderCode, setObjLoaderCode] = useState('');
  const [gltfLoaderCode, setGltfLoaderCode] = useState('');
  const [orbitControlsCode, setOrbitControlsCode] = useState('');
  const [occtWasmBase64, setOcctWasmBase64] = useState('');

  // Load assets on mount
  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      // Load Three.js library (renamed to .txt to avoid Metro compilation)
      const threeAsset = Asset.fromModule(require('./assets/three.min.txt'));
      await threeAsset.downloadAsync();
      const threeCode = await FileSystem.readAsStringAsync(threeAsset.localUri, {
        encoding: 'utf8'
      });
      setThreeJsCode(threeCode);

      const stlAsset = Asset.fromModule(require('./assets/STLLoader.txt'));
      await stlAsset.downloadAsync();
      const stlCode = await FileSystem.readAsStringAsync(stlAsset.localUri, {
        encoding: 'utf8'
      });
      setStlLoaderCode(stlCode);

      const objAsset = Asset.fromModule(require('./assets/OBJLoader.txt'));
      await objAsset.downloadAsync();
      const objCode = await FileSystem.readAsStringAsync(objAsset.localUri, {
        encoding: 'utf8'
      });
      setObjLoaderCode(objCode);

      const gltfAsset = Asset.fromModule(require('./assets/GLTFLoader.txt'));
      await gltfAsset.downloadAsync();
      const gltfCode = await FileSystem.readAsStringAsync(gltfAsset.localUri, {
        encoding: 'utf8'
      });
      setGltfLoaderCode(gltfCode);

      const orbitControlsAsset = Asset.fromModule(require('./assets/OrbitControls.txt'));
      await orbitControlsAsset.downloadAsync();
      const orbitControlsCode = await FileSystem.readAsStringAsync(orbitControlsAsset.localUri, {
        encoding: 'utf8'
      });
      setOrbitControlsCode(orbitControlsCode);

      // WASM file keeps its original extension
      const wasmAsset = Asset.fromModule(require('./assets/occt-import-js.wasm'));
      await wasmAsset.downloadAsync();
      const wasmBase64 = await FileSystem.readAsStringAsync(wasmAsset.localUri, {
        encoding: 'base64'
      });
      setOcctWasmBase64(wasmBase64);

      console.log("✅ Assets Loaded. ThreeJS Size:", threeCode ? threeCode.length : "EMPTY");
      console.log("✅ OrbitControls Size:", orbitControlsCode ? orbitControlsCode.length : "EMPTY");
      console.log('✅ All assets loaded successfully!');
      setAssetsLoaded(true);
    } catch (error) {
      console.error('❌ Asset loading error:', error);
      Alert.alert('Asset Loading Error', error.message);
      setAssetsLoaded(false);
    }
  };

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      const fileName = file.name.toLowerCase();

      // Enhanced file type detection
      const isStep = fileName.endsWith(".step") || fileName.endsWith(".stp");
      const isIges = fileName.endsWith(".iges") || fileName.endsWith(".igs");
      const isStl = fileName.endsWith(".stl");
      const isObj = fileName.endsWith(".obj");
      const isGltf = fileName.endsWith(".gltf") || fileName.endsWith(".glb");
      const isPly = fileName.endsWith(".ply");

      // Formats that use the new WebView-based loader
      const usesWebViewLoader = isStep || isIges || isStl || isObj || isGltf;

      // Formats that load directly on mobile (legacy support)
      const isDirectLoad = isPly;

      if (usesWebViewLoader) {
        setLoading(true);
        setLoadingProgress(10);

        try {
          // Read file as Base64
          let base64 = await FileSystem.readAsStringAsync(file.uri, {
            encoding: 'base64',
          });

          console.log('📤 File (' + file.name + ') size:', base64.length);

          setLoadingProgress(30);
          setStepFileName(file.name);
          setStepFileContent(base64);
          setLoadingProgress(60);

          // CRITICAL FIX: FREE MEMORY IMMEDIATELY
          // If we don't do this, the string stays in RAM and blocks the next load
          base64 = null;
          console.log('🧹 Base64 string cleared from memory');

          // Determine file type for the loader
          let fileType = 'step';
          if (isIges) fileType = 'iges';
          else if (isStl) fileType = 'stl';
          else if (isObj) fileType = 'obj';
          else if (isGltf) fileType = fileName.endsWith('.glb') ? 'glb' : 'gltf';

          setStepFileType(fileType);
          // The StepLoader component will pick this up and process it

        } catch (err) {
          console.error("File read error:", err);
          Alert.alert("Error", "Failed to read file locally.");
          setLoading(false);
        }

      } else if (isDirectLoad) {
        setLoading(true);
        setLoadingProgress(50);
        // Direct load for PLY (legacy)
        addObjectToScene(file.name, file.uri);
        setLoadingProgress(100);
        setTimeout(() => {
          setLoading(false);
          setLoadingProgress(0);
        }, 500);
      } else {
        Alert.alert(
          "Unsupported File",
          "Supported formats:\n.step, .stp, .iges, .igs\n.stl, .obj, .gltf, .glb, .ply"
        );
      }
    } catch (err) {
      console.error("Import error:", err);
      Alert.alert("Error", "Failed to pick file");
      setLoading(false);
    }
  };

  const handleStepLoaded = (partsData) => {
    setLoadingProgress(90);

    // Populate objects state with loaded parts
    if (partsData && Array.isArray(partsData)) {
      const newObjects = partsData.map(part => ({
        id: part.id,  // UUID from WebView
        name: part.name || stepFileName || 'Imported Part',
        url: 'webview',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        color: part.color || '#555555',
        visible: part.visible !== undefined ? part.visible : true,
        showEdges: false
      }));

      setObjects(newObjects);
      if (newObjects.length > 0) {
        setSelectedId(newObjects[0].id);
      }
      console.log('✅ Loaded', newObjects.length, 'parts to sidebar');
    }

    setTimeout(() => {
      setLoadingProgress(100);
      setLoading(false);
      setLoadingProgress(0);
    }, 300);
    // DO NOT RESET CONTENT - Keep StepLoader mounted!
    // setStepFileContent(null); 
    // setStepFileName(null);
  };

  const handleStepError = (error) => {
    console.error("STEP Loader Error:", error);
    Alert.alert("Error", "Failed to load STEP file: " + error);
    setLoading(false);
    setStepFileContent(null);
    setStepFileName(null);
  };

  const addObjectToScene = (name, uri, rawMesh = null) => {
    const newObj = {
      id: `obj_${Date.now()}`,
      name: name,
      url: uri || "custom", // Use dummy URL if rawMesh is present
      rawMesh: rawMesh,
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
    // Send message to WebView for color/visibility updates
    if (stepLoaderRef.current && (updates.color || updates.visible !== undefined)) {
      const changes = {};
      if (updates.color) changes.color = updates.color;
      if (updates.visible !== undefined) changes.visible = updates.visible;

      stepLoaderRef.current.postMessage(JSON.stringify({
        type: 'UPDATE_OBJECT',
        id: id,
        changes: changes
      }));
    }

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
    // Send message to WebView to remove object
    if (stepLoaderRef.current) {
      stepLoaderRef.current.postMessage(JSON.stringify({
        type: 'REMOVE_OBJECT',
        id: id
      }));
    }
    setObjects((prev) => prev.filter((obj) => obj.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
    }
  };

  const handleResetPosition = (id) => {
    if (!id) return;
    // Send message to WebView to reset object
    if (stepLoaderRef.current) {
      stepLoaderRef.current.postMessage(JSON.stringify({
        type: 'RESET_OBJECT',
        id: id
      }));
    }
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

      // Determine mode for WebView (solid or wireframe)
      const webViewMode = nextMode === "wireframe" ? "wireframe" : "solid";

      // Send message to WebView
      if (stepLoaderRef.current) {
        stepLoaderRef.current.postMessage(JSON.stringify({
          type: 'SET_VIEW_MODE',
          mode: webViewMode
        }));
      }

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
        {/* StepLoader is now the primary and only 3D renderer */}
        {assetsLoaded ? (
          <StepLoader
            ref={stepLoaderRef}
            fileContent={stepFileContent}
            fileType={stepFileType}
            qualityMode={qualityMode}
            threeJsCode={threeJsCode}
            stlLoaderCode={stlLoaderCode}
            objLoaderCode={objLoaderCode}
            gltfLoaderCode={gltfLoaderCode}
            orbitControlsCode={orbitControlsCode}
            occtWasmBase64={occtWasmBase64}
            onModelLoaded={handleStepLoaded}
            onError={handleStepError}
          />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text style={{ marginTop: 10 }}>Initializing 3D Engine...</Text>
          </View>
        )}

        {/* UI Overlay - Absolute positioned to float on top, pointer-events box-none lets touches pass through */}
        <View style={styles.uiOverlay} pointerEvents="box-none">
          {/* Top Left Menu Button */}
          <TouchableOpacity
            style={[
              styles.menuButton,
              { backgroundColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" },
            ]}
            onPress={toggleSidebar}
            pointerEvents="auto"
          >
            <Text style={[styles.menuButtonText, { color: isDark ? "white" : "black" }]}>
              ☰
            </Text>
          </TouchableOpacity>

          {/* Origin Toggle Button */}
          <TouchableOpacity
            style={[
              styles.originButton,
              { backgroundColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" },
              showOrigin && { backgroundColor: isDark ? "rgba(100, 150, 255, 0.4)" : "rgba(100, 150, 255, 0.3)" },
            ]}
            onPress={() => setShowOrigin(!showOrigin)}
            pointerEvents="auto"
          >
            <Text style={[styles.originButtonText, { color: isDark ? "white" : "black" }]}>
              ⌖
            </Text>
          </TouchableOpacity>

          {/* View Controls (Zoom & Pan) */}
          <View style={styles.viewControls} pointerEvents="box-none">
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
              pointerEvents="auto"
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
              pointerEvents="auto"
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
              pointerEvents="auto"
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
            pointerEvents="auto"
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

        {/* Loading Overlay - Full screen overlay during import */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.loadingText}>Loading Model...</Text>
              <Text style={styles.loadingProgressText}>{Math.round(loadingProgress)}%</Text>
            </View>
          </View>
        )}
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
          onToggleGrid={() => {
            const newShowGrid = !showGrid;
            setShowGrid(newShowGrid);
            // Send message to WebView
            if (stepLoaderRef.current) {
              stepLoaderRef.current.postMessage(JSON.stringify({
                type: 'TOGGLE_GRID',
                value: newShowGrid
              }));
            }
          }}
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
    backgroundColor: "#f5f5f5", // Match StepLoader theme
  },
  uiOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20, // Above WebView, below sidebar
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
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 40,
  },
  loadingCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  loadingProgressText: {
    marginTop: 8,
    fontSize: 14,
    color: "#666",
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
