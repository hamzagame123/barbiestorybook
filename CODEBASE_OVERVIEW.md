# Barbie Storybook Codebase Overview

## What this project is
Barbie Storybook is a browser-based mobile AR prototype built with Needle Engine, Vite, TypeScript, Three.js, and WebXR.
It combines four AI providers into one user loop:
- Gemini for writing/refining prompts and captions
- Nano Banana for 2D image generation and image polishing
- Rodin for turning a reference image into a 3D GLB character
- World Labs Marble for generating a miniature themed world
The app places the generated assets into AR and saves captures locally as scrapbook pages.

## Product idea
The core product idea is simple:
1. The user imagines a Barbie-like character and a matching world.
2. The app turns those ideas into generated assets.
3. The assets are placed into a phone AR scene.
4. The user captures the result as a magical storybook page.
This codebase is optimized around that playful creation loop, not around accounts, backend systems, or long-lived cloud content.

## High-level user flow
### 1. App load
- `index.html` loads the page shell, fonts, global stylesheet, and `src/main.ts`
- Needle Engine mounts into the `<needle-engine>` element
- scrapbook storage is initialized
- the scene camera, lights, WebXR support, and app components are added

### 2. Start AR
- the user taps `START AR`
- the app starts or forwards to Needle's AR session
- hit testing begins
- a reticle appears when a surface is detected
- the user taps the surface to confirm placement

### 3. Create prompts
The user can:
- type a Barbie prompt
- type a world prompt
- hold the speech button to dictate a character idea
- tap `MAKE FOR ME` to let Gemini generate both prompts

### 4. Add the Barbie character
When the user taps `ADD TO SCENE`, the flow is:
1. Gemini rewrites the user's idea into a cleaner image-generation prompt.
2. Nano Banana creates a reference image from that prompt.
3. Rodin takes the reference image plus prompt and generates a GLB.
4. The GLB is loaded into the scene.
5. The character is placed at the chosen AR location.
6. The character animates in with a scale-up pop.

### 5. Build the world
When the user taps `BUILD WORLD`, the flow is:
1. The world prompt is sent to World Labs Marble.
2. The app polls the World Labs operation until it completes.
3. The final world is fetched.
4. The app either loads the collider mesh or falls back to a pano/thumbnail backdrop.
5. If a pano exists, it is also used as the environment image.

### 6. Move and scale the scene
After placement:
- one finger drags the shared scene rig to a new AR hit position
- two fingers pinch to scale the whole composition
The character and world move together because they live under the same rig root.

### 7. Capture a scrapbook page
When the user taps `CAPTURE`, the flow is:
1. The current canvas is captured as a JPEG data URL.
2. Nano Banana may polish the image into a more cinematic result.
3. Gemini writes a one-line caption.
4. The image and caption are saved to IndexedDB.

### 8. Open the scrapbook
- the user taps `GALLERY`
- the scrapbook overlay opens
- saved pages are loaded from IndexedDB
- pages render as scrapbook-style cards

## Technology flow
### Runtime stack
- Vite for dev/build
- Needle Engine for scene/runtime integration
- Three.js for 3D objects, geometry, materials, and textures
- WebXR for AR session handling and hit testing
- IndexedDB for local scrapbook persistence

### AI/service stack
#### Gemini
Gemini handles language tasks only:
- generate a better Rodin image prompt
- generate a paired Barbie prompt and world prompt
- generate a short scrapbook caption

#### Nano Banana
Nano Banana handles 2D image tasks:
- generate a clean reference image from text
- polish the captured AR image

#### Rodin
Rodin handles character generation:
- receive the reference image and prompt
- run an async queue job
- return a GLB URL once complete

#### World Labs Marble
World Labs Marble handles world generation:
- receive the world prompt
- run an async operation
- return world assets after polling
In this codebase, the useful returned fields are:
- `world_id`
- `world_marble_url`
- `thumbnail_url`
- `pano_url`
- `collider_mesh_url`
- `spz_url` when present

## Scene architecture
### `SceneRig`
`SceneRig` owns the shared root group for generated content.
Responsibilities:
- place content at a position
- track current scale
- clamp scale to safe bounds
- act as the common anchor for character and world assets

### `ARPlacement`
`ARPlacement` handles AR surface detection and placement confirmation.
Responsibilities:
- run hit testing in AR
- update `surfaceDetected`
- update `lastHitPosition`
- update `placementConfirmed`
- show and hide the placement reticle
- dispatch placement-related events

### `SceneGestures`
`SceneGestures` handles direct manipulation after placement.
Responsibilities:
- track active pointers
- detect pinch gestures
- drag the scene rig with one finger
- scale the scene rig with two fingers

### `CharacterSpawner`
`CharacterSpawner` owns the currently active generated character.
Responsibilities:
- clear the previous character
- load the GLB
- add it to the rig
- animate it into view

### `WorldSpawner`
`WorldSpawner` owns the currently active generated world representation.
Responsibilities:
- clear the previous world
- load the World Labs collider mesh when available
- otherwise create a thumbnail/pano backdrop
- fit the world into the target size
- set the pano as the environment image when present

