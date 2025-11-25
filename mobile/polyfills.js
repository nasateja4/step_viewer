import { Platform } from 'react-native';
import { Buffer } from 'buffer';

global.Buffer = global.Buffer || Buffer;

if (Platform.OS !== 'web') {
    // Polyfill window
    if (typeof window === 'undefined') {
        global.window = global;
    }

    // Polyfill document
    if (typeof document === 'undefined') {
        global.document = {
            createElement: (tagName) => {
                if (tagName === 'canvas') {
                    return {
                        getContext: (type) => {
                            if (type === '2d') {
                                return {
                                    fillRect: () => { },
                                    drawImage: () => { },
                                    getImageData: () => ({ data: new Uint8ClampedArray(0) }),
                                    putImageData: () => { },
                                    createImageData: () => ({ data: new Uint8ClampedArray(0) }),
                                    beginPath: () => { },
                                    moveTo: () => { },
                                    lineTo: () => { },
                                    stroke: () => { },
                                    fill: () => { },
                                    closePath: () => { },
                                    arc: () => { },
                                    save: () => { },
                                    restore: () => { },
                                    translate: () => { },
                                    rotate: () => { },
                                    scale: () => { },
                                    clearRect: () => { },
                                    measureText: () => ({ width: 0 }),
                                    fillText: () => { },
                                    strokeText: () => { },
                                };
                            }
                            return {
                                fillRect: () => { },
                                drawImage: () => { },
                                getImageData: () => ({ data: new Uint8ClampedArray(0) }),
                            };
                        },
                        width: 0,
                        height: 0,
                        style: {},
                        addEventListener: () => { },
                        removeEventListener: () => { },
                        setAttribute: () => { },
                        removeAttribute: () => { },
                        setPointerCapture: () => { },
                        releasePointerCapture: () => { },
                        hasPointerCapture: () => false,
                        clientWidth: 0,
                        clientHeight: 0,
                        getBoundingClientRect: () => ({
                            left: 0,
                            top: 0,
                            width: 0,
                            height: 0,
                            right: 0,
                            bottom: 0,
                            x: 0,
                            y: 0,
                        }),
                    };
                }
                return {
                    style: {},
                    appendChild: () => { },
                    addEventListener: () => { },
                    removeEventListener: () => { },
                    setAttribute: () => { },
                    removeAttribute: () => { },
                    setPointerCapture: () => { },
                    releasePointerCapture: () => { },
                    hasPointerCapture: () => false,
                };
            },
            getElementById: () => null,
            addEventListener: () => { },
            removeEventListener: () => { },
            body: {
                appendChild: () => { },
                removeChild: () => { },
            },
            documentElement: {
                style: {},
                setAttribute: () => { },
                removeAttribute: () => { },
            },
        };
    }

    // Polyfill other browser globals
    if (typeof navigator === 'undefined') {
        global.navigator = {
            userAgent: 'ReactNative',
        };
    }

    if (typeof HTMLCanvasElement === 'undefined') {
        global.HTMLCanvasElement = class {
            getBoundingClientRect() {
                return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0 };
            }
        };
    } else if (!HTMLCanvasElement.prototype.getBoundingClientRect) {
        HTMLCanvasElement.prototype.getBoundingClientRect = () => ({
            left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0
        });
    }

    if (typeof Image === 'undefined') {
        global.Image = class {
            constructor() {
                this.addEventListener = () => { };
                this.removeEventListener = () => { };
            }
        };
    }
}
