const { getDefaultConfig } = require('expo/metro-config');


const config = getDefaultConfig(__dirname);

// Add 'cjs' to sourceExts for Three.js and other libraries
config.resolver.sourceExts.push('cjs');

const path = require('path');

// Force resolution of 'three', 'react', and 'react-native' to the one in root node_modules
config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    three: path.resolve(__dirname, 'node_modules/three'),
    react: path.resolve(__dirname, 'node_modules/react'),
    'react-native': path.resolve(__dirname, 'node_modules/react-native'),
};

module.exports = config;
