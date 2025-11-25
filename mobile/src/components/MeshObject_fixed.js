import React, { useRef, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { Canvas, useLoader, useThree, useFrame } from "@react-three/fiber/native";
import { Orbit Controls, Grid } from "@react-three/drei/native";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader";
import Gizmo from "./Gizmo";
import ViewSelector from "./ViewSelector";

const MeshObject = ({
    url,
    id,
    isSelected,
    onSelect,
    onLongPress,
    position,
    rotation,
    color,
    visible,
    showEdges,
    setRef,
    viewMode,
}) => {
    // Detect file type
    const fileType = useMemo(() => {
        const urlLower = url.toLowerCase();
        if (urlLower.endsWith('.obj')) return 'obj';
        if (urlLower.endsWith('.ply')) return 'ply';
        return 'stl';
    }, [url]);

    // Load the file
    const loadedData = useLoader(
        fileType === 'obj' ? OBJLoader :
            fileType === 'ply' ? PLYLoader :
                STLLoader,
        url
    );

    // Prepare for rendering
    const meshData = useMemo(() => {
        if (fileType === 'obj') {
            // OBJ files can have multiple parts - use the whole group
            return { type: 'obj', group: loadedData };
        } else {
            // STL/PLY return geometry directly
            return { type: 'geometry', geometry: loadedData };
        }
    }, [loadedData, fileType]);

    const meshRef = useRef();
    const timerRef = useRef(null);

    // Center the model
    useMemo(() => {
        if (meshData.type === 'geometry' && meshData.geometry) {
            meshData.geometry.center();
        } else if (meshData.type === 'obj' && meshData.group) {
            const box = new THREE.Box3().setFromObject(meshData.group);
            const center = box.getCenter(new THREE.Vector3());
            meshData.group.position.sub(center);
        }
    }, [meshData]);

    useEffect(() => {
        if (meshRef.current) {
            setRef(id, meshRef.current);
        }
    }, [id, setRef]);

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

    const handlePointerDown = () => {
        timerRef.current = setTimeout(() => {
            onLongPress(id);
        }, 500);
    };

    const handlePointerUp = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const handlePress = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
            onSelect(id);
        }
    };

    if (!visible) return null;

    // Render OBJ as primitive (includes all parts)
    if (meshData.type === 'obj') {
        return (
            <primitive
                ref={meshRef}
                object={meshData.group.clone()}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onClick={handlePress}
            />
        );
    }

    //  Render STL/PLY as mesh
    return (
        <>
            <mesh
                ref={meshRef}
                geometry={meshData.geometry}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onClick={handlePress}
            >
                {viewMode === "shaded" && <meshStandardMaterial color={color} />}
                {viewMode === "edges" && (
                    <>
                        <meshStandardMaterial color={color} />
                        <lineSegments>
                            <edgesGeometry args={[meshData.geometry]} />
                            <lineBasicMaterial color="#000000" />
                        </lineSegments>
                    </>
                )}
                {viewMode === "wireframe" && (
                    <meshBasicMaterial color={color} wireframe />
                )}
            </mesh>
        </>
    );
};
