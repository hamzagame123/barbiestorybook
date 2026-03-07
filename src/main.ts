import { addComponent, onStart, WebXR } from "@needle-tools/engine";
import * as THREE from "three";
import "./generated/gen.js";
import { ARPlacement } from "./components/ARPlacement";
import { CharacterSpawner } from "./components/CharacterSpawner";
import { HUD } from "./components/HUD";
import { ScrapbookUI } from "./components/ScrapbookUI";
import * as ScrapbookStore from "./store/ScrapbookStore";

void ScrapbookStore.init().catch((error) => {
    console.error("Failed to initialise scrapbook store:", error);
});

onStart((context) => {
    context.scene.background = new THREE.Color("#10000b");
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
    addComponent(context.scene, CharacterSpawner);
    addComponent(context.scene, ScrapbookUI);
    addComponent(context.scene, HUD);
});
