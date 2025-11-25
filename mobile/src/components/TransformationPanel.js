import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const TransformationPanel = ({ selectedObject, onUpdate }) => {
    const [stepSize, setStepSize] = useState(10);
    const [position, setPosition] = useState([0, 0, 0]);

    // Refs to hold latest values for the interval closure
    const positionRef = useRef([0, 0, 0]);
    const stepSizeRef = useRef(10);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (selectedObject) {
            setPosition(selectedObject.position);
            positionRef.current = selectedObject.position;
        }
    }, [selectedObject]);

    useEffect(() => {
        stepSizeRef.current = stepSize;
    }, [stepSize]);

    // Cleanup interval on unmount
    useEffect(() => {
        return () => stopMoving();
    }, []);

    if (!selectedObject) return null;

    const stopMoving = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    const handleMove = (axis, direction) => {
        const currentPos = positionRef.current;
        const newPos = [...currentPos];
        newPos[axis] += direction * stepSizeRef.current;

        // Update state and ref
        setPosition(newPos);
        positionRef.current = newPos;

        // Notify parent
        onUpdate(selectedObject.id, { position: newPos });
    };

    const startMoving = (axis, direction) => {
        stopMoving();
        handleMove(axis, direction); // Initial move
        intervalRef.current = setInterval(() => {
            handleMove(axis, direction);
        }, 100); // Repeat every 100ms
    };

    const AxisControl = ({ label, axisIndex, color }) => (
        <View style={styles.axisRow}>
            <Text style={[styles.axisLabel, { color }]}>{label}</Text>
            <TouchableOpacity
                style={styles.button}
                onPressIn={() => startMoving(axisIndex, -1)}
                onPressOut={stopMoving}
            >
                <Text style={styles.buttonText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.valueText}>{position[axisIndex].toFixed(1)}</Text>
            <TouchableOpacity
                style={styles.button}
                onPressIn={() => startMoving(axisIndex, 1)}
                onPressOut={stopMoving}
            >
                <Text style={styles.buttonText}>+</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Transform Position</Text>

            <View style={styles.stepContainer}>
                <Text style={styles.label}>Step Size:</Text>
                {[1, 10, 50].map((size) => (
                    <TouchableOpacity
                        key={size}
                        style={[styles.stepButton, stepSize === size && styles.activeStep]}
                        onPress={() => setStepSize(size)}
                    >
                        <Text style={[styles.stepText, stepSize === size && styles.activeStepText]}>
                            {size}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <AxisControl label="X" axisIndex={0} color="#ff4444" />
            <AxisControl label="Y" axisIndex={1} color="#44ff44" />
            <AxisControl label="Z" axisIndex={2} color="#4444ff" />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 100,
        right: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        padding: 15,
        borderRadius: 10,
        width: 200,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    header: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
        color: '#333',
    },
    stepContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    label: {
        fontSize: 12,
        color: '#666',
    },
    stepButton: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
        backgroundColor: '#eee',
    },
    activeStep: {
        backgroundColor: '#007AFF',
    },
    stepText: {
        fontSize: 12,
        color: '#333',
    },
    activeStepText: {
        color: 'white',
    },
    axisRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    axisLabel: {
        fontWeight: 'bold',
        width: 20,
        fontSize: 16,
    },
    button: {
        backgroundColor: '#eee',
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    valueText: {
        width: 60,
        textAlign: 'center',
        fontSize: 14,
        fontVariant: ['tabular-nums'],
        color: '#333',
    },
});

export default TransformationPanel;
