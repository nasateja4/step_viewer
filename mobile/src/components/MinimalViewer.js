import React from 'react';
import { View } from 'react-native';
import { Canvas } from '@react-three/fiber/native';

const MinimalViewer = () => {
    return (
        <View style={{ flex: 1, backgroundColor: 'black' }}>
            <Canvas>
                <ambientLight />
                <pointLight position={[10, 10, 10]} />
                <mesh>
                    <boxGeometry args={[1, 1, 1]} />
                    <meshStandardMaterial color="orange" />
                </mesh>
            </Canvas>
        </View>
    );
};

export default MinimalViewer;
