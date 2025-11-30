import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, Text, Animated } from 'react-native';
import { WebView } from 'react-native-webview';

const StepLoader = forwardRef(({
  fileContent,
  fileType = 'step',
  qualityMode = 'high',
  threeJsCode = '',
  stlLoaderCode = '',
  objLoaderCode = '',
  gltfLoaderCode = '',
  orbitControlsCode = '',
  occtWasmBase64 = '',
  onModelLoaded,
  onError,
  onExportData
}, ref) => {
  const webViewRef = useRef(null);
  const isInitialized = useRef(false);
  const wasmSent = useRef(false);

  const [webViewReady, setWebViewReady] = useState(false);
  const [librariesInjected, setLibrariesInjected] = useState(false);
  const [listenerAttached, setListenerAttached] = useState(false);
  const [wasmReady, setWasmReady] = useState(false);
  const [engineStatus, setEngineStatus] = useState('🔴 Initializing...');
  const [statusOpacity] = useState(new Animated.Value(1));
  const hideTimeoutRef = useRef(null);

  // Expose postMessage method to parent via ref
  useImperativeHandle(ref, () => ({
    postMessage: (message) => {
      if (webViewRef.current) {
        webViewRef.current.postMessage(message);
      }
    }
  }));

  const msgListenerCode = `
(function() {
  if (window.isListenerAttached) return;
  window.isListenerAttached = true;
  window.wasmChunks = [];
  window.chunksReceived = 0;
  window.wasmInitialized = false;
  window.sceneInitialized = false;
  
  function handleMessage(event) {
    try {
      var msg = event.data;
      try { msg = JSON.parse(event.data); } catch(e) {}
      
      if (msg.type) console.log('🔵 Received: ' + msg.type);
      
      if (msg.type === 'PING') {
        console.log('🏓 PONG');
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PONG' }));
        return;
      }
      
      if (msg.type === 'WASM_CHUNK') {
        window.wasmChunks[msg.index] = msg.data;
        window.chunksReceived++;
        if (window.chunksReceived % 5 === 0) console.log('🔹 Chunk ' + window.chunksReceived + ' / ' + msg.total);
        if (window.chunksReceived >= msg.total) {
          console.log('🟢 Assembling WASM...');
          setTimeout(function() {
            try {
              var fullBase64 = window.wasmChunks.join('');
              var bytes = new Uint8Array(window.atob(fullBase64).split('').map(function(c) { return c.charCodeAt(0); }));
              occtimportjs({ wasmBinary: bytes }).then(function(instance) {
                window.occtInstance = instance;
                window.wasmInitialized = true;
                // 🧹 CLEANUP MEMORY
                window.wasmChunks = null;
                fullBase64 = null;
                bytes = null;
                console.log('🧹 Memory cleaned');
                console.log('🟢🟢🟢 OCCT ENGINE READY!');
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'WASM_READY' }));
              });
            } catch (err) { console.error('Assembly error: ' + err.message); }
          }, 100);
        }
      }
      
      
      if (msg.type === 'INIT_SCENE') {
        if (!window.sceneInitialized) {
          console.log('🎬 Initializing scene at startup...');
          window.sceneInitialized = window.initThreeScene();
          if (window.sceneInitialized) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SCENE_READY' }));
          }
        }
      }
      
      
      // ========================================
      // SMART MATERIAL SYSTEM - Helper Functions
      // ========================================
      
      // Create metallic material for STL/OBJ/untextured models
      function makeMetalMaterial() {
        return new THREE.MeshStandardMaterial({
          color: 0xaaaaaa,        // Light Grey
          metalness: 0.7,         // Metallic look
          roughness: 0.3,         // Slightly shiny
          envMapIntensity: 1.0
        });
      }
      
      // Save original material state (for reset functionality)
      function saveOriginalState(object) {
        object.traverse(function(child) {
          if (child.isMesh && child.material) {
            // Save original color
            if (child.material.color) {
              child.userData.originalColor = child.material.color.getHex();
            }
            // Save texture reference
            child.userData.originalMap = child.material.map;
            child.userData.hasTexture = !!child.material.map;
            
            // Save other material properties
            if (child.material.metalness !== undefined) {
              child.userData.originalMetalness = child.material.metalness;
            }
            if (child.material.roughness !== undefined) {
              child.userData.originalRoughness = child.material.roughness;
            }
          }
        });
        console.log('💾 Original state saved');
      }
      
      // Helper to find object recursively
      var findObject = function(id) {
        return window.scene ? window.scene.getObjectByProperty('uuid', id) : null;
      };
      
      // Helper to force re-render
      var forceRender = function() {
        if (window.renderer && window.scene && window.camera) {
          window.renderer.render(window.scene, window.camera);
        }
      };
      
      // Export Scene Function - Clean Implementation
      window.exportScene = function(format, mode) {
        try {
          console.log("Starting export: " + format + " " + mode);
          
          // Helper: Generate STL String
          function generateSTL(geometry, name) {
              var vertices = geometry.attributes.position.array;
              var indices = geometry.index ? geometry.index.array : null;
              var stl = "solid " + name + "\\n";
              
              if (indices) {
                  for (var i = 0; i < indices.length; i += 3) {
                      var a = indices[i] * 3;
                      var b = indices[i+1] * 3;
                      var c = indices[i+2] * 3;
                      stl += "facet normal 0 0 0\\nouter loop\\n";
                      stl += "vertex " + vertices[a] + " " + vertices[a+1] + " " + vertices[a+2] + "\\n";
                      stl += "vertex " + vertices[b] + " " + vertices[b+1] + " " + vertices[b+2] + "\\n";
                      stl += "vertex " + vertices[c] + " " + vertices[c+1] + " " + vertices[c+2] + "\\n";
                      stl += "endloop\\nendfacet\\n";
                  }
              } else {
                   for (var i = 0; i < vertices.length; i += 9) {
                      stl += "facet normal 0 0 0\\nouter loop\\n";
                      stl += "vertex " + vertices[i] + " " + vertices[i+1] + " " + vertices[i+2] + "\\n";
                      stl += "vertex " + vertices[i+3] + " " + vertices[i+4] + " " + vertices[i+5] + "\\n";
                      stl += "vertex " + vertices[i+6] + " " + vertices[i+7] + " " + vertices[i+8] + "\\n";
                      stl += "endloop\\nendfacet\\n";
                  }
              }
              stl += "endsolid " + name + "\\n";
              return stl;
          }

          // Helper: Generate OBJ String
          function generateOBJ(geometry, name) {
              var obj = "o " + name + "\\n";
              var vertices = geometry.attributes.position.array;
              for (var i = 0; i < vertices.length; i += 3) {
                  obj += "v " + vertices[i] + " " + vertices[i+1] + " " + vertices[i+2] + "\\n";
              }
              var indices = geometry.index ? geometry.index.array : null;
              if (indices) {
                  for (var i = 0; i < indices.length; i += 3) {
                      obj += "f " + (indices[i]+1) + " " + (indices[i+1]+1) + " " + (indices[i+2]+1) + "\\n";
                  }
              }
              return obj;
          }

          var results = [];
          var mergedContent = "";

          // Traverse the scene
          if (window.scene) {
              window.scene.traverse(function(child) {
                  if (child.isMesh) {
                      var content = "";
                      if (format === 'stl') content = generateSTL(child.geometry, child.name || 'mesh');
                      if (format === 'obj') content = generateOBJ(child.geometry, child.name || 'mesh');
                      
                      if (mode === 'merged') {
                          mergedContent += content + "\\n";
                      } else {
                          results.push({ name: child.name || 'part', data: content });
                      }
                  }
              });
          }

          var payload = (mode === 'merged') ? mergedContent : results;
          
          // Send back to React Native
          window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'EXPORT_DATA',
              mode: mode,
              format: format,
              payload: payload,
              data: (mode === 'merged') ? payload : undefined
          }));
          
          console.log("✅ Export completed: " + format + " " + mode);
          
        } catch (e) {
          console.error("Export Error: " + e.message);
          window.ReactNativeWebView.postMessage(JSON.stringify({ 
            type: 'ERROR', 
            message: 'Export failed: ' + e.message 
          }));
        }
      };
      
      if (msg.type === 'TOGGLE_GRID') {
        if (window.gridHelper) {
          window.gridHelper.visible = msg.value;
          console.log('🔲 Grid: ' + (msg.value ? 'ON' : 'OFF'));
          forceRender();
        }
      }
      
      if (msg.type === 'SET_VIEW_MODE') {
        console.log('🎨 View Mode: ' + msg.mode);
        if (window.scene) {
          window.scene.traverse(function(child) {
            if (child.isMesh && child.material) {
              if (msg.mode === 'wireframe') {
                child.material.wireframe = true;
                child.material.needsUpdate = true;
              } else if (msg.mode === 'solid') {
                child.material.wireframe = false;
                child.material.needsUpdate = true;
              }
            }
          });
          forceRender();
        }
      }
      
      if (msg.type === 'UPDATE_OBJECT') {
        var obj = findObject(msg.id);
        if (obj) {
          // Handle Visibility
          if (msg.changes.visible !== undefined) {
            obj.visible = msg.changes.visible;
            console.log('👁️ Visibility: ' + msg.changes.visible);
          }
          
          // Handle Color - traverse to support Groups (OBJ/GLTF)
          if (msg.changes.color) {
            obj.traverse(function(child) {
              if (child.isMesh && child.material) {
                // Parse color from hex string
                var colorHex = parseInt(msg.changes.color.replace('#', '0x'));
                child.material.color.setHex(colorHex);
                
                // Hide texture when applying custom color
                child.material.map = null;
                child.material.needsUpdate = true;
              }
            });
            console.log('🎨 Color updated: ' + msg.changes.color);
          }
          
          forceRender();
        }
      }
      
      if (msg.type === 'REMOVE_OBJECT') {
        var obj = findObject(msg.id);
        if (obj) {
          // 1. Remove from parent
          if (obj.parent) {
            obj.parent.remove(obj);
          } else {
            window.scene.remove(obj);
          }
          
          // 2. Cleanup Memory (Geometry & Material)
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach(function(mat) { mat.dispose(); });
            } else {
              obj.material.dispose();
            }
          }
          
          // 3. PRESERVE WASM ENGINE - DO NOT DELETE
          // WASM engine must stay alive for subsequent file loads
          // (Removed: window.occtInstance.delete() - causes 60% hang on next load)
          
          // 4. Force Reset Busy Flags
          window.isLoading = false;
          window.isProcessing = false;
          window.currentFile = null;
          
          // 5. Reset Controls to prevent crash
          if (window.controls) {
            window.controls.target.set(0, 0, 0);
            window.controls.update();
          }
          
          // 6. Force a render to clear the screen buffer
          if (window.renderer && window.scene && window.camera) {
            window.renderer.render(window.scene, window.camera);
          }
          
          console.log('🗑️ Object removed (WASM engine preserved for next load)');
        }
      }
      
      if (msg.type === 'RESET_OBJECT') {
        var obj = findObject(msg.id);
        if (obj) {
          // Reset Position/Rotation/Scale
          obj.position.set(0, 0, 0);
          obj.rotation.set(0, 0, 0);
          obj.scale.set(1, 1, 1);
          
          // Restore Original Materials (including textures)
          obj.traverse(function(child) {
            if (child.isMesh && child.material && child.userData.originalColor !== undefined) {
              // Restore original color
              child.material.color.setHex(child.userData.originalColor);
              
              // Restore texture if it had one
              if (child.userData.hasTexture && child.userData.originalMap) {
                child.material.map = child.userData.originalMap;
              } else {
                child.material.map = null;
              }
              
              // Restore metalness/roughness if saved
              if (child.userData.originalMetalness !== undefined) {
                child.material.metalness = child.userData.originalMetalness;
              }
              if (child.userData.originalRoughness !== undefined) {
                child.material.roughness = child.userData.originalRoughness;
              }
              
              child.material.needsUpdate = true;
            }
          });
          
          console.log('🔄 Object reset (position + materials): ' + msg.id);
          forceRender();
        }
      }
      
      // Export Handler - Delegates to window.exportScene
      if (msg.type === 'EXPORT_STL' || msg.type === 'EXPORT_MODEL') {
        var exportFormat = msg.format || 'stl';
        var exportMode = msg.mode || 'merged';
        console.log('📤 Export handler called - Format:', exportFormat, 'Mode:', exportMode);
        
        // Call the export function
        if (window.exportScene) {
          window.exportScene(exportFormat, exportMode);
        } else {
          console.error('❌ window.exportScene is not defined');
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'ERROR',
            message: 'Export function not available'
          }));
        }
      }
      
      
      if (msg.type === 'LOAD_FILE') {
        // ========================================
        // SOFT RESET - Clean scene without destroying WASM engine
        // ========================================
        console.log('🧹🧹🧹 Starting soft reset before load...');
        
        // 1. FORCE RESET all flags to ensure we don't get stuck
        window.isLoading = false;
        window.isProcessing = false;
        window.currentFile = null;
        window.selectedObject = null;
        console.log('✅ Flags reset');
        
        // 2. SCENE CLEANUP - Dispose all meshes/geometries/materials (KEEP WASM ALIVE)
        if (window.scene) {
          console.log('🧹 Cleaning scene objects...');
          var objectsToRemove = [];
          
          // Collect all objects to remove (except lights, camera, grid)
          window.scene.traverse(function(child) {
            if (child.isMesh || (child.isGroup && child !== window.scene)) {
              objectsToRemove.push(child);
            }
          });
          
          // Remove and dispose all collected objects
          objectsToRemove.forEach(function(obj) {
            try {
              // Dispose geometry
              if (obj.geometry) {
                obj.geometry.dispose();
              }
              
              // Dispose material(s)
              if (obj.material) {
                if (Array.isArray(obj.material)) {
                  obj.material.forEach(function(mat) {
                    if (mat.dispose) mat.dispose();
                  });
                } else {
                  obj.material.dispose();
                }
              }
              
              // Remove from parent
              if (obj.parent) {
                obj.parent.remove(obj);
              }
            } catch (disposeErr) {
              console.warn('Dispose warning:', disposeErr.message);
            }
          });
          
          console.log('✅ Cleaned ' + objectsToRemove.length + ' objects from scene');
        }
        
        console.log('✅ Soft reset complete. WASM engine preserved. Ready for fresh load.');
        
        // ========================================
        // CONTINUE WITH NORMAL LOAD PROCESS
        // ========================================
        
        // Set loading flag AFTER cleanup
        window.isLoading = true;
        
        if (!window.sceneInitialized) {
          console.warn('Scene not initialized, initializing now...');
          window.sceneInitialized = window.initThreeScene();
          if (!window.sceneInitialized) {
            window.isLoading = false;
            return;
          }
        }
        
        // CRITICAL: Verify WASM is ready AFTER cleanup but BEFORE processing
        if (!window.wasmInitialized || !window.occtInstance) {
          console.error('WASM not ready - wasmInitialized:', window.wasmInitialized, 'occtInstance:', !!window.occtInstance);
          window.isLoading = false;
          window.isProcessing = false;
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'ERROR',message:'WASM engine not ready'}));
          return;
        }
        
        window.loadModel(msg.content, msg.fileType, msg.linearDeflection);
      }
    } catch (e) { console.error('Listener error: ' + e.message); }
  }
  
  window.addEventListener('message', handleMessage);
  document.addEventListener('message', handleMessage);
  console.log('✅ Listener attached');
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LISTENER_READY' }));
})();
`;

  useEffect(() => {
    if (isInitialized.current || !webViewReady || !webViewRef.current) return;
    if (!threeJsCode) { console.error("❌ Missing ThreeJS Prop"); return; }
    isInitialized.current = true;
    console.log("🔐 Initializing...");
    setTimeout(() => { console.log("[1/7] Three.js"); if (threeJsCode && webViewRef.current) webViewRef.current.injectJavaScript(threeJsCode); }, 100);
    setTimeout(() => { console.log("[2/7] OrbitControls"); if (orbitControlsCode && webViewRef.current) webViewRef.current.injectJavaScript(orbitControlsCode); }, 300);
    setTimeout(() => { console.log("[3/7] STLLoader"); if (stlLoaderCode && webViewRef.current) webViewRef.current.injectJavaScript(stlLoaderCode); }, 500);
    setTimeout(() => { console.log("[4/7] OBJLoader"); if (objLoaderCode && webViewRef.current) webViewRef.current.injectJavaScript(objLoaderCode); }, 700);
    setTimeout(() => { console.log("[5/7] GLTFLoader"); if (gltfLoaderCode && webViewRef.current) webViewRef.current.injectJavaScript(gltfLoaderCode); }, 900);
    setTimeout(() => { console.log("[6/7] Listener"); if (webViewRef.current) webViewRef.current.injectJavaScript(msgListenerCode); }, 1100);
    setTimeout(() => { console.log("[7/7] PING"); setLibrariesInjected(true); if (webViewRef.current) webViewRef.current.postMessage(JSON.stringify({ type: 'PING' })); }, 1300);
    setTimeout(() => { console.log("[8/8] Init Scene"); if (webViewRef.current) webViewRef.current.postMessage(JSON.stringify({ type: 'INIT_SCENE' })); }, 1500);
  }, [webViewReady]);

  useEffect(() => {
    if (wasmSent.current || !listenerAttached || !occtWasmBase64 || !webViewRef.current) return;
    wasmSent.current = true;
    console.log("🚀 Sending WASM...");
    const CHUNK_SIZE = 1024 * 1024;
    const totalChunks = Math.ceil(occtWasmBase64.length / CHUNK_SIZE);
    let idx = 0;
    const send = () => {
      if (idx < totalChunks && webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'WASM_CHUNK',
          data: occtWasmBase64.substring(idx * CHUNK_SIZE, Math.min((idx + 1) * CHUNK_SIZE, occtWasmBase64.length)),
          index: idx,
          total: totalChunks
        }));
        console.log(`📤 ${idx + 1}/${totalChunks}`);
        idx++;
        setTimeout(send, 100);
      }
    };
    send();
  }, [listenerAttached, occtWasmBase64]);

  useEffect(() => {
    if (!fileContent || !webViewRef.current || !wasmReady) return;
    console.log(`📤 File (${fileType})`);
    webViewRef.current.postMessage(JSON.stringify({
      type: 'LOAD_FILE',
      content: fileContent,
      fileType: fileType,
      linearDeflection: qualityMode === 'draft' ? 0.5 : 0.1
    }));
  }, [fileContent, fileType, qualityMode, wasmReady]);

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>3D Viewer</title>
  <style>
    body, html, canvas { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #f5f5f5; touch-action: none; }
  </style>
</head>
<body>
  <div id="canvas-container"></div>
  <script src="https://cdn.jsdelivr.net/npm/occt-import-js@0.0.12/dist/occt-import-js.js"></script>
  <script>
    (function() {
      // ========================================
      // GLOBAL HELPER FUNCTIONS (Must be defined first)
      // ========================================
      
      // Create metallic material for STL/OBJ/untextured models
      window.makeMetalMaterial = function() {
        return new THREE.MeshStandardMaterial({
          color: 0xaaaaaa,        // Light Grey
          metalness: 0.7,         // Metallic
          roughness: 0.3,         // Slightly shiny
          envMapIntensity: 1.0
        });
      };
      
      // Save original material state (for reset functionality)
      window.saveOriginalState = function(object) {
        object.traverse(function(child) {
          if (child.isMesh && child.material) {
            // Save original color
            if (child.material.color) {
              child.userData.originalColor = child.material.color.getHex();
            }
            // Save texture reference
            child.userData.originalMap = child.material.map;
            child.userData.hasTexture = !!child.material.map;
            
            // Save other material properties
            if (child.material.metalness !== undefined) {
              child.userData.originalMetalness = child.material.metalness;
            }
            if (child.material.roughness !== undefined) {
              child.userData.originalRoughness = child.material.roughness;
            }
          }
        });
        console.log('💾 Original state saved');
      };
      
      // ========================================
      // CONSOLE LOGGING INTERCEPTION
      // ========================================
      var originalLog = console.log;
      var originalError = console.error;
      function sendLog(type, msg) {
        try {
          var message = typeof msg === 'object' ? JSON.stringify(msg) : String(msg);
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, message: message }));
        } catch (e) {}
      }
      console.log = function() {
        var msg = Array.prototype.slice.call(arguments).join(' ');
        sendLog('LOG', msg);
        originalLog.apply(console, arguments);
      };
      console.error = function() {
        var msg = Array.prototype.slice.call(arguments).join(' ');
        sendLog('ERROR', msg);
        originalError.apply(console, arguments);
      };
      window.onerror = function(msg, source, lineno) { sendLog('ERROR', msg + ' line: ' + lineno); };
      
      var scene, camera, renderer, currentMesh;
      window.initThreeScene = function() {
        if (!window.THREE) {console.error("THREE not loaded!");return false;}
        
        // 🛑 PREVENT DUPLICATES: Find and destroy any existing canvas
        const oldCanvases = document.querySelectorAll('canvas');
        if (oldCanvases.length > 0) {
            console.log("⚠️ [WebView] Removing " + oldCanvases.length + " duplicate canvas(es)");
            oldCanvases.forEach(c => c.remove());
        }
        
        
        scene=new THREE.Scene();
        scene.background=new THREE.Color(0xf5f5f5);
        // scene.fog removed - prevents large models from looking faded/smoky
        window.scene=scene;
        
        camera=new THREE.PerspectiveCamera(60,window.innerWidth/window.innerHeight,0.001,100000);
        camera.position.set(10,10,10);
        camera.lookAt(0,0,0);
        window.camera=camera;
        renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
        
        // ✨ CRITICAL: sRGB color space for proper texture/material rendering (GLTF/GLB)
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        renderer.setClearColor(0xf5f5f5, 1); // Light Grey Background
        renderer.setSize(window.innerWidth,window.innerHeight);renderer.setPixelRatio(window.devicePixelRatio);window.renderer=renderer;
        console.log("🎨 Renderer:"+window.innerWidth+"x"+window.innerHeight);document.body.appendChild(renderer.domElement);
        var canvasCount=document.querySelectorAll('canvas').length;console.log("✅ Canvas added. Total:"+canvasCount);
        var grid=new THREE.GridHelper(200,50,0x444444,0xdcdcdc);scene.add(grid);window.gridHelper=grid;console.log("📐 Grid");
        
        // 💡 ENHANCED LIGHTING for PBR materials (GLTF/GLB models)
        var hemiLight=new THREE.HemisphereLight(0xffffff,0x444444,1.5);
        hemiLight.position.set(0,20,0);
        scene.add(hemiLight);
        console.log("🌅 Hemisphere light added");
        
        var ambientLight=new THREE.AmbientLight(0xffffff,0.7);scene.add(ambientLight);
        var dirLight=new THREE.DirectionalLight(0xffffff,1.0);dirLight.position.set(10,20,10);scene.add(dirLight);
        var backLight=new THREE.DirectionalLight(0xffffff,0.5);backLight.position.set(-10,10,-20);scene.add(backLight);
        console.log("💡 Lighting complete");
        
        if(window.THREE.OrbitControls){window.controls=new THREE.OrbitControls(camera,renderer.domElement);window.controls.enableDamping=true;window.controls.dampingFactor=0.05;window.controls.enableRotate=true;window.controls.enableZoom=true;window.controls.enablePan=true;console.log("🎮 Controls");}else{console.warn("⚠️ OrbitControls not loaded");}
        var frameCount=0;function animate(){requestAnimationFrame(animate);try{if(renderer&&scene&&camera){if(window.controls)window.controls.update();renderer.render(scene,camera);frameCount++;if(frameCount%600===0)console.log("🟢 Frame:"+frameCount);}}catch(e){console.error("Render error:"+e.message);}}
        console.log("🎬 Loop");animate();
        window.addEventListener('resize',function(){camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);});
        console.log("✅ Scene ready");return true;
      };
      window.loadModel=function(fileData,fileType,linearDeflection){
        try{
          console.log("📁 Loading file type: "+fileType+", Size: "+fileData.length);
          
          // Remove previous mesh if exists
          if(currentMesh){
            scene.remove(currentMesh);
            if(currentMesh.geometry)currentMesh.geometry.dispose();
            if(currentMesh.material){
              if(Array.isArray(currentMesh.material)){
                currentMesh.material.forEach(function(m){m.dispose();});
              }else{
                currentMesh.material.dispose();
              }
            }
          }
          
          // ========================================
          // MULTI-FORMAT LOADER
          // ========================================
          
          // A. STEP / IGES - Use WASM OCCT Engine
          if(fileType==='step'||fileType==='stp'||fileType==='iges'||fileType==='igs'){
            console.log('🔧 Using OCCT WASM engine for CAD file...');
            
            if(!window.occtInstance){
              window.isLoading=false;
              window.isProcessing=false;
              throw new Error('OCCT not ready');
            }
            
            var bytes=new Uint8Array(window.atob(fileData).split('').map(function(c){return c.charCodeAt(0);}));
            fileData = null; // Free memory
            console.log('🧹 Base64 data cleared from WebView memory');
            
            console.log("Calling ReadStepFile...");
            var result=window.occtInstance.ReadStepFile(bytes);
            console.log("Meshes:"+result.meshes.length);
            
            if(!result.meshes||result.meshes.length===0){
              console.error("🔴 No meshes!");
              window.isLoading=false;
              window.isProcessing=false;
              window.ReactNativeWebView.postMessage(JSON.stringify({type:'ERROR',message:'No meshes in file'}));
              return;
            }
            
            // Create a group to hold the assembly
            var assemblyGroup = new THREE.Group();
            
            // Iterate through ALL meshes found in the file
            for (var i = 0; i < result.meshes.length; i++) {
                var meshData = result.meshes[i];
                
                // Create Geometry
                var geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.attributes.position.array, 3));
                if (meshData.attributes.normal) {
                    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.attributes.normal.array, 3));
                } else {
                    geometry.computeVertexNormals();
                }
                
                // Add indices if available
                if (meshData.index) {
                    geometry.setIndex(new THREE.Uint16BufferAttribute(meshData.index.array, 1));
                }
                
                // Create Material (Use helper we made earlier)
                var material = window.makeMetalMaterial();
                // Keep original color if available in meshData (optional, OCCT might provide color)
                if (meshData.color) {
                    material.color.setRGB(meshData.color[0], meshData.color[1], meshData.color[2]);
                }
                
                var mesh = new THREE.Mesh(geometry, material);
                
                // Apply name/metadata
                mesh.name = meshData.name || ('Part_' + i);
                mesh.userData.isPart = true;
                
                // Save original state for reset
                window.saveOriginalState(mesh);
                
                // Add to assembly group
                assemblyGroup.add(mesh);
            }
            
            // Center the ENTIRE assembly, not individual parts
            var box = new THREE.Box3().setFromObject(assemblyGroup);
            var center = box.getCenter(new THREE.Vector3());
            assemblyGroup.position.sub(center); // Move group so center is at 0,0,0
            
            // Apply scale to the entire assembly
            assemblyGroup.scale.set(0.1, 0.1, 0.1);
            
            // Add Group to Scene
            scene.add(assemblyGroup);
            currentMesh = assemblyGroup;
            console.log("🟢 STEP/IGES Assembly added with " + result.meshes.length + " parts");
            
            // Send success message
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'PARTS_LOADED',
                count: result.meshes.length,
                structure: result.meshes.map(function(m, idx) { return { id: idx, name: m.name || 'Part ' + idx }; })
            }));
            
            finalizeMeshLoad(assemblyGroup);
          }
          
          // B. STL - Use STLLoader
          else if(fileType==='stl'){
            console.log('📐 Using STLLoader...');
            
            if(!window.THREE.STLLoader){
              window.isLoading=false;
              window.isProcessing=false;
              throw new Error('STLLoader not available');
            }
            
            var bytes=new Uint8Array(window.atob(fileData).split('').map(function(c){return c.charCodeAt(0);}));
            fileData = null; // Free memory
            console.log('🧹 Base64 data cleared');
            
            var loader=new THREE.STLLoader();
            var geometry=loader.parse(bytes.buffer);
            geometry.computeBoundingBox();
            geometry.center();
            console.log("🟢 STL Centered");
            
            // Apply metallic material (STL has no color data)
            var material=makeMetalMaterial();
            var mesh=new THREE.Mesh(geometry,material);
            scene.add(mesh);
            currentMesh=mesh;
            console.log("🟢 STL Mesh added with metallic material");
            
            // Save original state for reset functionality
            saveOriginalState(mesh);
            
            finalizeMeshLoad(mesh);
          }
          
          // C. OBJ - Use OBJLoader
          else if(fileType==='obj'){
            console.log('🎨 Using OBJLoader...');
            
            if(!window.THREE.OBJLoader){
              window.isLoading=false;
              window.isProcessing=false;
              throw new Error('OBJLoader not available');
            }
            
            var bytes=new Uint8Array(window.atob(fileData).split('').map(function(c){return c.charCodeAt(0);}));
            fileData = null; // Free memory
            console.log('🧹 Base64 data cleared');
            
            var text=new TextDecoder().decode(bytes);
            var loader=new THREE.OBJLoader();
            var group=loader.parse(text);
            
            // Center the group
            var box=new THREE.Box3().setFromObject(group);
            var center=box.getCenter(new THREE.Vector3());
            group.position.sub(center);
            console.log("🟢 OBJ Centered");
            
            // Apply metallic material to all meshes in the group (OBJ has no material data)
            group.traverse(function(child){
              if(child.isMesh){
                child.material=makeMetalMaterial();
              }
            });
            console.log("🟢 OBJ materials applied");
            
            scene.add(group);
            currentMesh=group;
            console.log("🟢 OBJ Group added");
            
            // Save original state for reset functionality
            saveOriginalState(group);
            
            finalizeMeshLoad(group);
          }
          
          // D. GLTF / GLB - Use GLTFLoader
          else if(fileType==='gltf'||fileType==='glb'){
            console.log('🌐 Using GLTFLoader...');
            
            if(!window.THREE.GLTFLoader){
              window.isLoading=false;
              window.isProcessing=false;
              throw new Error('GLTFLoader not available');
            }
            
            var bytes=new Uint8Array(window.atob(fileData).split('').map(function(c){return c.charCodeAt(0);}));
            fileData = null; // Free memory
            console.log('🧹 Base64 data cleared');
            
            var loader=new THREE.GLTFLoader();
            loader.parse(bytes.buffer,'',function(gltf){
              var model=gltf.scene;
              
              // Center the model
              var box=new THREE.Box3().setFromObject(model);
              var center=box.getCenter(new THREE.Vector3());
              model.position.sub(center);
              console.log("🟢 GLTF Centered");
              
              // ✨ ENHANCE MATERIALS: Fix visibility, lighting, texture quality
              model.traverse(function(child){
                if(child.isMesh){
                  // Enable shadows for proper lighting
                  child.castShadow=true;
                  child.receiveShadow=true;
                  
                  // Improve texture quality (anisotropic filtering)
                  if(child.material){
                    if(child.material.map){
                      child.material.map.anisotropy=16;
                    }
                    // Ensure material renders correctly
                    child.material.needsUpdate=true;
                  }
                }
              });
              console.log("✨ GLTF materials enhanced");
              
              scene.add(model);
              currentMesh=model;
              console.log("🟢 GLTF Scene added");
              
              // Save original state for reset functionality (preserves textures)
              saveOriginalState(model);
              
              finalizeMeshLoad(model);
            },function(error){
              console.error('GLTF parse error:',error);
              window.isLoading=false;
              window.isProcessing=false;
              window.ReactNativeWebView.postMessage(JSON.stringify({type:'ERROR',message:'GLTF parse failed: '+error}));
            });
          }
          
          else{
            window.isLoading=false;
            window.isProcessing=false;
            throw new Error('Unsupported file type: '+fileType);
          }
          
        }catch(err){
          console.error('Load error:'+err.message);
          window.isLoading=false;
          window.isProcessing=false;
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'ERROR',message:err.message}));
        }
      };
      
      // Shared finalization function for all loaders
      function finalizeMeshLoad(mesh){
        try{
          // Collect objects for Parts List
          var objectList=[];
          mesh.traverse(function(child){
            if(child.isMesh){
              var colorHex='555555';
              if(child.material&&child.material.color){
                colorHex=child.material.color.getHexString();
              }
              objectList.push({
                id:child.uuid,
                name:child.name||'Part',
                visible:child.visible,
                color:'#'+colorHex
              });
            }
          });
          console.log("📦 Parts found: "+objectList.length);
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'PARTS_LOADED',data:objectList}));
          
          // Reset camera
          camera.position.set(0,10,20);
          camera.lookAt(0,0,0);
          if(window.controls){
            window.controls.target.set(0,0,0);
            window.controls.update();
          }
          console.log("📷 Camera reset");
          
          // Reset flags
          window.isLoading=false;
          window.isProcessing=false;
          
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'SUCCESS',data:{loaded:true}}));
        }catch(finalizeErr){
          console.error('Finalize error:'+finalizeErr.message);
          window.isLoading=false;
          window.isProcessing=false;
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'ERROR',message:'Finalize failed: '+finalizeErr.message}));
        }
      }
      
      window.addEventListener('load',function(){console.log("Page loaded");window.ReactNativeWebView.postMessage(JSON.stringify({type:'READY_FOR_WASM'}));});
    })();
  </script>
