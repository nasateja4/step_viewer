const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 1. Add 'wasm', 'stl', 'step', 'igs' to the list of assets
config.resolver.assetExts.push(
    'wasm',
    'stl',
    'obj',
    'stp',
    'step',
    'igs',
    'iges',
    'gltf',
    'glb',
    'ply'
);

// 2. Ensure .txt is treated as an asset (for renamed JS libraries)
config.resolver.assetExts.push('txt');

module.exports = config;
