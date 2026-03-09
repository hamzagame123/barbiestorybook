# UI Code Guide

## The UI files you want
If your deliverable is specifically about the app UI, these are the main files to use:

- `src/components/HUD.ts`
  - main in-app overlay UI: AR button, gallery button, prompt inputs, action buttons, toast
- `src/components/ScrapbookUI.ts`
  - scrapbook/gallery overlay UI
- `src/styles/style.css`
  - global visual styling for the page and engine host
- `index.html`
  - page shell, fonts, meta tags, and app mount point
- `src/main.ts`
  - where the HUD and scrapbook UI are mounted into the app

If your deliverable also wants immersive visual language and not just DOM UI, include these too:

- `src/components/ARPlacement.ts`
  - reticle and AR placement behavior
- `src/components/WorldSpawner.ts`
  - world backdrop behavior and environment image
- `src/components/SceneRig.ts`
  - shared transform root for placed content

## 1. Page shell
Source: `index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" href="favicon.ico">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
  <meta name="theme-color" content="#0C0008">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Fraunces:opsz,wght,SOFT@9..144,300,0;9..144,400,0;9..144,300,100;9..144,400,100&display=swap" rel="stylesheet">
  <title>Barbie Storybook</title>
  <meta name="robots" content="index,follow">
  <link rel="stylesheet" href="./src/styles/style.css">
</head>
<body>
  <script type="module" src="./src/main.ts"></script>
  <needle-engine></needle-engine>
</body>
</html>
```

## 2. Global UI styling
Source: `src/styles/style.css`

```css
html {
    width: 100%;
    height: -webkit-fill-available;
}

body {
    padding: 0;
    margin: 0;
    min-width: 100%;
    min-height: 100vh;
    min-height: -webkit-fill-available;
    overflow: hidden;
    background:
        radial-gradient(circle at top, rgba(255, 79, 146, 0.14), transparent 36%),
        linear-gradient(180deg, #17020f 0%, #0c0008 100%);
    color: white;
    font-family: "DM Mono", monospace;
    overscroll-behavior: none;
    touch-action: manipulation;
}

* {
    box-sizing: border-box;
}

needle-engine {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}
```

## 3. Main HUD UI markup
Source: `src/components/HUD.ts`
This is the main overlay users interact with.

```ts
private injectMarkup(): void {
    const root = document.createElement("div");
    root.id = "barbie-hud";
    root.dataset.barbieOverlay = "true";
    root.innerHTML = `
        <div id="hud-top">
            <div id="surface-badge">SCANNING</div>
            <div id="top-actions">
                <button id="ar-btn" type="button">START AR</button>
                <button id="gallery-btn" type="button">GALLERY</button>
            </div>
        </div>
        <div id="hud-bottom">
            <button id="magic-btn" type="button">MAKE FOR ME</button>
            <div id="prompt-row">
                <input id="prompt-input" type="text" placeholder="Describe your Barbie..." autocomplete="off" />
                <button id="speak-btn" type="button" aria-label="Hold to speak">HOLD</button>
            </div>
            <input id="world-input" type="text" placeholder="Describe the Barbie world..." autocomplete="off" />
            <div id="action-row">
                <button id="add-btn" type="button" disabled>ADD TO SCENE</button>
                <button id="world-btn" type="button" disabled>BUILD WORLD</button>
            </div>
            <button id="capture-btn" type="button" disabled>CAPTURE</button>
        </div>
        <div id="status-toast" hidden></div>
    `;

    this.getOverlayHost().append(root);
    this.root = root;
    this.surfaceBadge = root.querySelector("#surface-badge") as HTMLDivElement;
    this.arButton = root.querySelector("#ar-btn") as HTMLButtonElement;
    this.galleryButton = root.querySelector("#gallery-btn") as HTMLButtonElement;
    this.magicButton = root.querySelector("#magic-btn") as HTMLButtonElement;
    this.promptInput = root.querySelector("#prompt-input") as HTMLInputElement;
    this.worldInput = root.querySelector("#world-input") as HTMLInputElement;
    this.speakButton = root.querySelector("#speak-btn") as HTMLButtonElement;
    this.addButton = root.querySelector("#add-btn") as HTMLButtonElement;
    this.buildWorldButton = root.querySelector("#world-btn") as HTMLButtonElement;
    this.captureButton = root.querySelector("#capture-btn") as HTMLButtonElement;
    this.toast = root.querySelector("#status-toast") as HTMLDivElement;
}
```

