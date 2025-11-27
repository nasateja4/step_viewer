import React, { useRef, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { Canvas, useLoader, useThree, useFrame } from "@react-three/fiber/native";
import { OrbitControls, Grid } from "@react-three/drei/native";
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
    rawMesh,
}) => {
    // Detect file type
    const fileType = useMemo(() => {
        if (rawMesh) return 'custom';
        const urlLower = url.toLowerCase();
        if (urlLower.endsWith('.obj')) return 'obj';
        if (urlLower.endsWith('.ply')) return 'ply';
        return 'stl';
    }, [url, rawMesh]);

    // Load the file
    const loadedData = useLoader(
        fileType === 'obj' ? OBJLoader :
            fileType === 'ply' ? PLYLoader :
                fileType === 'custom' ? () => null : // Dummy loader for custom
                    STLLoader,
        fileType === 'custom' ? null : url
    );

    // Prepare for rendering
    const meshData = useMemo(() => {
        if (fileType === 'custom') {
            // rawMesh is expected to be an array of mesh objects from occt-import-js
            // or a single mesh object.
            // Structure: { attributes: { position: { array: [] }, normal: { array: [] } }, index: { array: [] } }

            if (!rawMesh) return null;

            let meshes = [];
            if (rawMesh.meshes) {
                meshes = rawMesh.meshes;
            } else if (Array.isArray(rawMesh)) {
                meshes = rawMesh;
            } else {
                meshes = [rawMesh];
            }

            const group = new THREE.Group();

            meshes.forEach((meshData) => {
                const geometry = new THREE.BufferGeometry();
                if (meshData.attributes.position) {
                    geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.attributes.position.array, 3));
                }
                if (meshData.attributes.normal) {
                    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.attributes.normal.array, 3));
                }
                if (meshData.index) {
                    geometry.setIndex(Array.from(meshData.index.array));
                }

                const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color }));
                group.add(mesh);
            });

            return { type: 'obj', group }; // Treat as group like OBJ
        } else if (fileType === 'obj') {
            // OBJ files can have multiple parts - use the whole group
            return { type: 'obj', group: loadedData };
        } else {
            // STL/PLY return geometry directly
            return { type: 'geometry', geometry: loadedData };
        }
    }, [loadedData, fileType, rawMesh, color]);

    const meshRef = useRef();
    const timerRef = useRef(null);
    const centeredRef = useRef(false);

    // Center the model only once when first loaded
    useMemo(() => {
        // Only center if we haven't centered this mesh before
        if (!centeredRef.current) {
            if (meshData.type === 'geometry' && meshData.geometry) {
                meshData.geometry.center();
            } else if (meshData.type === 'obj' && meshData.group) {
                const box = new THREE.Box3().setFromObject(meshData.group);
                const center = box.getCenter(new THREE.Vector3());
                meshData.group.position.sub(center);
            }
            centeredRef.current = true;
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

    // Render OBJ as group with proper materials
    if (meshData.type === 'obj') {
        return (
            <group
                ref={meshRef}
                visible={visible}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onClick={handlePress}
            >
                {meshData.group.children.map((child, index) => {
                    if (!child.geometry) return null;

                    return (
                        <mesh key={index} geometry={child.geometry}>
                            {viewMode === "shaded" && <meshStandardMaterial color={color} />}
                            {viewMode === "edges" && (
                                <>
                                    <meshStandardMaterial color={color} />
                                    <lineSegments>
                                        <edgesGeometry args={[child.geometry]} />
                                        <lineBasicMaterial color="#000000" />
                                    </lineSegments>
                                </>
                            )}
                            {viewMode === "wireframe" && (
                                <meshBasicMaterial color={color} wireframe />
                            )}
                        </mesh>
                    );
                })}
            </group>
        );
    }

    // Render STL/PLY as mesh
    return (
        <>
            <mesh
                ref={meshRef}
                geometry={meshData.geometry}
                visible={visible}
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

const ZoomToFit = ({ objects, meshRefs, controlsRef, onBoundsCalculated, enabled = true }) => {
    const { camera, size: canvasSize } = useThree();
    const [isFirstLoad, setIsFirstLoad] = useState(true);

    useEffect(() => {
        // Don't run if disabled or if camera is transitioning from view selector
        if (!enabled) return;

        if (objects.length === 0) {
            onBoundsCalculated && onBoundsCalculated(null);
            return;
        }

        const timer = setTimeout(() => {
            const box = new THREE.Box3();
            let hasObjects = false;

            Object.values(meshRefs.current).forEach((mesh) => {
                if (mesh) {
                    box.expandByObject(mesh);
                    hasObjects = true;
                }
            });

            if (!hasObjects) return;

            if (onBoundsCalculated) {
                onBoundsCalculated(box.clone());
            }

            const center = new THREE.Vector3();
            box.getCenter(center);

            // Get the actual bounding box dimensions
            const size = new THREE.Vector3();
            box.getSize(size);

            // Calculate camera distance based on actual box dimensions
            const fov = camera.fov * (Math.PI / 180);
            const aspect = canvasSize.width / canvasSize.height;

            // For elongated objects, we need to fit both width and height
            // Calculate the distance needed to fit the HEIGHT of the model
            const maxDimension = Math.max(size.x, size.y, size.z);
            const fovVertical = fov;
            const fovHorizontal = 2 * Math.atan(Math.tan(fov / 2) * aspect);

            // Calculate distance to fit width and height separately
            const distanceForHeight = (maxDimension / 2) / Math.tan(fovVertical / 2);
            const distanceForWidth = (maxDimension / 2) / Math.tan(fovHorizontal / 2);

            // Use the larger distance to ensure everything fits
            let cameraZ = Math.max(distanceForHeight, distanceForWidth);

            // Add generous padding (150% extra) to ensure full model visibility with breathing room
            cameraZ *= 2.5;
            cameraZ = Math.max(cameraZ, 10);

            // Dynamically set camera clipping planes based on model size
            const modelSize = maxDimension;
            camera.near = Math.max(0.01, modelSize * 0.0001);
            camera.far = Math.max(cameraZ * 20, modelSize * 200);
            camera.updateProjectionMatrix();

            let direction = new THREE.Vector3();

            if (isFirstLoad) {
                direction.set(1, 1, 1).normalize();
                setIsFirstLoad(false);
            } else {
                direction.subVectors(camera.position, center).normalize();
                if (direction.lengthSq() === 0) {
                    direction.set(1, 1, 1).normalize();
                }
            }

            const newPos = direction.multiplyScalar(cameraZ).add(center);

            camera.position.copy(newPos);
            camera.lookAt(center);

            if (controlsRef.current) {
                controlsRef.current.target.copy(center);
                controlsRef.current.update();
            }
        }, 200);

        return () => clearTimeout(timer);
    }, [objects, camera, meshRefs, controlsRef, canvasSize, isFirstLoad, enabled, onBoundsCalculated]);

    return null;
};

const CameraTransition = ({ controlsRef, targetPosition, targetLookAt, onComplete }) => {
    useFrame((state, delta) => {
        if (!controlsRef.current) return;

        const camera = controlsRef.current.object;
        const currentPos = camera.position;
        const currentTarget = controlsRef.current.target;

        const speed = 3 * delta;

        currentPos.lerp(targetPosition, speed);
        currentTarget.lerp(targetLookAt, speed);

        controlsRef.current.update();

        if (currentPos.distanceTo(targetPosition) < 0.5 && currentTarget.distanceTo(targetLookAt) < 0.5) {
            camera.position.copy(targetPosition);
            controlsRef.current.target.copy(targetLookAt);
            controlsRef.current.update();
            // Add small delay before calling onComplete to prevent ZoomToFit from interfering
            setTimeout(() => onComplete(), 500);
        }
    });
    return null;
};

const Viewer = ({
    objects,
    selectedId,
    onSelect,
    onUpdateObject,
    zoomCmd,
    matingCmd,
    onMatingComplete,
    panMode,
    theme,
    viewMode,
    showGrid,
    showViewSelector,
    showOrigin,
    onViewSelect,
}) => {
    const controlsRef = useRef();
    const meshRefs = useRef({});
    const [transformMode, setTransformMode] = useState(false);
    const [cameraTarget, setCameraTarget] = useState(null);
    const [sceneBounds, setSceneBounds] = useState(null);

    // Layout state for absolute positioning
    const viewRef = useRef();
    const [layout, setLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [viewSelectorUsed, setViewSelectorUsed] = useState(false);

    const setRef = (id, ref) => {
        meshRefs.current[id] = ref;
    };

    const handleLongPress = (id) => {
        onSelect(id);
        setTransformMode(true);
    };

    // Handle Zoom Command
    useEffect(() => {
        if (!zoomCmd || !controlsRef.current) return;

        const SCALE_FACTOR = 1.2;

        if (zoomCmd.type === "in") {
            controlsRef.current.dollyIn(SCALE_FACTOR);
        } else if (zoomCmd.type === "out") {
            controlsRef.current.dollyOut(SCALE_FACTOR);
        }
        controlsRef.current.update();
    }, [zoomCmd]);

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
            const targetMaxZ = targetBox.max.z;
            const sourceMinZ = sourceBox.min.z;
            const diffZ = targetMaxZ - sourceMinZ + (offset || 0);
            newPos[2] += diffZ;
        }

        onMatingComplete(sourceId, newPos);
    }, [matingCmd, onMatingComplete]);

    const isDark = theme === "dark";

    // Focus on selected object
    useEffect(() => {
        if (selectedId && meshRefs.current[selectedId] && controlsRef.current) {
            const mesh = meshRefs.current[selectedId];
            // Update control target to look at the selected object
            controlsRef.current.target.copy(mesh.position);
            controlsRef.current.update();
        }
    }, [selectedId]);

    // Reset transform mode when selection changes
    useEffect(() => {
        if (!selectedId) {
            setTransformMode(false);
        }
    }, [selectedId]);

    const DomElementPatcher = ({ layout }) => {
        const { gl } = useThree();
        useEffect(() => {
            if (gl.domElement) {
                gl.domElement.getBoundingClientRect = () => ({
                    left: layout.x,
                    top: layout.y,
                    width: layout.width,
                    height: layout.height,
                    right: layout.x + layout.width,
                    bottom: layout.y + layout.height,
                    x: layout.x,
                    y: layout.y,
                });
            }
            // Also patch ownerDocument if missing
            if (gl.domElement && !gl.domElement.ownerDocument) {
                gl.domElement.ownerDocument = {
                    addEventListener: () => { },
                    removeEventListener: () => { },
                };
            }
        }, [gl, layout]);
        return null;
    };

    const handleLayout = () => {
        if (viewRef.current) {
            viewRef.current.measureInWindow((x, y, width, height) => {
                setLayout({ x, y, width, height });
            });
        }
    };


};

export default Viewer;