</body>
</html>`;

  // Auto-hide status badge after 2 seconds for success states
  useEffect(() => {
    // Clear any existing timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    // Reset opacity to visible when status changes
    statusOpacity.setValue(1);

    // Auto-hide for success states
    if (engineStatus.includes('Engine Ready') || engineStatus.includes('Model Loaded')) {
      hideTimeoutRef.current = setTimeout(() => {
        Animated.timing(statusOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 2000);
    }

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [engineStatus]);

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'LOG') { console.log("🟢 [WebView]:", data.message); return; }
      if (data.type === 'ERROR') { console.error("🔴 [WebView]:", data.message); return; }
      if (data.type === 'READY_FOR_WASM') { console.log("📡 WebView loaded"); setWebViewReady(true); setEngineStatus('🟡 Loading libraries...'); }
      if (data.type === 'LISTENER_READY') { console.log("🎧 Listener attached"); setEngineStatus('🟡 Preparing WASM...'); }
      if (data.type === 'PONG') { console.log("🏓 PONG received"); setListenerAttached(true); setEngineStatus('🟡 Sending WASM...'); }
      if (data.type === 'SCENE_READY') { console.log("✅ Scene initialized at startup"); setEngineStatus('🟢 Scene Ready'); }
      if (data.type === 'WASM_READY') { console.log("✅✅✅ WASM READY!"); setWasmReady(true); setEngineStatus('🟢 Engine Ready'); }
      if (data.type === 'PARTS_LOADED') { console.log("📦 Parts loaded:", data.data && data.data.length ? data.data.length : 0); onModelLoaded(data.data); }
      if (data.type === 'SUCCESS') { console.log("✅ Model loaded"); setEngineStatus('🟢 Model Loaded'); }
      if (data.type === 'ERROR') { console.error("❌ Error:", data.message); setEngineStatus('🔴 Error: ' + data.message); onError(data.message); }
      if (data.type === 'EXPORT_DATA') { console.log("📤 Export data received"); if (onExportData) onExportData(data); }
    } catch (err) { console.error("Parse error:", err, "Raw Data:", event.nativeEvent.data); setEngineStatus('🔴 Parse Error'); }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        originWhitelist={['*']}
        mixedContentMode="always"
        allowFileAccess={true}
        style={styles.webview}
      />
      <Animated.View
        style={[styles.statusContainer, { opacity: statusOpacity }]}
        pointerEvents="none"
      >
        <Text style={styles.statusText}>{engineStatus}</Text>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  webview: { flex: 1, backgroundColor: 'transparent', opacity: 0.99 },
  statusContainer: { position: 'absolute', top: 10, left: 0, right: 0, alignItems: 'center', zIndex: 30 },
  statusText: { backgroundColor: 'rgba(0, 0, 0, 0.7)', color: 'white', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, fontSize: 12, fontWeight: '600' },
});

export default StepLoader;
