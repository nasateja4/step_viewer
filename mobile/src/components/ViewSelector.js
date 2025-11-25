import React, { useState, useMemo } from 'react';
import { Box3, Vector3, BufferGeometry, Float32BufferAttribute } from 'three';
import { useThree } from '@react-three/fiber/native';
import { Text } from '@react-three/drei/native';
import * as THREE from 'three';

const ViewSelector = ({ onSelect, box }) => {
    const { camera } = useThree();
    const [hovered, setHovered] = useState(null);

    const { center, size } = useMemo(() => {
        if (box) {
            const c = new Vector3();
            box.getCenter(c);
            const s = new Vector3();
            box.getSize(s);
            const maxDim = Math.max(s.x, s.y, s.z);
            return { center: c, size: Math.max(maxDim * 1.5, 10) };
        }
        return { center: new Vector3(0, 0, 0), size: 10 };
    }, [box]);

    // Geometry Constants
    const S = size / 2; // Half-size
    const C = S * 0.3; // Chamfer size (30% of half-size)
    const FACE_S = (S - C) * 2; // Face size
    const EDGE_W = C * Math.sqrt(2); // Edge width
    const EDGE_L = FACE_S; // Edge length
    const EDGE_OFFSET = S - C / 2; // Position of edge center

    // Helper Components
    const SelectorMesh = ({ geometry, position, rotation, direction, name }) => (
        <mesh
            geometry={geometry}
            position={position}
            rotation={rotation}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(direction);
            }}
            onPointerOver={(e) => {
                e.stopPropagation();
                setHovered(name);
            }}
            onPointerOut={(e) => {
                e.stopPropagation();
                setHovered(null);
            }}
        >
            <meshBasicMaterial
                color={hovered === name ? "#3b82f6" : "#e5e5e5"}
                transparent
                opacity={hovered === name ? 0.8 : 0.3}
                side={THREE.DoubleSide}
            />
            <lineSegments>
                <edgesGeometry args={[geometry]} />
                <lineBasicMaterial color="#888" transparent opacity={0.5} />
            </lineSegments>
        </mesh>
    );

    // Geometries
    const faceGeo = useMemo(() => new THREE.PlaneGeometry(FACE_S, FACE_S), [FACE_S]);
    const edgeGeoX = useMemo(() => new THREE.PlaneGeometry(EDGE_L, EDGE_W), [EDGE_L, EDGE_W]); // Length along X
    const edgeGeoY = useMemo(() => new THREE.PlaneGeometry(EDGE_W, EDGE_L), [EDGE_W, EDGE_L]); // Length along Y
    const edgeGeoZ = useMemo(() => new THREE.PlaneGeometry(EDGE_W, EDGE_L), [EDGE_W, EDGE_L]); // Length along Z (vertical)

    // Faces
    const faces = [
        { name: 'Front', dir: [0, 0, 1], pos: [0, 0, S], rot: [0, 0, 0] },
        { name: 'Back', dir: [0, 0, -1], pos: [0, 0, -S], rot: [0, Math.PI, 0] },
        { name: 'Right', dir: [1, 0, 0], pos: [S, 0, 0], rot: [0, Math.PI / 2, 0] },
        { name: 'Left', dir: [-1, 0, 0], pos: [-S, 0, 0], rot: [0, -Math.PI / 2, 0] },
        { name: 'Top', dir: [0, 1, 0], pos: [0, S, 0], rot: [-Math.PI / 2, 0, 0] },
        { name: 'Bottom', dir: [0, -1, 0], pos: [0, -S, 0], rot: [Math.PI / 2, 0, 0] },
    ];

    // Edges (12)
    const edges = [
        // X-Axis Edges (Use edgeGeoX)
        { name: 'Front-Top', dir: [0, 1, 1], pos: [0, EDGE_OFFSET, EDGE_OFFSET], rot: [-Math.PI / 4, 0, 0], geo: edgeGeoX },
        { name: 'Front-Bottom', dir: [0, -1, 1], pos: [0, -EDGE_OFFSET, EDGE_OFFSET], rot: [Math.PI / 4, 0, 0], geo: edgeGeoX },
        { name: 'Back-Top', dir: [0, 1, -1], pos: [0, EDGE_OFFSET, -EDGE_OFFSET], rot: [-3 * Math.PI / 4, 0, 0], geo: edgeGeoX },
        { name: 'Back-Bottom', dir: [0, -1, -1], pos: [0, -EDGE_OFFSET, -EDGE_OFFSET], rot: [3 * Math.PI / 4, 0, 0], geo: edgeGeoX },

        // Y-Axis Edges (Use edgeGeoY - horizontal edges at front/back chamfer)
        { name: 'Front-Right', dir: [1, 0, 1], pos: [EDGE_OFFSET, 0, EDGE_OFFSET], rot: [0, Math.PI / 4, 0], geo: edgeGeoY },
        { name: 'Front-Left', dir: [-1, 0, 1], pos: [-EDGE_OFFSET, 0, EDGE_OFFSET], rot: [0, -Math.PI / 4, 0], geo: edgeGeoY },
        { name: 'Back-Right', dir: [1, 0, -1], pos: [EDGE_OFFSET, 0, -EDGE_OFFSET], rot: [0, 3 * Math.PI / 4, 0], geo: edgeGeoY },
        { name: 'Back-Left', dir: [-1, 0, -1], pos: [-EDGE_OFFSET, 0, -EDGE_OFFSET], rot: [0, -3 * Math.PI / 4, 0], geo: edgeGeoY },

        // Z-Axis Edges - COMMENTED OUT (not aligning correctly, will fix later)
        // { name: 'Right-Top', dir: [1, 1, 0], pos: [EDGE_OFFSET, EDGE_OFFSET, 0], rot: [0, Math.PI / 2, -Math.PI / 4], geo: edgeGeoX },
        // { name: 'Right-Bottom', dir: [1, -1, 0], pos: [EDGE_OFFSET, -EDGE_OFFSET, 0], rot: [0, Math.PI / 2, Math.PI / 4], geo: edgeGeoX },
        // { name: 'Left-Top', dir: [-1, 1, 0], pos: [-EDGE_OFFSET, EDGE_OFFSET, 0], rot: [0, -Math.PI / 2, Math.PI / 4], geo: edgeGeoX },
        // { name: 'Left-Bottom', dir: [-1, -1, 0], pos: [-EDGE_OFFSET, -EDGE_OFFSET, 0], rot: [0, -Math.PI / 2, -Math.PI / 4], geo: edgeGeoX },
    ];

    // Fix edge rotations and geometries
    // For simplicity, let's use a generic EdgeMesh that we rotate and scale
    // Actually, the "Edge" plane needs to be oriented correctly.
    // Front-Top: Normal (0, 1, 1). Plane spans X (width FACE_S) and diagonal (height EDGE_W).
    // Rotation -45deg X aligns plane normal (0,0,1) to (0,1,1).

    // Corners (8)
    // Vertices defined relative to (S,S,S) as (-C,0,0), (0,-C,0), (0,0,-C)
    // We just need to position the mesh at the corner (S,S,S) and rotate it to match the quadrant.
    const corners = [
        { name: 'FRT', dir: [1, 1, 1], pos: [S, S, S], rot: [0, 0, 0] },
        { name: 'FLT', dir: [-1, 1, 1], pos: [-S, S, S], rot: [0, 0, Math.PI / 2] },
        { name: 'BRT', dir: [1, 1, -1], pos: [S, S, -S], rot: [0, -Math.PI / 2, 0] }, // Needs verification
        { name: 'BLT', dir: [-1, 1, -1], pos: [-S, S, -S], rot: [0, Math.PI, 0] }, // Needs verification

        { name: 'FRB', dir: [1, -1, 1], pos: [S, -S, S], rot: [0, 0, -Math.PI / 2] },
        { name: 'FLB', dir: [-1, -1, 1], pos: [-S, -S, S], rot: [0, 0, Math.PI] },
        { name: 'BRB', dir: [1, -1, -1], pos: [S, -S, -S], rot: [Math.PI, 0, 0] },
        { name: 'BLB', dir: [-1, -1, -1], pos: [-S, -S, -S], rot: [Math.PI, Math.PI, 0] },
    ];

    // Corner rotation logic is tricky with the custom geometry.
    // Let's use a simpler approach for corners: A small sphere or just the custom geometry defined for one corner and mirrored?
    // Or just define 8 geometries?
    // Let's define a helper to create corner geometry for a specific quadrant signs
    const createCornerGeo = (sx, sy, sz) => {
        const geom = new THREE.BufferGeometry();
        // Vertices for the cut surface at corner (sx*S, sy*S, sz*S)
        // The correct vertices are where the chamfered edges meet the faces.
        // v1: On Top Face (y=S), intersection of Front-Top and Right-Top chamfers?
        // No, it's the point (S-C, S, S-C).
        const v1 = [sx * (S - C), sy * S, sz * (S - C)];
        const v2 = [sx * (S - C), sy * (S - C), sz * S];
        const v3 = [sx * S, sy * (S - C), sz * (S - C)];

        // Need to order vertices for correct normal (CCW)
        // For (+,+,+): (S-C, S, S) -> (S, S-C, S) -> (S, S, S-C)
        // Normal (1,1,1)
        // Vector 1-2: (C, -C, 0). Vector 1-3: (C, 0, -C).
        // Cross: (C^2, C^2, C^2). Correct.

        // For (-,+,+): (-S+C, S, S) -> (-S, S-C, S) -> (-S, S, S-C)
        // Normal (-1,1,1)

        // Let's just generate them
        const verts = new Float32Array([
            ...v1, ...v2, ...v3
        ]);

        // Check winding order based on normal direction (sx, sy, sz)
        // Simple heuristic: compute normal, if dot product with (sx,sy,sz) is negative, swap v2/v3

        const p1 = new THREE.Vector3(...v1);
        const p2 = new THREE.Vector3(...v2);
        const p3 = new THREE.Vector3(...v3);
        const edge1 = p2.clone().sub(p1);
        const edge2 = p3.clone().sub(p1);
        const normal = edge1.clone().cross(edge2);
        const targetNormal = new THREE.Vector3(sx, sy, sz);

        if (normal.dot(targetNormal) < 0) {
            // Swap v2 and v3
            geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...v1, ...v3, ...v2]), 3));
        } else {
            geom.setAttribute('position', new THREE.BufferAttribute(verts, 3));
        }

        geom.computeVertexNormals();
        return geom;
    };

    return (
        <group position={center.toArray()}>
            {/* Faces */}
            {faces.map((face) => (
                <SelectorMesh
                    key={face.name}
                    name={face.name}
                    position={face.pos}
                    rotation={face.rot}
                    direction={new Vector3(...face.dir)}
                    geometry={faceGeo}
                />
            ))}

            {/* Edges */}
            {edges.map((edge, index) => (
                <SelectorMesh
                    key={edge.name}
                    name={edge.name}
                    position={edge.pos}
                    rotation={edge.rot}
                    direction={new Vector3(...edge.dir)}
                    geometry={edge.geo}
                />
            ))}

            {/* Corners */}
            {corners.map((corner) => {
                const [sx, sy, sz] = corner.dir;
                return (
                    <SelectorMesh
                        key={corner.name}
                        name={corner.name}
                        position={[0, 0, 0]} // Geometry is absolute
                        rotation={[0, 0, 0]}
                        direction={new Vector3(...corner.dir)}
                        geometry={createCornerGeo(sx, sy, sz)}
                    />
                );
            })}
        </group>
    );
};

export default ViewSelector;
