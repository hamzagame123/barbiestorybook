import { addComponent, onStart, WebXR } from "@needle-tools/engine";
import * as THREE from "three";
import "./generated/gen.js";
import { AccessorySpawner } from "./components/AccessorySpawner";
import { ARPlacement } from "./components/ARPlacement";
import { BackgroundSpawner } from "./components/BackgroundSpawner";
import { CharacterSpawner } from "./components/CharacterSpawner";
import { HUD } from "./components/HUD";
import { LibraryUI } from "./components/LibraryUI";
import { ScrapbookUI } from "./components/ScrapbookUI";
import { SceneGestures } from "./components/SceneGestures";
import { SceneRig } from "./components/SceneRig";
import { StagePropSpawner } from "./components/StagePropSpawner";
import * as ScrapbookStore from "./store/ScrapbookStore";
import { installDebugLogBridge, logDebug } from "./utils/DebugLog";

installDebugLogBridge();
window.addEventListener("error", (event) => {
    logDebug("window.error", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
    });
});
window.addEventListener("unhandledrejection", (event) => {
    logDebug("window.unhandledrejection", {
        reason: event.reason instanceof Error ? event.reason.message : String(event.reason),
    });
});
void ScrapbookStore.init().catch((error) => {
    console.error("Failed to initialise scrapbook store:", error);
    logDebug("store.init_failed", {
        message: error instanceof Error ? error.message : String(error),
    });
});

onStart((context) => {
    context.scene.background = null;
    context.renderer.setClearColor(new THREE.Color("#000000"), 0);
    context.domElement.setAttribute("background-color", "transparent");
    context.devicePixelRatio = Math.min(1, window.devicePixelRatio || 1);
    context.mainCamera.position.set(0, 1.4, 2.2);
    context.mainCamera.lookAt(0, 1.1, 0);

    const keyLight = new THREE.DirectionalLight(0xffd7ea, 1.6);
    keyLight.position.set(1.5, 2.8, 2);
    context.scene.add(keyLight);

    const fillLight = new THREE.HemisphereLight(0xffd7ea, 0x2b0b1a, 1.1);
    context.scene.add(fillLight);

    addComponent(context.scene, WebXR, {
        createARButton: true,
        createVRButton: false,
        createQRCode: false,
        createSendToQuestButton: false,
        usePlacementReticle: false,
        usePlacementAdjustment: false,
        autoPlace: false,
        autoCenter: false,
    });

    addComponent(context.scene, ARPlacement);
    addComponent(context.scene, SceneRig);
    addComponent(context.scene, SceneGestures);
    addComponent(context.scene, BackgroundSpawner);
    addComponent(context.scene, CharacterSpawner);
    addComponent(context.scene, AccessorySpawner);
    addComponent(context.scene, StagePropSpawner);
    addComponent(context.scene, LibraryUI);
    addComponent(context.scene, ScrapbookUI);
    addComponent(context.scene, HUD);
});
