import React, { useState, useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';

const Axis = ({ color, rotation, axis, onStart }) => (
    <group rotation={rotation}>
        {/* Visual Shaft */}
        <mesh position={[0, 2.0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 4.0, 12]} />
            <meshStandardMaterial color={color} />
        </mesh>
        {/* Visual Head */}
        <mesh position={[0, 4.6, 0]}>
            <coneGeometry args={[0.5, 1.2, 12]} />
            <meshStandardMaterial color={color} />
        </mesh>
        {/* Hit Box (Larger) */}
        <mesh
            position={[0, 2.5, 0]}
            visible={false}
            onPointerDown={(e) => {
                e.stopPropagation();
                onStart(e, axis);
            }}
        >
            <cylinderGeometry args={[1.0, 1.0, 6.0, 8]} />
        </mesh>
    </group>
);

const Gizmo = ({ position, onUpdate, onDragStart, onDragEnd }) => {
    const { camera, raycaster, pointer } = useThree();
    const [activeAxis, setActiveAxis] = useState(null);
    const [startPoint, setStartPoint] = useState(new THREE.Vector3());
    const [startObjPos, setStartObjPos] = useState(new THREE.Vector3());
    const [localPosition, setLocalPosition] = useState(position);

    // Plane for raycasting
    const plane = useMemo(() => new THREE.Plane(), []);
    const intersection = useMemo(() => new THREE.Vector3(), []);
    const planeMeshRef = useRef();

    const handlePointerDown = (e, axis) => {
        setActiveAxis(axis);
        onDragStart();

        const currentPos = new THREE.Vector3(...position);
        setStartObjPos(currentPos);

        // Setup plane normal to camera
        const normal = new THREE.Vector3();
        camera.getWorldDirection(normal).negate();
        plane.setFromNormalAndCoplanarPoint(normal, currentPos);

        // Calculate start intersection
        raycaster.setFromCamera(pointer, camera);
        raycaster.ray.intersectPlane(plane, intersection);
        setStartPoint(intersection.clone());
    };

    const handlePointerMove = (e) => {
        if (!activeAxis) return;
        e.stopPropagation();

        raycaster.setFromCamera(pointer, camera);
        if (raycaster.ray.intersectPlane(plane, intersection)) {
            const delta = intersection.clone().sub(startPoint);

            const axisVec = new THREE.Vector3();
            if (activeAxis === 'x') axisVec.set(1, 0, 0);
            if (activeAxis === 'y') axisVec.set(0, 1, 0);
            if (activeAxis === 'z') axisVec.set(0, 0, 1);

            // Project delta onto axis
            const projectedDelta = axisVec.clone().multiplyScalar(delta.dot(axisVec));
            const newPos = startObjPos.clone().add(projectedDelta);

            // Update local position immediately for responsive gizmo
            setLocalPosition([newPos.x, newPos.y, newPos.z]);
            onUpdate([newPos.x, newPos.y, newPos.z]);
        }
    };

    const handlePointerUp = (e) => {
        if (activeAxis) {
            if (e && typeof e.stopPropagation === 'function') {
                e.stopPropagation();
            }
            setActiveAxis(null);
            // Reset local position to match actual position
            setLocalPosition(position);
            onDragEnd();
        }
    };

    // Update plane mesh orientation to always face camera
    useFrame(() => {
        if (planeMeshRef.current) {
            planeMeshRef.current.lookAt(camera.position);
        }
    });

    return (
        <group position={activeAxis ? localPosition : position}>
            <Axis color="#ff4444" rotation={[0, 0, -Math.PI / 2]} axis="x" onStart={handlePointerDown} />
            <Axis color="#44ff44" rotation={[0, 0, 0]} axis="y" onStart={handlePointerDown} />
            <Axis color="#4444ff" rotation={[Math.PI / 2, 0, 0]} axis="z" onStart={handlePointerDown} />

            {activeAxis && (
                <mesh
                    ref={planeMeshRef}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerOut={handlePointerUp}
                    onPointerMissed={handlePointerUp}
                    visible={false}
                >
                    <planeGeometry args={[1000, 1000]} />
                </mesh>
            )}
        </group>
    );
};

export default Gizmo;