## UI architecture
### `HUD`
`HUD` is the main orchestrator of the app.
It is responsible for:
- injecting the main overlay UI
- wiring button and input events
- coordinating prompt generation
- coordinating character generation
- coordinating world generation
- coordinating screenshot capture
- saving scrapbook pages
- tracking busy state
- showing progress/error toasts
Most of the product logic lives here.

### `ScrapbookUI`
`ScrapbookUI` owns the full-screen scrapbook overlay.
Responsibilities:
- inject scrapbook markup and styles
- load pages from IndexedDB
- render pages as cards
- show an empty state when there are no pages

## Data and persistence
### `ScrapbookStore`
`ScrapbookStore` is the app's only persistence layer.
Stored page fields:
- `id`
- `imageBase64`
- `caption`
- `characterPrompt`
- `timestamp`
Responsibilities:
- initialize IndexedDB
- save pages
- load all pages
- delete pages
There is no remote sync. Clearing browser storage removes the scrapbook.

## Boot and build files
### `index.html`
Defines the page shell:
- mobile/web-app metadata
- imported fonts
- global stylesheet
- `needle-engine` host element
- `main.ts` entrypoint

### `src/main.ts`
Bootstraps runtime behavior:
- initialize scrapbook storage
- set the starting camera and lights
- enable WebXR support
- attach app components to the scene

### `src/styles/style.css`
Defines page-level styling:
- full-screen layout
- body gradient background
- base font
- touch/overflow behavior
- full-screen sizing for the engine host
Most component-specific UI styles are injected at runtime by `HUD` and `ScrapbookUI`.

### `vite.config.ts`
Defines the local development/build pipeline:
- Needle Vite plugin integration
- HTTPS dev server for AR-safe testing
- local certificate generation via `vite-plugin-mkcert`
- optional compression
- `dist` output directory

## Generated Needle files
The files in `src/generated` are runtime glue created by Needle tooling.
### `register_types.js`
- registers behavior classes with Needle's `TypeStore`
### `gen.js`
- attaches generated scene metadata to the `needle-engine` element
### `meta.json`
- stores scene/build metadata used by the runtime/tooling

## File-by-file responsibilities
### API clients
- `src/api/GeminiClient.ts`: prompt and caption text generation
- `src/api/NanoBananaClient.ts`: reference image generation and capture polishing
- `src/api/RodinClient.ts`: Rodin queue submission and polling
- `src/api/WorldLabsClient.ts`: World Labs world submission, polling, fetch, and normalization

### Components
- `src/components/ARPlacement.ts`: surface detection and placement
- `src/components/SceneRig.ts`: shared transform root and scale
- `src/components/SceneGestures.ts`: drag/pinch gestures
- `src/components/CharacterSpawner.ts`: character loading and animation
- `src/components/WorldSpawner.ts`: world loading and presentation
- `src/components/HUD.ts`: main orchestration/UI controller
- `src/components/ScrapbookUI.ts`: scrapbook overlay

### Store
- `src/store/ScrapbookStore.ts`: IndexedDB wrapper for scrapbook pages

### Runtime/config
- `src/main.ts`: app startup
- `src/styles/style.css`: global styles
- `index.html`: page shell
- `vite.config.ts`: build/dev config

## How state works
Most state lives in memory inside behavior classes rather than in a central store.
Examples:
- current prompt text
- current world prompt
- current busy state
- whether placement is confirmed
- current spawned character
- current spawned world
- whether capture is enabled
Persistent state is intentionally small and limited to scrapbook pages.

## Strengths of the current architecture
- the user loop is easy to follow
- provider integrations are split into separate clients
- scene concerns and persistence concerns are separated
- the prototype is small enough to understand quickly
- the AR interaction model is straightforward

## Current tradeoffs
### Client-side orchestration
The browser directly calls the AI providers, which keeps the prototype simple but makes security, retries, and job resumption harder.

### Minimal persistence
The app stores scrapbook pages, but not provider job state, world metadata, or reusable sessions.

### Pragmatic world rendering
The world flow prefers collider mesh or a flat backdrop. That is enough to prove the idea, but it is not yet a high-fidelity rendering pipeline.

### Heavy `HUD` controller
`HUD` owns a large amount of orchestration logic. That is acceptable for a prototype, but a larger product would likely split this into services/view models.

## End-to-end request flow summary
### Character flow
1. user enters prompt
2. `HUD` calls Gemini for a cleaner image prompt
3. `HUD` calls Nano Banana for a reference image
4. `HUD` calls Rodin for 3D generation
5. `CharacterSpawner` loads and places the GLB

### World flow
1. user enters world prompt
2. `HUD` calls World Labs Marble
3. `WorldLabsClient` submits and polls the operation
4. `WorldLabsClient` fetches the finished world
5. `WorldSpawner` displays the returned assets

### Scrapbook flow
1. user taps capture
2. the canvas is captured
3. Nano Banana may polish the image
4. Gemini writes a caption
5. `ScrapbookStore` saves the page
6. `ScrapbookUI` displays it later

## One-sentence summaries
Product summary:
Barbie Storybook is a mobile web AR prototype that generates a Barbie character and matching world, places them in AR, and saves the result as a scrapbook page.

Codebase summary:
This repo is a client-side orchestration layer that connects WebXR placement, AI generation providers, and a small local scrapbook persistence system.
