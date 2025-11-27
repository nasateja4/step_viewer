import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { WebView } from 'react-native-webview';

const StepLoader = ({
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
  onError
}) => {
  const webViewRef = useRef(null);
  const isInitialized = useRef(false);
  const wasmSent = useRef(false);

  const [webViewReady, setWebViewReady] = useState(false);
  const [librariesInjected, setLibrariesInjected] = useState(false);
  const [listenerAttached, setListenerAttached] = useState(false);
  const [wasmReady, setWasmReady] = useState(false);
  const [engineStatus, setEngineStatus] = useState('🔴 Initializing...');

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
      
      if (msg.type === 'LOAD_FILE') {
        if (!window.sceneInitialized) {
          window.sceneInitialized = window.initThreeScene();
          if (!window.sceneInitialized) return;
        }
        if (!window.wasmInitialized) { console.error('WASM not ready'); return; }
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
        
        scene=new THREE.Scene();scene.background=new THREE.Color(0xf5f5f5);scene.fog=new THREE.Fog(0xf5f5f5,20,100);
        camera=new THREE.PerspectiveCamera(60,window.innerWidth/window.innerHeight,0.001,100000);camera.position.set(10,10,10);camera.lookAt(0,0,0);
        renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
        renderer.setClearColor(0xf5f5f5, 1); // Light Grey Background
        renderer.setSize(window.innerWidth,window.innerHeight);renderer.setPixelRatio(window.devicePixelRatio);
        console.log("🎨 Renderer:"+window.innerWidth+"x"+window.innerHeight);document.body.appendChild(renderer.domElement);
        var canvasCount=document.querySelectorAll('canvas').length;console.log("✅ Canvas added. Total:"+canvasCount);
        var grid=new THREE.GridHelper(200,50,0x444444,0xdcdcdc);scene.add(grid);console.log("📐 Grid");
        var ambientLight=new THREE.AmbientLight(0xffffff,0.7);scene.add(ambientLight);
        var dirLight=new THREE.DirectionalLight(0xffffff,1.0);dirLight.position.set(10,20,10);scene.add(dirLight);
        var backLight=new THREE.DirectionalLight(0xffffff,0.5);backLight.position.set(-10,10,-20);scene.add(backLight);
        console.log("💡 Lighting");
        if(window.THREE.OrbitControls){window.controls=new THREE.OrbitControls(camera,renderer.domElement);window.controls.enableDamping=true;window.controls.dampingFactor=0.05;window.controls.enableRotate=true;window.controls.enableZoom=true;window.controls.enablePan=true;console.log("🎮 Controls");}else{console.warn("⚠️ OrbitControls not loaded");}
        var frameCount=0;function animate(){requestAnimationFrame(animate);try{if(renderer&&scene&&camera){if(window.controls)window.controls.update();renderer.render(scene,camera);frameCount++;if(frameCount%600===0)console.log("🟢 Frame:"+frameCount);}}catch(e){console.error("Render error:"+e.message);}}
        console.log("🎬 Loop");animate();
        window.addEventListener('resize',function(){camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);});
        console.log("✅ Scene ready");return true;
      };
      window.loadModel=function(fileData,fileType,linearDeflection){
        try{
          console.log("File:"+fileData.length);if(currentMesh)scene.remove(currentMesh);
          if(fileType==='step'||fileType==='stp'){
            if(!window.occtInstance)throw new Error('OCCT not ready');
            var bytes=new Uint8Array(window.atob(fileData).split('').map(function(c){return c.charCodeAt(0);}));
            console.log("Calling ReadStepFile...");var result=window.occtInstance.ReadStepFile(bytes);console.log("Meshes:"+result.meshes.length);
            if(!result.meshes||result.meshes.length===0){console.error("🔴 No meshes!");return;}
            var meshData=result.meshes[0];var positions=meshData.attributes.position.array;var indices=meshData.index?meshData.index.array:null;
            console.log(" Vertices:"+positions.length);if(indices)console.log("🟢 Indices:"+indices.length);
            if(positions.length===0){console.error("🔴 0 vertices!");return;}
            var geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
            if(indices)geometry.setIndex(new THREE.Uint16BufferAttribute(indices,1));
            if(meshData.attributes.normal)geometry.setAttribute('normal',new THREE.Float32BufferAttribute(meshData.attributes.normal.array,3));else geometry.computeVertexNormals();
            geometry.computeBoundingBox();geometry.center();console.log("🟢 Centered");
            var material=new THREE.MeshStandardMaterial({color:0x555555,metalness:0.6,roughness:0.2,side:THREE.DoubleSide});
            var mesh=new THREE.Mesh(geometry,material);
            mesh.scale.set(0.1,0.1,0.1);
            scene.add(mesh);currentMesh=mesh;console.log("🟢 Mesh added");
            camera.position.set(0,10,20);camera.lookAt(0,0,0);
            if(window.controls){window.controls.target.set(0,0,0);window.controls.update();}
            console.log("🟢 Camera fixed to Safe Mode: "+camera.position.x+","+camera.position.y+","+camera.position.z);
            window.ReactNativeWebView.postMessage(JSON.stringify({type:'SUCCESS',data:{loaded:true}}));
          }
        }catch(err){console.error('Load error:'+err.message);window.ReactNativeWebView.postMessage(JSON.stringify({type:'ERROR',message:err.message}));}
      };
      window.addEventListener('load',function(){console.log("Page loaded");window.ReactNativeWebView.postMessage(JSON.stringify({type:'READY_FOR_WASM'}));});
    })();
  </script>
</body>
</html>`;

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'LOG') { console.log("🟢 [WebView]:", data.message); return; }
      if (data.type === 'ERROR') { console.error("🔴 [WebView]:", data.message); return; }
      if (data.type === 'READY_FOR_WASM') { console.log("📡 WebView loaded"); setWebViewReady(true); setEngineStatus('🟡 Loading libraries...'); }
      if (data.type === 'LISTENER_READY') { console.log("🎧 Listener attached"); setEngineStatus('🟡 Preparing WASM...'); }
      if (data.type === 'PONG') { console.log("🏓 PONG received"); setListenerAttached(true); setEngineStatus('🟡 Sending WASM...'); }
      if (data.type === 'WASM_READY') { console.log("✅✅✅ WASM READY!"); setWasmReady(true); setEngineStatus('🟢 Engine Ready'); }
      if (data.type === 'SUCCESS') { console.log("✅ Model loaded"); setEngineStatus('🟢 Model Loaded'); onModelLoaded(data.data); }
      if (data.type === 'ERROR') { console.error("❌ Error:", data.message); setEngineStatus('🔴 Error: ' + data.message); onError(data.message); }
    } catch (err) { console.error("Parse error:", err); setEngineStatus('🔴 Parse Error'); }
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
      <View style={styles.statusContainer} pointerEvents="none">
        <Text style={styles.statusText}>{engineStatus}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  webview: { flex: 1, backgroundColor: 'transparent', opacity: 0.99 },
  statusContainer: { position: 'absolute', top: 10, left: 0, right: 0, alignItems: 'center', zIndex: 30 },
  statusText: { backgroundColor: 'rgba(0, 0, 0, 0.7)', color: 'white', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, fontSize: 12, fontWeight: '600' },
});

export default StepLoader;