## 4. Main HUD UI styling
Source: `src/components/HUD.ts`
Use the full file for the complete visual system. The styling block starts in `injectStyles()` and defines:

- fixed full-screen HUD container
- top action row
- bottom prompt/action tray
- branded button styles
- mobile-friendly inputs
- status toast styling

Full source file to copy if you want the whole UI behavior:
- `src/components/HUD.ts`

## 5. Scrapbook UI markup
Source: `src/components/ScrapbookUI.ts`

```ts
private injectMarkup(): void {
    const overlay = document.createElement("div");
    overlay.id = "scrapbook-overlay";
    overlay.hidden = true;
    overlay.dataset.barbieOverlay = "true";
    overlay.innerHTML = `
        <div id="scrapbook-header">
            <span id="scrapbook-title">Barbie's Storybook</span>
            <button id="scrapbook-close" type="button" aria-label="Close scrapbook">×</button>
        </div>
        <div id="scrapbook-grid"></div>
        <div id="scrapbook-empty" hidden>Your story starts here ✨</div>
    `;

    this.getOverlayHost().append(overlay);

    this.overlay = overlay;
    this.grid = overlay.querySelector("#scrapbook-grid") as HTMLDivElement;
    this.emptyState = overlay.querySelector("#scrapbook-empty") as HTMLDivElement;

    const closeButton = overlay.querySelector("#scrapbook-close") as HTMLButtonElement;
    closeButton.addEventListener("click", () => void this.toggle());
}
```

## 6. Scrapbook UI styling
Source: `src/components/ScrapbookUI.ts`
This file styles the scrapbook view with:

- warm paper-like background
- editorial serif typography
- two-column card grid
- washi tape accent strips
- responsive single-column mobile layout

Full source file to copy if you want the whole gallery UI behavior:
- `src/components/ScrapbookUI.ts`

## 7. UI bootstrapping
Source: `src/main.ts`
This is where the UI components are attached to the scene.

```ts
import { addComponent, onStart, WebXR } from "@needle-tools/engine";
import * as THREE from "three";
import "./generated/gen.js";
import { ARPlacement } from "./components/ARPlacement";
import { CharacterSpawner } from "./components/CharacterSpawner";
import { HUD } from "./components/HUD";
import { ScrapbookUI } from "./components/ScrapbookUI";
import { SceneGestures } from "./components/SceneGestures";
import { SceneRig } from "./components/SceneRig";
import { WorldSpawner } from "./components/WorldSpawner";
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
    addComponent(context.scene, SceneRig);
    addComponent(context.scene, SceneGestures);
    addComponent(context.scene, CharacterSpawner);
    addComponent(context.scene, WorldSpawner);
    addComponent(context.scene, ScrapbookUI);
    addComponent(context.scene, HUD);
});
```

## Best files to insert into your deliverable
If you want the cleanest UI section in your PDF, use these in this order:

1. `index.html`
2. `src/styles/style.css`
3. `src/components/HUD.ts`
4. `src/components/ScrapbookUI.ts`
5. `src/main.ts`

## If you want the immersive UI/3D language section too
Also include:

- `src/components/ARPlacement.ts`
- `src/components/WorldSpawner.ts`
- `src/components/SceneRig.ts`

Those files show how the visual language extends beyond flat UI into AR placement, world presentation, and spatial composition.
