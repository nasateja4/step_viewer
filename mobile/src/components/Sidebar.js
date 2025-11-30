import React, { useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const Sidebar = ({
    objects,
    selectedId,
    onSelect,
    onUpdateObject,
    onImport,
    onDeleteObject,
    onMate,
    onClose,
    theme,
    toggleTheme,
    viewMode,
    onCycleViewMode,
    showGrid,
    onToggleGrid,
    onResetPosition,
    fileName = "Main Assembly", // New prop with default value
    onDeleteAll, // New prop for deleting entire assembly
    onExport, // New prop for exporting 3D models
    onShowFileInfo, // New prop for showing file information
}) => {
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true); // Tree state

    const isDark = theme === "dark";
    const textColor = isDark ? "white" : "black";
    const subTextColor = isDark ? "#888" : "#666";
    const itemBg = isDark ? "#333" : "#f5f5f5";
    const activeItemBg = isDark ? "#444" : "#e5e5e5";
    const borderColor = isDark ? "#444" : "#ddd";
    const activeIconColor = "#3b82f6";

    const getViewModeIcon = () => {
        switch (viewMode) {
            case "shaded": return "square";
            case "edges": return "cube";
            case "wireframe": return "cube-outline";
            default: return "cube";
        }
    };

    const handleColorSelect = (color) => {
        if (!selectedId) {
            Alert.alert("No Selection", "Please select a part from the list to change its color.");
            return;
        }
        onUpdateObject(selectedId, { color });
        setShowColorPicker(false);
    };

    const handleExportBOM = () => {
        Alert.alert("Export BOM", "BOM Export functionality coming soon!");
    };

    // Toggle all parts visibility
    const handleToggleAllVisibility = () => {
        const allVisible = objects.every(obj => obj.visible);
        objects.forEach(obj => {
            onUpdateObject(obj.id, { visible: !allVisible });
        });
    };

    const PRESET_COLORS = [
        "#ef4444", // Red
        "#f97316", // Orange
        "#eab308", // Yellow
        "#22c55e", // Green
        "#06b6d4", // Cyan
        "#3b82f6", // Blue
        "#a855f7", // Purple
        "#ec4899", // Pink
        "#ffffff", // White
        "#9ca3af", // Gray
        "#1f2937", // Dark Gray
        "#000000", // Black
    ];

    const allVisible = objects.length > 0 && objects.every(obj => obj.visible);

    return (
        <View style={[styles.container, { backgroundColor: isDark ? "#222" : "#fff" }]}>

            {/* Top Control Row */}
            <View style={styles.topRow}>
                <TouchableOpacity
                    style={[
                        styles.topButton,
                        { backgroundColor: showGrid ? activeItemBg : itemBg, borderColor: showGrid ? activeIconColor : "transparent", borderWidth: 1 }
                    ]}
                    onPress={onToggleGrid}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name="grid"
                        size={20}
                        color={showGrid ? activeIconColor : textColor}
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.topButton,
                        { backgroundColor: itemBg, borderColor: "transparent", borderWidth: 1 }
                    ]}
                    onPress={onCycleViewMode}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name={getViewModeIcon()}
                        size={20}
                        color={activeIconColor}
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.topButton,
                        { backgroundColor: showColorPicker ? activeItemBg : itemBg, borderColor: showColorPicker ? activeIconColor : "transparent", borderWidth: 1 }
                    ]}
                    onPress={() => setShowColorPicker(!showColorPicker)}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name="color-palette-outline"
                        size={20}
                        color={showColorPicker ? activeIconColor : textColor}
                    />
                </TouchableOpacity>

                {/* Replace the View Selector button with File Info */}
                <TouchableOpacity
                    style={[
                        styles.topButton,
                        { backgroundColor: itemBg, borderColor: "transparent", borderWidth: 1 }
                    ]}
                    onPress={onShowFileInfo}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name="information-circle-outline"
                        size={20}
                        color={textColor}
                    />
                </TouchableOpacity>


            </View>

            {/* Color Picker Row */}
            {showColorPicker && (
                <View style={styles.colorPickerContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {PRESET_COLORS.map((color) => (
                            <TouchableOpacity
                                key={color}
                                style={[styles.colorSwatch, { backgroundColor: color }]}
                                onPress={() => handleColorSelect(color)}
                            />
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Parts List Header */}
            <View style={[styles.tableHeader, { borderBottomColor: borderColor }]}>
                <Text style={[styles.headerText, { color: textColor, flex: 1 }]}>Feature Tree</Text>
            </View>

            {/* Parts List Content - SolidWorks Style Tree */}
            <ScrollView style={styles.content}>
                {objects.length > 0 ? (
                    <>
                        {/* Parent Assembly Row */}
                        <View
                            style={[
                                styles.parentRow,
                                { borderBottomColor: borderColor, backgroundColor: itemBg }
                            ]}
                        >
                            <TouchableOpacity
                                style={styles.parentRowContent}
                                onPress={() => setIsExpanded(!isExpanded)}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={isExpanded ? "chevron-down" : "chevron-forward"}
                                    size={18}
                                    color={textColor}
                                    style={styles.chevronIcon}
                                />
                                <Ionicons
                                    name="cube-outline"
                                    size={18}
                                    color={activeIconColor}
                                    style={styles.assemblyIcon}
                                />
                                <Text style={[styles.parentText, { color: textColor }]} numberOfLines={1}>
                                    {fileName}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.globalVisibilityButton}
                                onPress={handleToggleAllVisibility}
                            >
                                <Ionicons
                                    name={allVisible ? "eye-outline" : "eye-off-outline"}
                                    size={18}
                                    color={textColor}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.deleteAllButton}
                                onPress={onDeleteAll}
                            >
                                <Ionicons
                                    name="trash-outline"
                                    size={18}
                                    color="#ef4444"
                                />
                            </TouchableOpacity>
                        </View>

                        {/* Child Parts - Indented */}
                        {isExpanded && objects.map((obj, idx) => (
                            <View
                                key={obj.id}
                                style={[
                                    styles.childRow,
                                    {
                                        borderBottomColor: borderColor,
                                        backgroundColor: obj.id === selectedId ? (isDark ? "#3b82f6" : "#bfdbfe") : "transparent"
                                    }
                                ]}
                            >
                                <Text style={[styles.childIndex, { color: textColor }]}>{idx + 1}</Text>
                                <TouchableOpacity
                                    style={styles.childNameContainer}
                                    onPress={() => onSelect(obj.id)}
                                >
                                    <Text style={[styles.childText, { color: textColor }]} numberOfLines={1}>
                                        {obj.name}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.iconButton}
                                    onPress={() => onUpdateObject(obj.id, { visible: !obj.visible })}
                                >
                                    <Ionicons
                                        name={obj.visible ? "eye-outline" : "eye-off-outline"}
                                        size={16}
                                        color={textColor}
                                    />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.iconButton}
                                    onPress={() => onResetPosition(obj.id)}
                                >
                                    <Ionicons
                                        name="refresh-outline"
                                        size={16}
                                        color={textColor}
                                    />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.iconButton}
                                    onPress={() => onDeleteObject(obj.id)}
                                >
                                    <Ionicons
                                        name="trash-outline"
                                        size={16}
                                        color="#ef4444"
                                    />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </>
                ) : (
                    <Text style={{ color: subTextColor, textAlign: "center", marginTop: 20 }}>
                        No parts loaded
                    </Text>
                )}
            </ScrollView>

            {/* Bottom Footer */}
            <View style={[styles.footer, { borderTopColor: borderColor }]}>
                <TouchableOpacity
                    style={[styles.themeToggle, { backgroundColor: itemBg }]}
                    onPress={toggleTheme}
                >
                    <Ionicons name={isDark ? "moon-outline" : "sunny-outline"} size={20} color={textColor} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.exportButton, { backgroundColor: itemBg }]}
                    onPress={onExport}
                    disabled={objects.length === 0}
                >
                    <Ionicons name="share-social-outline" size={18} color={objects.length === 0 ? subTextColor : activeIconColor} style={{ marginRight: 6 }} />
                    <Text style={[styles.exportText, { color: objects.length === 0 ? subTextColor : textColor }]}>Export File</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.exportButton, { backgroundColor: itemBg }]}
                    onPress={handleExportBOM}
                >
                    <Text style={[styles.exportText, { color: textColor }]}>Export BOM</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 10,
        paddingTop: 40,
    },
    topRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 10,
        gap: 10,
    },
    topButton: {
        flex: 1,
        height: 40,
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
    },
    colorPickerContainer: {
        flexDirection: "row",
        marginBottom: 15,
        height: 40,
    },
    colorSwatch: {
        width: 30,
        height: 30,
        borderRadius: 15,
        marginRight: 10,
        borderWidth: 1,
        borderColor: "#ddd",
    },
    tableHeader: {
        flexDirection: "row",
        paddingVertical: 8,
        borderBottomWidth: 2,
        marginBottom: 5,
    },
    headerText: {
        fontWeight: "bold",
        fontSize: 14,
    },
    content: {
        flex: 1,
    },
    tableRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    rowText: {
        fontSize: 14,
    },
    footer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 15,
        borderTopWidth: 1,
        marginTop: 10,
    },
    themeToggle: {
        width: 50,
        height: 40,
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(128,128,128,0.2)",
    },
    exportButton: {
        flex: 1,
        height: 40,
        marginLeft: 15,
        borderRadius: 8,
        flexDirection: 'row',
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(128,128,128,0.2)",
    },
    exportText: {
        fontWeight: "bold",
    },
    // SolidWorks-style tree styles
    parentRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        marginBottom: 2,
    },
    parentRowContent: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
    },
    chevronIcon: {
        marginRight: 5,
    },
    assemblyIcon: {
        marginRight: 8,
    },
    parentText: {
        fontSize: 15,
        fontWeight: "600",
        flex: 1,
    },
    globalVisibilityButton: {
        padding: 8,
        marginLeft: 8,
    },
    deleteAllButton: {
        padding: 8,
        marginLeft: 4,
    },
    childRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingLeft: 35, // Indent children
        paddingRight: 8,
        borderBottomWidth: 1,
    },
    childIndex: {
        fontSize: 12,
        width: 25,
        color: "#888",
    },
    childNameContainer: {
        flex: 1,
        marginRight: 8,
    },
    childText: {
        fontSize: 14,
    },
    iconButton: {
        padding: 4,
        marginLeft: 6,
        alignItems: "center",
        justifyContent: "center",
        width: 28,
    },
});

export default Sidebar;
