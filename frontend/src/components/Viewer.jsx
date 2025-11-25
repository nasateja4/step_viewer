import React, { useRef, useEffect, useMemo, useState } from "react";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Grid,
  GizmoHelper,
  GizmoViewport,
} from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";

const MeshObject = ({
  url,
  id,
  isSelected,
  onSelect,
  position,
  rotation,
  color,
  visible,
  showEdges,
  setRef,
}) => {
  const mesh = useLoader(STLLoader, url);
  const meshRef = useRef();

  useEffect(() => {
    if (meshRef.current) {
      setRef(id, meshRef.current);
    }
  }, [id, setRef]);

  // Apply transforms
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.position.set(...position);
      meshRef.current.rotation.set(
        THREE.MathUtils.degToRad(rotation[0]),
        THREE.MathUtils.degToRad(rotation[1]),
        THREE.MathUtils.degToRad(rotation[2])
      );
    }
  }, [position, rotation]);

  // Material
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: isSelected ? "#3b82f6" : color || "#cccccc",
      metalness: 0.2,
      roughness: 0.5,
    });
  }, [isSelected, color]);

  return (
    <group>
      {visible && (
        <mesh
          ref={meshRef}
          geometry={mesh}
          material={material}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(id);
          }}
        >
          {showEdges && (
            <lineSegments>
              <edgesGeometry args={[mesh, 30]} />
              <lineBasicMaterial color="black" linewidth={2} />
            </lineSegments>
          )}
        </mesh>
      )}
    </group>
  );
};

const SceneContent = ({
  objects,
  selectedId,
  onSelect,
  matingCmd,
  onMatingComplete,
}) => {
  const { camera } = useThree();
  const meshRefs = useRef({});

  const setRef = (id, ref) => {
    meshRefs.current[id] = ref;
  };

  // Initial camera setup
  useEffect(() => {
    camera.position.set(100, 100, 100);
    camera.lookAt(0, 0, 0);
  }, []);

  // Handle Mating
  useEffect(() => {
    if (!matingCmd) return;

    const { type, sourceId, targetId, offset } = matingCmd;
    const sourceMesh = meshRefs.current[sourceId];
    const targetMesh = meshRefs.current[targetId];

    if (!sourceMesh || !targetMesh) return;

    // Ensure world matrices are up to date
    sourceMesh.updateMatrixWorld();
    targetMesh.updateMatrixWorld();

    const sourceBox = new THREE.Box3().setFromObject(sourceMesh);
    const targetBox = new THREE.Box3().setFromObject(targetMesh);

    const sCenter = new THREE.Vector3();
    sourceBox.getCenter(sCenter);
    const tCenter = new THREE.Vector3();
    targetBox.getCenter(tCenter);

    const currentPos = sourceMesh.position.clone();
    let newPos = [currentPos.x, currentPos.y, currentPos.z];

    if (type === "concentric") {
      // Align X and Y centers
      const diffX = tCenter.x - sCenter.x;
      const diffY = tCenter.y - sCenter.y;
      newPos[0] += diffX;
      newPos[1] += diffY;
    } else if (type === "coincident") {
      // Snap Bottom (min Z) of Source to Top (max Z) of Target
      // Note: Box3 is world aligned.
      const targetMaxZ = targetBox.max.z;
      const sourceMinZ = sourceBox.min.z;
      const diffZ = targetMaxZ - sourceMinZ + (offset || 0);
      newPos[2] += diffZ;
    }

    onMatingComplete(sourceId, newPos);
  }, [matingCmd, onMatingComplete]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[100, 100, 100]} intensity={1} />
      <pointLight position={[-100, -100, -100]} intensity={0.5} />

      <Grid
        infiniteGrid
        fadeDistance={500}
        sectionColor="#444"
        cellColor="#222"
      />

      {objects.map((obj) => (
        <MeshObject
          key={obj.id}
          {...obj}
          isSelected={obj.id === selectedId}
          onSelect={onSelect}
          setRef={setRef}
        />
      ))}

      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport
          axisColors={["#9d4b4b", "#2f7f4f", "#3b5b9d"]}
          labelColor="white"
        />
      </GizmoHelper>

      <OrbitControls makeDefault />
    </>
  );
};

const Viewer = ({
  objects,
  selectedId,
  onSelect,
  matingCmd,
  onMatingComplete,
}) => {
  return (
    <div style={{ width: "100%", height: "100%", backgroundColor: "#1a1a1a" }}>
      <Canvas shadows dpr={[1, 2]}>
        <SceneContent
          objects={objects}
          selectedId={selectedId}
          onSelect={onSelect}
          matingCmd={matingCmd}
          onMatingComplete={onMatingComplete}
        />
      </Canvas>
    </div>
  );
};

export default Viewer;
