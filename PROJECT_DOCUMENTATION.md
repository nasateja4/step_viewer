# STEP Viewer Project - Complete Documentation

## Project Overview

**Project Name**: STEP Viewer  
**Purpose**: A cross-platform 3D CAD file viewer application that supports STEP, IGES, STL, OBJ, GLTF, GLB, and PLY file formats.  
**Architecture**: Three-tier application with Mobile (React Native/Expo), Backend (Python/FastAPI), and Frontend (React/Vite)

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Technology Stack](#technology-stack)
3. [Mobile Application](#mobile-application)
4. [Backend Application](#backend-application)
5. [Frontend Application](#frontend-application)
6. [File Formats Supported](#file-formats-supported)
7. [Setup Instructions](#setup-instructions)
8. [Key Features](#key-features)
9. [Memory Management](#memory-management)
10. [Troubleshooting](#troubleshooting)

---

## Project Structure

```
step_viewer/
├── mobile/                         # React Native Expo mobile app (Primary application)
│   ├── .expo/                      # Expo generated files
│   ├── assets/                     # 3D libraries and app assets
│   │   ├── three.min.txt           # Three.js library (618KB)
│   │   ├── OrbitControls.txt       # Camera controls library (26KB)
│   │   ├── STLLoader.txt           # STL file loader (9KB)
│   │   ├── OBJLoader.txt           # OBJ file loader (21KB)
│   │   ├── GLTFLoader.txt          # GLTF/GLB loader (103KB)
│   │   ├── occt-import-js.wasm     # STEP/IGES processor (21MB)
│   │   ├── icon.png                # App icon
│   │   ├── adaptive-icon.png       # Android adaptive icon
│   │   ├── splash-icon.png         # Splash screen icon
│   │   └── favicon.png             # Web favicon
│   ├── src/
│   │   ├── components/             # React components
│   │   │   ├── StepLoader.js       # Main 3D viewer (WebView-based)
│   │   │   ├── Sidebar.js          # Parts list and controls
│   │   │   ├── Viewer.js           # Legacy R3F viewer (unused)
│   │   │   ├── ViewSelector.js     # Camera view presets
│   │   │   ├── MinimalViewer.js    # Minimal viewer stub
│   │   │   ├── Gizmo.js            # Transform gizmo
│   │   │   ├── TransformationPanel.js  # Transform controls
│   │   │   ├── MeshObject_fixed.js # Mesh object handler
│   │   │   └── Viewer.js.backup    # Backup file
│   │   └── hooks/                  # Custom React hooks (empty)
│   ├── App.js                      # Main application entry point
│   ├── index.js                    # Expo entry point
│   ├── polyfills.js                # Browser polyfills for RN
│   ├── app.json                    # Expo configuration
│   ├── eas.json                    # Expo Application Services config
│   ├── metro.config.js             # Metro bundler configuration
│   ├── package.json                # NPM dependencies
│   └── .gitignore                  # Git ignore rules
├── backend/                        # Python FastAPI backend (Legacy)
│   ├── main.py                     # FastAPI server
│   ├── requirements.txt            # Python dependencies
│   ├── uploads/                    # Upload directory for conversions
│   └── __pycache__/               # Python cache
├── frontend/                       # React/Vite web frontend (Legacy)
│   ├── src/                        # Source files
│   │   ├── App.jsx                 # Main React component
│   │   ├── main.jsx                # Vite entry point
│   │   ├── App.css                 # App styles
│   │   ├── index.css               # Global styles
│   │   ├── components/             # React components
│   │   └── assets/                 # Static assets
│   ├── public/                     # Public static files
│   ├── dist/                       # Build output
│   ├── index.html                  # HTML entry
│   ├── vite.config.js              # Vite configuration
│   ├── eslint.config.js            # ESLint rules
│   ├── package.json                # NPM dependencies
│   └── README.md                   # Frontend readme
├── .gitignore                      # Root git ignore
└── package-lock.json               # Root lock file
```

---

## Technology Stack

### Mobile Application (Primary)

#### Core Framework
- **React Native**: `0.81.5` - Cross-platform mobile framework
- **Expo SDK**: `~54.0.25` - Development platform
- **React**: `19.1.0` - UI library

#### 3D Rendering
- **Three.js**: `0.166.1` - 3D graphics library (loaded via WebView)
- **@react-three/fiber**: `^9.4.0` - React renderer for Three.js (legacy)
- **@react-three/drei**: `^10.7.7` - Three.js helpers (legacy)
- **WebView**: `react-native-webview@^13.16.0` - Embeds 3D engine

#### CAD Processing
- **occt-import-js**: WASM-based STEP/IGES processor (loaded via CDN)
- Custom loaders for STL, OBJ, GLTF formats

#### File Handling
- **expo-document-picker**: `~14.0.7` - File selection
- **expo-file-system**: `~19.0.19` - File I/O operations
- **expo-gl**: `~16.0.7` - OpenGL ES bindings

#### UI Components
- **react-native-safe-area-context**: `^5.6.2` - Safe area handling
- **@expo/vector-icons**: Ionicons icon set

#### Utilities
- **buffer**: `^6.0.3` - Node.js Buffer polyfill
- **axios**: `^1.13.2` - HTTP client (for backend communication)

### Backend Application (Legacy - Not Actively Used)

#### Framework
- **FastAPI**: Python web framework
- **CadQuery**: STEP file processing
- **uvicorn**: ASGI server

#### Purpose
- Converts STEP files to STL format
- Not currently used by mobile app (mobile uses client-side WASM processing)

### Frontend Application (Legacy - Web Version)

#### Framework
- **React**: `^19.2.0`
- **Vite**: `^7.2.4` - Build tool
- **Three.js**: `^0.181.2`

#### 3D Rendering
- **@react-three/fiber**: `^9.4.0`
- **@react-three/drei**: `^10.7.7`
- **leva**: `^0.10.1` - GUI controls

---

## Mobile Application

### Architecture Overview

The mobile app uses a **WebView-based architecture** for 3D rendering:
1. `App.js` - Main container, manages UI state
2. `StepLoader.js` - WebView that runs Three.js and renders 3D models
3. `Sidebar.js` - Parts list and controls
4. Communication via `postMessage` between React Native and WebView

### Core Files

#### 1. **App.js** (773 lines)

**Purpose**: Main application container and state manager

**Key Responsibilities**:
- Asset loading (Three.js libraries, loaders, WASM)
- File import handling (DocumentPicker)
- State management for objects, theme, view modes
- Sidebar and UI overlay management
- Communication bridge to StepLoader

**Key States**:
```javascript
- objects: Array of loaded 3D parts
- selectedId: Currently selected object UUID
- stepFileContent: Base64 file data
- stepFileType: 'step' | 'iges' | 'stl' | 'obj' | 'gltf' | 'glb'
- qualityMode: 'draft' | 'high'
- theme: 'light' | 'dark'
- viewMode: 'shaded' | 'edges' | 'wireframe'
- showGrid: boolean
- loading: boolean
- loadingProgress: 0-100
```

**Asset Loading Flow**:
```javascript
1. Load three.min.txt (Three.js library)
2. Load STLLoader.txt, OBJLoader.txt, GLTFLoader.txt
3. Load OrbitControls.txt (camera controls)
4. Load occt-import-js.wasm (STEP/IGES processor)
5. Set assetsLoaded = true
```

**File Import Flow**:
```javascript
1. User taps "Import" button
2. DocumentPicker shows file selector
3. Read file as Base64 (FileSystem.readAsStringAsync)
4. Detect file type from extension
5. Set stepFileContent + stepFileType
6. StepLoader picks up changes and processes file
7. On completion, receive PARTS_LOADED message
8. Populate objects array for sidebar
```

**Message Handling**:
- Sends messages to WebView for updates (color, visibility, delete, reset)
- Receives messages from WebView (PARTS_LOADED, SUCCESS, ERROR)

**Critical Features**:
- Memory Management: Clears base64 strings after use to prevent OOM
- Progress tracking during file load
- Theme switching (light/dark)
- View mode cycling (shaded → edges → wireframe)

---

#### 2. **StepLoader.js** (500 lines)

**Purpose**: WebView-based 3D viewer that runs Three.js

**Architecture**: 
- React Native WebView component
- Injects Three.js and loaders as JavaScript code
- Runs HTML page with embedded Three.js scene
- Communicates via `postMessage` API

**Initialization Sequence**:
```
1. WebView loads HTML content
2. Receives READY_FOR_WASM message
3. Injects Three.js library [1/7]
4. Injects OrbitControls [2/7]
5. Injects STLLoader [3/7]
6. Injects OBJLoader [4/7]
7. Injects GLTFLoader [5/7]
8. Injects message listener [6/7]
9. Sends PING [7/7]
10. Receives PONG → listener attached
11. Sends WASM in chunks (1MB each)
12. WASM initializes → WASM_READY
13. Initializes Three.js scene → SCENE_READY
14. Ready to load files
```

**WASM Chunking**:
- 21MB WASM file split into 1MB chunks
- Sent sequentially with 100ms delay
- Assembled in WebView memory
- Initialized with `occtimportjs({ wasmBinary: bytes })`

**Message Types Sent**:
- `PING` - Test listener
- `WASM_CHUNK` - WASM data chunk
- `INIT_SCENE` - Initialize Three.js scene
- `LOAD_FILE` - Load CAD file
- `UPDATE_OBJECT` - Update color/visibility
- `REMOVE_OBJECT` - Delete object
- `RESET_OBJECT` - Reset transform
- `TOGGLE_GRID` - Show/hide grid
- `SET_VIEW_MODE` - Change rendering mode

**Message Types Received**:
- `READY_FOR_WASM` - WebView loaded
- `LISTENER_READY` - Message listener attached
- `PONG` - Listener test response
- `SCENE_READY` - Three.js scene initialized
- `WASM_READY` - OCCT engine ready
- `PARTS_LOADED` - Model loaded, parts list
- `SUCCESS` - Operation successful
- `ERROR` - Error occurred
- `LOG` / `ERROR` - Console output from WebView

**Three.js Scene (in WebView)**:
```javascript
- Scene: background color #f5f5f5, fog enabled
- Camera: PerspectiveCamera, FOV 60°, position (10, 10, 10)
- Renderer: WebGL, antialias enabled
- Lights: Ambient (0.7), Directional front (1.0), Directional back (0.5)
- Grid: GridHelper 200x50 units
- Controls: OrbitControls with damping
```

**File Processing (STEP/IGES)**:
```javascript
1. Receive base64 file content
2. Convert to Uint8Array
3. Call occtInstance.ReadStepFile(bytes)
4. Extract ALL meshes from result (supports multi-part assemblies)
5. Create THREE.Group() to hold assembly
6. Loop through each mesh:
   - Create BufferGeometry from vertices/indices/normals
   - Apply metallic material (with optional OCCT color)
   - Set name and metadata (Part_0, Part_1, etc.)
   - Save original state for reset
   - Add to assembly group
7. Center ENTIRE assembly (not individual parts)
8. Apply scale to assembly group (0.1x for better viewing)
9. Add group to scene
10. Build parts list with UUIDs
11. Send PARTS_LOADED message with count and structure
```

**Memory Management**:
- Clears base64 data immediately after conversion
- Disposes geometries/materials on delete
- Cleans WASM memory on object removal
- Resets busy flags to allow new loads

**Status Display**:
- Shows loading status badge at top center
- Auto-hides after 2 seconds for success states
- Animated fade-out effect

---

#### 3. **Sidebar.js** (338 lines)

**Purpose**: Parts list and control panel

**Features**:

1. **Top Control Row**:
   - Grid Toggle: Show/hide ground grid
   - View Mode: Cycle between shaded/edges/wireframe
   - Color Picker: Toggle color palette
   - View Selector: Camera preset views (legacy)

2. **Color Picker**:
   - 12 preset colors (Red, Orange, Yellow, Green, Cyan, Blue, Purple, Pink, White, Gray, Dark Gray, Black)
   - Horizontal scrollable palette
   - Applies to selected object

3. **Parts List Table**:
   - Columns: # (index), Parts list (name), Vis (visibility), Rst (reset), Del (delete)
   - Click name to select object
   - Eye icon to toggle visibility
   - Refresh icon to reset position
   - Trash icon to delete object
   - Selected object highlighted with blue background

4. **Bottom Footer**:
   - Theme toggle (light/dark mode)
   - Export BOM button (placeholder)

**Theme Support**:
- Dynamic colors based on light/dark theme
- Text, backgrounds, borders all adapt
- Active item highlighting

**Props**:
```javascript
{
  objects: Array,              // Parts list
  selectedId: string,          // Selected object UUID
  onSelect: (id) => void,      // Selection handler
  onUpdateObject: (id, updates) => void,  // Update handler
  onImport: () => void,        // Import file
  onDeleteObject: (id) => void,// Delete handler
  onResetPosition: (id) => void,// Reset transform
  theme: 'light' | 'dark',     // Current theme
  toggleTheme: () => void,     // Theme toggle
  viewMode: string,            // Current view mode
  onCycleViewMode: () => void, // Cycle view mode
  showGrid: boolean,           // Grid visibility
  onToggleGrid: () => void,    // Grid toggle
  showViewSelector: boolean,   // View selector visibility
  onToggleViewSelector: () => void, // View selector toggle
}
```

---

#### 4. **Viewer.js** (481 lines) - LEGACY

**Status**: Not currently used (replaced by StepLoader.js)

**Original Purpose**: React-Three-Fiber based 3D viewer

**Why Replaced**:
- R3F had compatibility issues with React Native
- Performance problems with large STEP files
- WebView approach proved more stable
- Better memory management with WebView

**Contains**:
- `MeshObject` component for rendering STL/OBJ/PLY
- `ZoomToFit` camera controller
- `CameraTransition` for smooth view changes
- Transform gizmo integration
- OrbitControls setup

---

#### 5. **polyfills.js** (5139 bytes)

**Purpose**: Provides browser APIs for React Native environment

**Polyfills**:
- `global.Buffer` - Node.js Buffer API
- `global.process` - Process object
- `atob` / `btoa` - Base64 encoding/decoding (critical for WASM loading)

**Why Needed**:
- Three.js expects browser environment
- WASM loading requires `atob` for base64 decoding
- Buffer needed for binary data handling

---

#### 6. **index.js** (307 bytes)

**Purpose**: Expo entry point

**Content**:
```javascript
import 'expo-router/entry';
import { registerRootComponent } from 'expo';
import App from './App';
registerRootComponent(App);
```

---

### Configuration Files

#### **app.json** (36 lines)

**Purpose**: Expo configuration

**Key Settings**:
```json
{
  "name": "mobile",
  "slug": "mobile",
  "version": "1.0.0",
  "orientation": "portrait",
  "newArchEnabled": true,  // React Native new architecture
  "android": {
    "package": "com.teja4504.mobile",
    "edgeToEdgeEnabled": true
  },
  "extra": {
    "eas": {
      "projectId": "27dad048-1815-40a7-b458-44d9d3c3efe6"
    }
  }
}
```

---

#### **eas.json** (344 bytes)

**Purpose**: Expo Application Services build configuration

**Profiles**:
- `development`: Development builds
- `preview`: Preview builds for testing
- `production`: Production builds for app stores

---

#### **metro.config.js** (470 bytes)

**Purpose**: Metro bundler configuration

**Key Settings**:
```javascript
{
  resolver: {
    assetExts: ['wasm', 'txt', 'png', 'jpg', ...],  // Include WASM and TXT
    sourceExts: ['js', 'json', 'jsx', 'ts', 'tsx']
  }
}
```

**Why Important**:
- Allows `.txt` files for Three.js libraries (Metro doesn't compile them)
- Enables `.wasm` file bundling
- Prevents Metro from trying to transform binary files

---

#### **package.json** (34 lines)

**Purpose**: NPM dependencies and scripts

**Scripts**:
```json
{
  "start": "expo start",
  "android": "expo start --android",
  "ios": "expo start --ios",
  "web": "expo start --web"
}
```

**Critical Dependencies**:
```json
{
  "expo": "~54.0.25",
  "react": "19.1.0",
  "react-native": "0.81.5",
  "three": "0.166.1",
  "react-native-webview": "^13.16.0",
  "expo-file-system": "~19.0.19",
  "expo-document-picker": "~14.0.7"
}
```

**Overrides**:
```json
{
  "three": "0.166.1"  // Pin Three.js version for consistency
}
```

---

### Assets Directory

#### **Three.js Libraries** (renamed to .txt to avoid Metro compilation)

1. **three.min.txt** (618,904 bytes)
   - Minified Three.js library v0.166.1
   - Core 3D rendering engine
   - Loaded into WebView via injectJavaScript

2. **OrbitControls.txt** (26,660 bytes)
   - Camera control library
   - Enables orbit, zoom, pan interactions
   - Attached to Three.js camera

3. **STLLoader.txt** (9,840 bytes)
   - Loads STL (stereolithography) files
   - Returns BufferGeometry

4. **OBJLoader.txt** (21,482 bytes)
   - Loads OBJ (Wavefront) files
   - Returns Group with meshes

5. **GLTFLoader.txt** (103,523 bytes)
   - Loads GLTF/GLB (GL Transmission Format) files
   - Supports animations, materials, scenes

#### **WASM Engine**

6. **occt-import-js.wasm** (21,515,102 bytes)
   - OpenCascade STEP/IGES processor
   - Compiled to WebAssembly
   - Loaded via CDN script + base64 data
   - Enables client-side STEP file parsing

**Why .txt Extension?**
- Metro bundler compiles `.js` files
- Compilation breaks Three.js library
- `.txt` files are treated as assets (no compilation)
- Read as strings and injected at runtime

---

## Backend Application

### **main.py** (59 lines)

**Purpose**: FastAPI server for STEP to STL conversion

**Status**: Legacy - not actively used by mobile app

**Endpoints**:

1. **GET /**: Health check
   ```json
   { "status": "ok", "message": "STEP Converter API Ready" }
   ```

2. **POST /convert**: Convert STEP to STL
   - Accepts STEP file upload
   - Uses CadQuery to import STEP
   - Exports to STL format
   - Returns STL file

**Dependencies** (requirements.txt):
```
fastapi
uvicorn
cadquery
```

**CORS**: Enabled for all origins (development mode)

**Why Not Used**:
- Mobile app uses client-side WASM processing
- Faster (no network overhead)
- Works offline
- No server infrastructure needed

**Potential Use**:
- Batch conversions
- Server-side processing for web frontend
- Heavy conversions that exceed mobile memory

---

## Frontend Application

### Web-based 3D viewer (React + Vite)

**Status**: Legacy - separate web application

**Purpose**: Browser-based STEP viewer

**Structure**:
```
src/
  ├── App.jsx          # Main component
  ├── main.jsx         # Vite entry
  ├── App.css          # Styles
  ├── index.css        # Global styles
  ├── components/      # React components
  └── assets/          # Static assets
```

**Technology**:
- React 19.2.0
- Vite 7.2.4
- Three.js + R3F
- Leva controls

**Not Integrated**: Separate from mobile app

---

## File Formats Supported

| Format | Extension | Loader | Description |
|--------|-----------|--------|-------------|
| STEP   | .step, .stp | occt-import-js | ISO 10303 CAD standard |
| IGES   | .iges, .igs | occt-import-js | Initial Graphics Exchange Specification |
| STL    | .stl | STLLoader | Stereolithography (3D printing) |
| OBJ    | .obj | OBJLoader | Wavefront 3D object |
| GLTF   | .gltf | GLTFLoader | GL Transmission Format (JSON) |
| GLB    | .glb | GLTFLoader | Binary GLTF |
| PLY    | .ply | PLYLoader | Polygon File Format (legacy) |

---

## Setup Instructions

### Mobile App

#### Prerequisites
- Node.js 18+ and npm
- Expo CLI: `npm install -g expo-cli`
- Android Studio (for Android) or Xcode (for iOS)

#### Installation
```bash
cd mobile
npm install
```

#### Run Development
```bash
# Start Expo dev server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run on web
npm run web
```

#### Build for Production
```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios
```

### Backend (Optional)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (Optional)

```bash
cd frontend
npm install
npm run dev  # Development server
npm run build  # Production build
```

---

## Key Features

### 1. **Multi-Part Assembly Support (NEW in v1.1.0)**
- STEP/IGES files with multiple parts fully supported
- All parts loaded and displayed simultaneously
- Group-based assembly structure maintains part relationships
- Individual part selection and manipulation
- Proper assembly centering (parts stay in correct relative positions)
- Each part appears in parts list with metadata

### 2. **Multi-Format Support**
- Handles 7 different 3D file formats
- Client-side processing (WASM)
- No server dependency

### 3. **Parts List Management**
- View all parts in loaded model
- Select, hide/show individual parts
- Color customization per part
- Delete parts
- Reset transformations

### 4. **View Modes**
- **Shaded**: Full material rendering
- **Edges**: Shows edges on shaded surfaces
- **Wireframe**: Wireframe-only display

### 5. **Camera Controls**
- OrbitControls: Rotate, zoom, pan
- Zoom in/out buttons
- Auto-fit on load
- View presets (front, back, top, etc.)

### 6. **Theme Support**
- Light and dark themes
- Persists UI preference
- Affects sidebar, buttons, text

### 7. **Grid & Origin**
- Toggle ground grid
- Show/hide origin marker
- Helps with orientation

### 8. **Memory Management**
- Automatic cleanup of base64 strings
- Geometry/material disposal
- WASM memory clearing
- Prevents out-of-memory crashes

### 9. **Progress Tracking**
- Visual loading progress (0-100%)
- Status badges (Engine Ready, Model Loaded, etc.)
- Auto-hiding success messages

### 10. **Responsive UI**
- Sliding sidebar
- Overlay controls
- Touch-optimized
- Safe area handling

---

## Memory Management

### Critical Patterns

#### 1. **Base64 Cleanup**
```javascript
// App.js - After file read
let base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
setStepFileContent(base64);
base64 = null;  // ✅ Critical: Clear immediately
console.log('🧹 Base64 string cleared from memory');
```

#### 2. **WebView Memory Cleanup**
```javascript
// StepLoader.js - After WASM conversion
var bytes = new Uint8Array(window.atob(fileData).split('').map(...));
fileData = null;  // ✅ Clear base64 from WebView
console.log('🧹 Base64 data cleared from WebView memory');
```

#### 3. **Object Removal**
```javascript
// WebView - On REMOVE_OBJECT
if (obj.geometry) obj.geometry.dispose();
if (obj.material) obj.material.dispose();
if (window.occtInstance) window.occtInstance.delete();  // ✅ Clear WASM
window.isLoading = false;  // ✅ Reset flags
```

#### 4. **WASM Chunk Cleanup**
```javascript
// After WASM assembly
var fullBase64 = window.wasmChunks.join('');
var bytes = new Uint8Array(...);
window.wasmChunks = null;  // ✅ Clear chunks
fullBase64 = null;  // ✅ Clear assembled base64
bytes = null;  // ✅ Clear byte array
```

### Why Important?
- Mobile devices have limited RAM (1-4GB typical)
- Large STEP files can be 10-50MB+
- Base64 encoding increases size by ~33%
- Without cleanup, multiple loads cause OOM crashes

---

## Troubleshooting

### Common Issues

#### 1. **App Crashes on Large Files**
**Cause**: Out of memory  
**Solution**: 
- Ensure base64 cleanup is working
- Use "draft" quality mode (linearDeflection: 0.5)
- Check for memory leaks in object removal

#### 2. **WASM Not Loading**
**Cause**: Network issue or chunking problem  
**Solution**:
- Check console for "WASM_READY" message
- Verify all chunks received
- Check CDN script loaded: `occt-import-js.wasm`

#### 3. **Three.js Not Loading**
**Cause**: Asset loading failed  
**Solution**:
- Check `assetsLoaded` state
- Verify .txt files in assets folder
- Check Metro bundler config

#### 4. **Black Screen in WebView**
**Cause**: Scene not initialized  
**Solution**:
- Check for "SCENE_READY" message
- Verify OrbitControls loaded
- Check canvas creation

#### 5. **Controls Not Working**
**Cause**: OrbitControls not loaded or initialized  
**Solution**:
- Verify OrbitControls.txt injected
- Check `window.controls` exists in WebView
- Ensure camera position valid

#### 6. **Part Colors Not Changing**
**Cause**: Message not sent or object UUID mismatch  
**Solution**:
- Check `UPDATE_OBJECT` message sent
- Verify object UUID matches
- Check object is a mesh (not group)

#### 7. **Second File Won't Load**
**Cause**: WASM or state not reset  
**Solution**:
- Clear previous objects first
- Reset `isLoading` and `isProcessing` flags
- Call `occtInstance.delete()` before new load

---

## Development Notes

### Architecture Decisions

1. **Why WebView Instead of R3F?**
   - R3F had React Native compatibility issues
   - WebView provides stable Three.js environment
   - Easier to inject and update libraries
   - Better isolation from RN rendering

2. **Why .txt Extensions?**
   - Metro bundler compiles .js files
   - Compilation breaks minified Three.js
   - .txt treated as static assets
   - Loaded as strings at runtime

3. **Why WASM Chunking?**
   - 21MB WASM file too large for single postMessage
   - Chunking prevents memory spikes
   - Progressive loading with status updates

4. **Why Client-Side Processing?**
   - No server infrastructure needed
   - Works offline
   - Faster (no network latency)
   - Better for mobile use case

### Performance Tips

1. **Quality Modes**:
   - Draft mode (linearDeflection: 0.5) - faster, lower quality
   - High mode (linearDeflection: 0.1) - slower, higher quality

2. **File Size Limits**:
   - Recommended max: 10MB STEP files
   - Anything larger may cause crashes on low-end devices

3. **Memory Optimization**:
   - Always clear base64 strings after use
   - Dispose geometries on delete
   - Reset WASM instance between loads

4. **UI Responsiveness**:
   - Use `pointerEvents="box-none"` for overlays
   - Set `pointerEvents="auto"` for interactive elements
   - This prevents UI from blocking 3D interactions

---

## Future Enhancements

### Planned Features
1. Export BOM (Bill of Materials)
2. Measurements and annotations
3. Section views / clipping planes
4. Animation support for GLTF files
5. Multi-file import (loading multiple separate files simultaneously)
6. Cloud sync and sharing
7. Augmented Reality (AR) view

### Known Limitations
1. No assembly constraints
2. No parametric editing
3. Limited material editing
4. No texture support for STEP/IGES
5. Single file at a time (no multi-import)
6. Part naming depends on OCCT metadata (may show generic names)

---

## Contact & Support

For issues or questions:
1. Check console logs (React Native debugger)
2. Review this documentation
3. Check GitHub issues (if applicable)

---

## License

(Add your license information here)

---

## Changelog

### Version 1.1.0 (Current)
- **NEW**: Multi-part STEP/IGES assembly support
  - Loop through all meshes in result (not just first mesh)
  - Group-based assembly structure with proper centering
  - Individual part naming and metadata
  - All parts visible and manageable in parts list
- STEP, IGES, STL, OBJ, GLTF, GLB, PLY support
- WebView-based rendering
- Parts list management
- Light/dark theme
- View modes (shaded, edges, wireframe)
- Memory optimization

### Version 1.0.0
- Initial release
- Single-part STEP/IGES support
- Basic 3D viewer functionality

---

**Last Updated**: November 29, 2025  
**Documentation Version**: 1.0  
**For AI Agents**: This documentation is designed to be comprehensive and detailed to enable AI agents to understand and modify the codebase effectively. All file paths, dependencies, and architectural decisions are documented for reference.
