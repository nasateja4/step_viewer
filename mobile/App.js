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
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import JSZip from "jszip";
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
  const [importBtnActive, setImportBtnActive] = useState(false);
  const [currentFileName, setCurrentFileName] = useState("No File Loaded");
  const stepLoaderRef = React.useRef(null);
  const [fileSize, setFileSize] = useState(0);
  const [fileMetadata, setFileMetadata] = useState({
    schema: 'N/A',
    created: 'N/A',
    software: 'N/A',
    author: 'N/A',
    organization: 'N/A'
  });

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

  // Export Wizard State
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportStage, setExportStage] = useState('format'); // 'format' | 'mode' | 'name' | 'processing'
  const [selectedFormat, setSelectedFormat] = useState('stl');
  const [exportMode, setExportMode] = useState('merged');
  const [exportName, setExportName] = useState('');
  const [exportProgress, setExportProgress] = useState(0);

  // Load assets on mount
  useEffect(() => {
    loadAssets();
  }, []);

  const parseFileMetadata = (base64Data, fileName) => {
    const name = fileName.toLowerCase();
    let meta = { schema: 'N/A', created: 'N/A', software: 'N/A', author: 'N/A', organization: 'N/A' };

    try {
      const decoded = atob(base64Data.substring(0, 5000)); // Decode first 3-4KB

      // === HANDLE STEP/IGES ===
      if (name.endsWith('.step') || name.endsWith('.stp') || name.endsWith('.iges') || name.endsWith('.igs')) {
        // 1. Extract Schema (AP203/AP214)
        // Looks like: FILE_SCHEMA (('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));
        const schemaMatch = decoded.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)/);
        if (schemaMatch) {
          meta.schema = schemaMatch[1];
          if (meta.schema.includes('AUTOMOTIVE_DESIGN')) meta.schema = 'AP214 (Automotive)';
          if (meta.schema.includes('CONFIG_CONTROL_DESIGN')) meta.schema = 'AP203 (Config Control)';
        }

        // 2. Extract FILE_NAME data
        // Matches FILE_NAME(...); across multiple lines using [^;]+
        const fileNameMatch = decoded.match(/FILE_NAME\s*\(([^;]+)\);/);

        if (fileNameMatch) {
          // Remove newlines and extra spaces to make splitting easier
          const rawContent = fileNameMatch[1].replace(/\n/g, '').replace(/\r/g, '');

          // Split by comma, but be careful of commas inside nested parens (basic implementation)
          const parts = rawContent.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));

          // ISO 10303-21 Standard:
          // [0] Name, [1] Timestamp, [2] Author, [3] Organization, [4] Preprocessor, [5] Originating System

          if (parts[1]) meta.created = parts[1]; // Timestamp
          if (parts[2] && parts[2] !== "''") meta.author = parts[2].replace(/[()]/g, ''); // Author
          if (parts[3] && parts[3] !== "''") meta.organization = parts[3].replace(/[()]/g, ''); // Organization

          // Prioritize "Originating System" (SolidWorks) over "Preprocessor" (SwSTEP)
          // If index 5 exists and isn't empty, use it. Otherwise use index 4.
          if (parts[5] && parts[5] !== "''") {
            meta.software = parts[5];
          } else if (parts[4]) {
            meta.software = parts[4];
          }
        }
      }

      // === HANDLE GLTF/GLB ===
      else if (name.endsWith('.gltf') || name.endsWith('.glb')) {
        // Find the start of the JSON object
        const jsonStart = decoded.indexOf('{');
        if (jsonStart !== -1) {
          // Heuristic: Extract enough characters to hopefully cover the "asset" block
          // (We don't parse the whole file to avoid memory spikes on 50MB files)
          const chunk = decoded.substring(jsonStart, jsonStart + 1000) + "}";

          // Use Regex to find "asset" block safely without parsing invalid JSON
          // Pattern: "asset" : { ... }
          // We look for keys manually to be safe
          const generatorMatch = chunk.match(/"generator"\s*:\s*"([^"]+)"/);
          const versionMatch = chunk.match(/"version"\s*:\s*"([^"]+)"/);
          const copyrightMatch = chunk.match(/"copyright"\s*:\s*"([^"]+)"/);

          meta.software = generatorMatch ? generatorMatch[1] : 'Unknown';
          meta.schema = versionMatch ? `glTF ${versionMatch[1]}` : 'glTF 2.0';
          meta.author = copyrightMatch ? copyrightMatch[1] : 'N/A';
          meta.created = 'Not specified in standard';
        }
      }

    } catch (e) {
      console.log("Metadata parse error:", e);
    }
    return meta;
  };

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
    // Wake up the button (make it fully visible)
    setImportBtnActive(true);
    setTimeout(() => setImportBtnActive(false), 3000);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      setFileSize(file.size);
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

          // Extract metadata for all supported file types
          const meta = parseFileMetadata(base64, file.name);
          setFileMetadata(meta);
          console.log('📋 Metadata extracted:', meta);

          setStepFileName(file.name);
          setCurrentFileName(file.name);
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

      // ✅ CRITICAL: Reset file content to free RAM and allow re-loading
      // This triggers React's useEffect on next import (state change: null → content)
      setStepFileContent(null);
      setStepFileName(null);
      console.log('🧹 State reset - ready for next file');
    }, 300);
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

  const handleDeleteAll = () => {
    // Clear all objects from state
    setObjects([]);
    setSelectedId(null);

    // Clear file content
    setStepFileContent(null);
    setStepFileName(null);
    setCurrentFileName("No File Loaded");

    // Send message to WebView to clear scene
    if (stepLoaderRef.current) {
      // Clear all objects by sending remove message for each
      objects.forEach(obj => {
        stepLoaderRef.current.postMessage(JSON.stringify({
          type: 'REMOVE_OBJECT',
          id: obj.id
        }));
      });
    }

    console.log('🗑️ All assembly deleted and scene cleared');
  };

  const handleExportRequest = () => {
    if (objects.length === 0) {
      Alert.alert("No Model", "Please load a 3D model before exporting.");
      return;
    }

    // Reset and open modal
    setExportStage('format');
    setSelectedFormat('stl');
    setExportMode('merged');
    const baseName = currentFileName.replace(/\.[^/.]+$/, "") || "model";
    setExportName(baseName);
    setExportProgress(0);
    setExportModalVisible(true);
  };

  const handleExportStep1 = (format) => {
    setSelectedFormat(format);
    setExportStage('mode');
  };

  const handleExportStep2 = (mode) => {
    setExportMode(mode);
    setExportStage('name');
  };

  const handleExportStep3 = () => {
    if (!exportName.trim()) {
      Alert.alert("Invalid Name", "Please enter a filename.");
      return;
    }

    setExportStage('processing');
    setExportProgress(0.1);

    // Send export request to WebView
    if (stepLoaderRef.current) {
      stepLoaderRef.current.postMessage(JSON.stringify({
        type: 'EXPORT_MODEL',
        format: selectedFormat,
        mode: exportMode
      }));
      console.log(`📤 Export requested: ${selectedFormat.toUpperCase()}, mode: ${exportMode}`);
    }
  };

  const handleExportData = async (data) => {
    try {
      setExportProgress(0.5);

      if (data.mode === 'merged') {
        // Single file export
        const extension = data.format || selectedFormat;
        const fileName = exportName + "." + extension;
        const filePath = FileSystem.cacheDirectory + fileName;

        setExportProgress(0.7);
        await FileSystem.writeAsStringAsync(filePath, data.data, {
          encoding: FileSystem.EncodingType.UTF8
        });

        setExportProgress(0.9);
        await Sharing.shareAsync(filePath, {
          mimeType: extension === 'obj' ? 'model/obj' : 'application/sla',
          dialogTitle: `Export ${extension.toUpperCase()} File`
        });

        console.log(`✅ ${extension.toUpperCase()} exported:`, fileName);
      } else if (data.mode === 'individual') {
        // Multiple files in ZIP
        const zip = new JSZip();

        setExportProgress(0.6);
        data.payload.forEach(part => {
          const extension = data.format || selectedFormat;
          zip.file(part.name + "." + extension, part.data);
        });

        setExportProgress(0.8);
        const content = await zip.generateAsync({ type: 'base64' });
        const zipFileName = exportName + "_parts.zip";
        const zipPath = FileSystem.cacheDirectory + zipFileName;

        await FileSystem.writeAsStringAsync(zipPath, content, {
          encoding: FileSystem.EncodingType.Base64
        });

        setExportProgress(0.95);
        await Sharing.shareAsync(zipPath, {
          mimeType: 'application/zip',
          dialogTitle: 'Export Parts ZIP'
        });

        console.log(`✅ ZIP exported: ${zipFileName} (${data.payload.length} parts)`);
      }

      // Success - close modal
      setExportProgress(1.0);
      setTimeout(() => {
        setExportModalVisible(false);
        setExportStage('format');
      }, 500);

    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', error.message);
      setExportModalVisible(false);
      setExportStage('format');
    }
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

  const handleShowFileInfo = () => {
    if (!currentFileName || currentFileName === "No File Loaded") {
      Alert.alert("File Information", "No file is currently loaded.");
      return;
    }

    const sizeInKB = (fileSize / 1024).toFixed(2);
    const sizeInMB = (sizeInKB / 1024).toFixed(2);
    const sizeString = sizeInMB > 1 ? `${sizeInMB} MB` : `${sizeInKB} KB`;

    const infoString =
      `Name: ${currentFileName}\n` +
      `Type: ${stepFileType.toUpperCase()}\n` +
      `Size: ${sizeString}\n` +
      `Parts: ${objects.length}\n` +
      `----------------\n` +
      `Protocol: ${fileMetadata.schema}\n` +
      `Software: ${fileMetadata.software}\n` +
      `Created: ${fileMetadata.created}\n` +
      `Author: ${fileMetadata.author}`;

    Alert.alert("File Information", infoString, [{ text: "OK" }]);
  };

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


  const [theme, setTheme] = useState("light");

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
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
            onExportData={handleExportData}
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



          {/* Bottom Center Import Button */}
          <TouchableOpacity
            style={[
              styles.importButton,
              loading && styles.importButtonLoading,
              {
                opacity: (objects.length > 0 && !importBtnActive) ? 0.3 : 1
              }
            ]}
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
          onResetPosition={handleResetPosition}
          fileName={currentFileName}
          onDeleteAll={handleDeleteAll}
          onExport={handleExportRequest}
          onShowFileInfo={handleShowFileInfo}
        />
      </Animated.View>

      {/* Export Wizard Modal */}
      <Modal
        visible={exportModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (exportStage !== 'processing') {
            setExportModalVisible(false);
            setExportStage('format');
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: isDark ? "#2a2a2a" : "#ffffff" }]}>
            {/* Stage: Format Selection */}
            {exportStage === 'format' && (
              <>
                <Text style={[styles.modalTitle, { color: isDark ? "#fff" : "#000" }]}>
                  Choose Export Format
                </Text>
                <TouchableOpacity
                  style={styles.wizardButton}
                  onPress={() => handleExportStep1('stl')}
                >
                  <Text style={styles.wizardButtonText}>📐 STL (3D Print)</Text>
                  <Text style={styles.wizardButtonSubtext}>Standard format for 3D printing</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.wizardButton}
                  onPress={() => handleExportStep1('obj')}
                >
                  <Text style={styles.wizardButtonText}>🎨 OBJ (Standard)</Text>
                  <Text style={styles.wizardButtonSubtext}>Universal 3D model format</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.wizardCancelButton}
                  onPress={() => {
                    setExportModalVisible(false);
                    setExportStage('format');
                  }}
                >
                  <Text style={styles.wizardCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Stage: Mode Selection */}
            {exportStage === 'mode' && (
              <>
                <Text style={[styles.modalTitle, { color: isDark ? "#fff" : "#000" }]}>
                  Export Mode
                </Text>
                <TouchableOpacity
                  style={styles.wizardButton}
                  onPress={() => handleExportStep2('merged')}
                >
                  <Text style={styles.wizardButtonText}>🔗 Single Body (Merged)</Text>
                  <Text style={styles.wizardButtonSubtext}>One combined file</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.wizardButton}
                  onPress={() => handleExportStep2('individual')}
                >
                  <Text style={styles.wizardButtonText}>📦 Individual Parts (ZIP)</Text>
                  <Text style={styles.wizardButtonSubtext}>Separate files in archive</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.wizardCancelButton}
                  onPress={() => setExportStage('format')}
                >
                  <Text style={styles.wizardCancelText}>Back</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Stage: Filename Input */}
            {exportStage === 'name' && (
              <>
                <Text style={[styles.modalTitle, { color: isDark ? "#fff" : "#000" }]}>
                  Enter Filename
                </Text>
                <TextInput
                  style={[
                    styles.filenameInput,
                    {
                      backgroundColor: isDark ? "#1a1a1a" : "#f5f5f5",
                      color: isDark ? "#fff" : "#000",
                      borderColor: isDark ? "#444" : "#ddd"
                    }
                  ]}
                  value={exportName}
                  onChangeText={setExportName}
                  placeholder="Enter filename..."
                  placeholderTextColor={isDark ? "#888" : "#999"}
                  autoFocus={true}
                />
                <Text style={[styles.filenameHint, { color: isDark ? "#888" : "#666" }]}>
                  Extension (.{selectedFormat}) will be added automatically
                </Text>
                <View style={styles.wizardButtonRow}>
                  <TouchableOpacity
                    style={[styles.wizardButton, { flex: 1, marginRight: 10 }]}
                    onPress={handleExportStep3}
                  >
                    <Text style={styles.wizardButtonText}>✓ Export</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.wizardCancelButton, { flex: 1 }]}
                    onPress={() => setExportStage('mode')}
                  >
                    <Text style={styles.wizardCancelText}>Back</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Stage: Processing */}
            {exportStage === 'processing' && (
              <>
                <Text style={[styles.modalTitle, { color: isDark ? "#fff" : "#000" }]}>
                  Exporting Model...
                </Text>
                <ActivityIndicator size="large" color="#3b82f6" style={{ marginVertical: 30 }} />
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBarFill, { width: `${exportProgress * 100}%` }]} />
                </View>
                <Text style={[styles.progressText, { color: isDark ? "#888" : "#666" }]}>
                  {Math.round(exportProgress * 100)}%
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>
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

  importButton: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    backgroundColor: "#2196F3", // Modern blue color
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 50,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 100,
    minWidth: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  importButtonLoading: {
    opacity: 0.8,
  },
  importButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  progressContainer: {
    width: 120,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  progressBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 50,
  },
  progressText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
    zIndex: 1,
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
  // Export Wizard Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "85%",
    maxWidth: 400,
    borderRadius: 20,
    padding: 30,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 25,
    textAlign: "center",
  },
  wizardButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 15,
    elevation: 3,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  wizardButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  wizardButtonSubtext: {
    color: "#e0e7ff",
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
  wizardCancelButton: {
    backgroundColor: "transparent",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 5,
    borderWidth: 1,
    borderColor: "#888",
  },
  wizardCancelText: {
    color: "#888",
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
  },
  wizardButtonRow: {
    flexDirection: "row",
    marginTop: 10,
  },
  filenameInput: {
    fontSize: 16,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  filenameHint: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 20,
  },
  progressBarContainer: {
    width: "100%",
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
    marginVertical: 20,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    textAlign: "center",
    fontWeight: "600",
  },
});
