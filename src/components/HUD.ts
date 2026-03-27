import { Behaviour, NeedleXRSession } from "@needle-tools/engine";
import { generateBarbiePromptPack, generateCaption, generateRodinImagePrompt } from "../api/GeminiClient";
import { generateReferenceImage, NanoBananaClientError, NanoBananaError, polishCaptureImage } from "../api/NanoBananaClient";
import { generateCharacterFromImage, RodinClientError, RodinError } from "../api/RodinClient";
import { generateWorld, WorldLabsClientError, WorldLabsError } from "../api/WorldLabsClient";
import { PRESET_CHARACTERS, getPresetCharacter, type PresetCharacterId } from "../presets/PresetCharacters";
import { savePage } from "../store/ScrapbookStore";
import { PRESET_WORLDS, getPresetWorld, type PresetWorldId } from "../presets/PresetWorlds";
import { ARPlacement } from "./ARPlacement";
import { CharacterSpawner } from "./CharacterSpawner";
import { SceneRig } from "./SceneRig";
import { ScrapbookUI } from "./ScrapbookUI";
import { WorldSpawner, WorldSpawnerError, WorldSpawnerErrorType } from "./WorldSpawner";

type SpeechRecognitionLike = EventTarget & {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
    interface Window {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
    }
}

export class HUD extends Behaviour {
    private root!: HTMLDivElement;
    private bottomSheet!: HTMLDivElement;
    private surfaceBadge!: HTMLDivElement;
    private sheetKicker!: HTMLDivElement;
    private sheetTitle!: HTMLDivElement;
    private arButton!: HTMLButtonElement;
    private galleryButton!: HTMLButtonElement;
    private magicButton!: HTMLButtonElement;
    private promptInput!: HTMLInputElement;
    private promptRow!: HTMLDivElement;
    private actionRow!: HTMLDivElement;
    private worldInput!: HTMLInputElement;
    private panelToggleButton!: HTMLButtonElement;
    private advancedPanel!: HTMLDivElement;
    private characterPresets!: HTMLDivElement;
    private worldBuilder!: HTMLDivElement;
    private presetCharacterButtons: HTMLButtonElement[] = [];
    private presetWorldButtons: HTMLButtonElement[] = [];
    private speakButton!: HTMLButtonElement;
    private addButton!: HTMLButtonElement;
    private buildWorldButton!: HTMLButtonElement;
    private captureButton!: HTMLButtonElement;
    private toast!: HTMLDivElement;

    private speechRecognition: SpeechRecognitionLike | null = null;
    private currentPrompt = "";
    private currentWorldPrompt = "";
    private captureEnabled = false;
    private isBusy = false;
    private isPanelExpanded = false;

    private readonly onSurfaceChange = (event: Event) => {
        const customEvent = event as CustomEvent<{ surfaceDetected: boolean; placementConfirmed: boolean }>;
        this.applySurfaceBadgeState(customEvent.detail.surfaceDetected, customEvent.detail.placementConfirmed);
    };

    awake(): void {
        this.injectStyles();
        this.injectMarkup();
        this.bindEvents();
        this.setupSpeechRecognition();
        this.applySurfaceBadgeState(ARPlacement.surfaceDetected, ARPlacement.placementConfirmed);
        this.updateARButton();
        this.setPanelExpanded(false);
        this.updateHudMode();
        this.updateActionState();
        window.requestAnimationFrame(() => {
            this.root.classList.add("is-ready");
        });
    }

    onDestroy(): void {
        ARPlacement.events.removeEventListener("surfacechange", this.onSurfaceChange);
        this.root?.remove();
        this.speechRecognition?.abort();
    }

    onEnterXR(): void {
        this.updateARButton();
        this.setPanelExpanded(false);
        this.updateHudMode();
    }

    onLeaveXR(): void {
        this.updateARButton();
        this.setPanelExpanded(false);
        this.updateHudMode();
    }

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
                <div id="hud-sheet-header">
                    <div id="hud-sheet-copy">
                        <div id="hud-sheet-kicker">DOLL STUDIO</div>
                        <div id="hud-sheet-title">Place, pose, and capture</div>
                    </div>
                    <div id="hud-stage-rail" aria-hidden="true">
                        <span class="hud-stage-dot" data-stage-dot="placement">SCAN</span>
                        <span class="hud-stage-dot" data-stage-dot="doll">DOLL</span>
                        <span class="hud-stage-dot" data-stage-dot="capture">BOOK</span>
                    </div>
                    <div id="hud-sheet-actions">
                        <button id="panel-toggle-btn" type="button" aria-expanded="false">MORE</button>
                    </div>
                </div>
                <div id="hud-primary">
                    <div id="prompt-row">
                        <input id="prompt-input" type="text" placeholder="Describe a Barbie look..." autocomplete="off" />
                        <button id="speak-btn" type="button" aria-label="Hold to speak">HOLD</button>
                    </div>
                    <div id="action-row">
                        <button id="add-btn" type="button" disabled>ADD DOLL</button>
                        <button id="capture-btn" type="button" disabled>CAPTURE</button>
                    </div>
                </div>
                <div id="hud-advanced" aria-hidden="true">
                    <button id="magic-btn" type="button">MAKE FOR ME</button>
                    <div id="character-presets">
                        <div id="character-presets-label">PRESET DOLLS</div>
                        <div id="character-preset-row">
                            ${PRESET_CHARACTERS.map((preset) => `<button class="character-preset-btn" data-character-preset="${preset.id}" type="button">${preset.label}</button>`).join("")}
                        </div>
                    </div>
                    <div id="world-builder">
                        <input id="world-input" type="text" placeholder="Describe a Barbie world..." autocomplete="off" />
                        <div id="world-presets">
                            <div id="world-presets-label">PRESET WORLDS</div>
                            <div id="world-preset-row">
                                ${PRESET_WORLDS.map((preset) => `<button class="world-preset-btn" data-world-preset="${preset.id}" type="button">${preset.label}</button>`).join("")}
                            </div>
                        </div>
                        <button id="world-btn" type="button" disabled>BUILD WORLD</button>
                    </div>
                </div>
            </div>
            <div id="status-toast" hidden></div>
        `;

        this.getOverlayHost().append(root);
        this.root = root;
        this.bottomSheet = root.querySelector("#hud-bottom") as HTMLDivElement;
        this.surfaceBadge = root.querySelector("#surface-badge") as HTMLDivElement;
        this.sheetKicker = root.querySelector("#hud-sheet-kicker") as HTMLDivElement;
        this.sheetTitle = root.querySelector("#hud-sheet-title") as HTMLDivElement;
        this.arButton = root.querySelector("#ar-btn") as HTMLButtonElement;
        this.galleryButton = root.querySelector("#gallery-btn") as HTMLButtonElement;
        this.magicButton = root.querySelector("#magic-btn") as HTMLButtonElement;
        this.promptInput = root.querySelector("#prompt-input") as HTMLInputElement;
        this.promptRow = root.querySelector("#prompt-row") as HTMLDivElement;
        this.actionRow = root.querySelector("#action-row") as HTMLDivElement;
        this.panelToggleButton = root.querySelector("#panel-toggle-btn") as HTMLButtonElement;
        this.advancedPanel = root.querySelector("#hud-advanced") as HTMLDivElement;
        this.characterPresets = root.querySelector("#character-presets") as HTMLDivElement;
        this.presetCharacterButtons = Array.from(root.querySelectorAll(".character-preset-btn")) as HTMLButtonElement[];
        this.worldInput = root.querySelector("#world-input") as HTMLInputElement;
        this.worldBuilder = root.querySelector("#world-builder") as HTMLDivElement;
        this.presetWorldButtons = Array.from(root.querySelectorAll(".world-preset-btn")) as HTMLButtonElement[];
        this.speakButton = root.querySelector("#speak-btn") as HTMLButtonElement;
        this.addButton = root.querySelector("#add-btn") as HTMLButtonElement;
        this.buildWorldButton = root.querySelector("#world-btn") as HTMLButtonElement;
        this.captureButton = root.querySelector("#capture-btn") as HTMLButtonElement;
        this.toast = root.querySelector("#status-toast") as HTMLDivElement;
    }

    private bindEvents(): void {
        ARPlacement.events.addEventListener("surfacechange", this.onSurfaceChange);

        this.promptInput.addEventListener("input", () => {
            this.currentPrompt = this.promptInput.value.trim();
            this.updateActionState();
        });

        this.worldInput.addEventListener("input", () => {
            this.currentWorldPrompt = this.worldInput.value.trim();
            this.updateActionState();
        });

        this.galleryButton.addEventListener("click", () => {
            ScrapbookUI.toggle();
        });

        this.panelToggleButton.addEventListener("click", () => {
            this.setPanelExpanded(!this.isPanelExpanded);
        });

        this.magicButton.addEventListener("click", () => {
            void this.handleMagicPrompts();
        });

        this.arButton.addEventListener("click", () => {
            this.handleStartAR();
        });

        this.addButton.addEventListener("click", () => {
            void this.handleAddToScene();
        });

        this.buildWorldButton.addEventListener("click", () => {
            void this.handleBuildWorld();
        });

        this.presetCharacterButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const presetId = button.dataset.characterPreset as PresetCharacterId | undefined;
                if (!presetId) return;
                void this.handlePresetCharacter(presetId);
            });
        });

        this.presetWorldButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const presetId = button.dataset.worldPreset as PresetWorldId | undefined;
                if (!presetId) return;
                void this.handlePresetWorld(presetId);
            });
        });

        this.captureButton.addEventListener("click", () => {
            void this.handleCapture();
        });
    }

    private setupSpeechRecognition(): void {
        const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.speakButton.hidden = true;
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";
        recognition.onresult = (event) => {
            const transcript = event.results[0]?.[0]?.transcript?.trim();
            if (!transcript) return;
            this.promptInput.value = transcript;
            this.currentPrompt = transcript;
            this.updateActionState();
        };
        recognition.onend = () => {
            this.speakButton.classList.remove("is-listening");
        };
        recognition.onerror = () => {
            this.speakButton.classList.remove("is-listening");
        };

        const startListening = () => {
            try {
                recognition.start();
                this.speakButton.classList.add("is-listening");
            }
            catch {
                return;
            }
        };

        const stopListening = () => {
            recognition.stop();
            this.speakButton.classList.remove("is-listening");
        };

        this.speakButton.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            startListening();
        });
        this.speakButton.addEventListener("pointerup", stopListening);
        this.speakButton.addEventListener("pointercancel", stopListening);
        this.speakButton.addEventListener("pointerleave", stopListening);

        this.speechRecognition = recognition;
    }

    private async handleMagicPrompts(): Promise<void> {
        if (this.isBusy) return;

        this.isBusy = true;
        this.updateActionState();

        try {
            this.showToast("Dreaming up Barbie ideas...");
            const pack = await generateBarbiePromptPack(this.promptInput.value.trim() || this.worldInput.value.trim());
            this.promptInput.value = pack.characterPrompt;
            this.worldInput.value = pack.worldPrompt;
            this.currentPrompt = pack.characterPrompt;
            this.currentWorldPrompt = pack.worldPrompt;
            this.showToast("Prompt pair ready");
            window.setTimeout(() => this.hideToast(), 1400);
        }
        finally {
            this.isBusy = false;
            this.updateActionState();
        }
    }

    private async handleAddToScene(): Promise<void> {
        if (this.isBusy) return;

        if (!ARPlacement.placementConfirmed) {
            const placed = ARPlacement.instance?.confirmPlacement() ?? false;
            if (placed) {
                this.showToast("Scene placed");
                this.setPanelExpanded(false);
                this.updateHudMode();
                window.setTimeout(() => this.hideToast(), 1100);
            }
            else {
                this.showToast("Move iPhone until the pink ring appears");
                window.setTimeout(() => this.hideToast(), 1600);
            }
            return;
        }

        const prompt = this.promptInput.value.trim();
        if (!prompt) {
            this.showToast("Describe Barbie first");
            window.setTimeout(() => this.hideToast(), 1600);
            return;
        }

        this.isBusy = true;
        this.updateActionState();

        try {
            this.showToast("Designing Barbie...");
            const imagePrompt = await generateRodinImagePrompt(prompt);
            const referenceImage = await generateReferenceImage(imagePrompt, (status) => this.showToast(status));
            const glbUrl = await generateCharacterFromImage(referenceImage, imagePrompt, (status) => this.showToast(status));

            if (!CharacterSpawner.instance) {
                throw new Error("Character spawner is not ready.");
            }

            const placement = SceneRig.instance?.hasContent()
                ? SceneRig.instance.root.position.clone()
                : ARPlacement.lastHitPosition.clone();

            await CharacterSpawner.instance.spawnAt(glbUrl, placement);

            this.currentPrompt = prompt;
            this.currentWorldPrompt = this.worldInput.value.trim();
            this.captureEnabled = true;
            this.setPanelExpanded(false);
            this.updateHudMode();
            this.showToast("Barbie arrived");
            window.setTimeout(() => this.hideToast(), 1200);
        }
        catch (error) {
            const timedOut =
                (error instanceof RodinClientError && error.type === RodinError.Timeout) ||
                (error instanceof WorldLabsClientError && error.type === WorldLabsError.Timeout);
            const apiError =
                error instanceof RodinClientError ||
                error instanceof NanoBananaClientError ||
                error instanceof WorldLabsClientError;

            this.showToast(timedOut
                ? "Generation timed out, try again"
                : apiError
                    ? "Character generation failed"
                    : "Generation failed, try again");
            window.setTimeout(() => this.hideToast(), 2200);
        }
        finally {
            this.isBusy = false;
            this.updateActionState();
        }
    }

    private async handlePresetCharacter(presetId: PresetCharacterId): Promise<void> {
        if (this.isBusy) return;

        const preset = getPresetCharacter(presetId);
        if (!preset) {
            this.showToast("Preset doll missing");
            window.setTimeout(() => this.hideToast(), 1800);
            return;
        }

        if (!ARPlacement.placementConfirmed) {
            this.showToast("Tap a surface to place first");
            window.setTimeout(() => this.hideToast(), 1600);
            return;
        }

        this.isBusy = true;
        this.updateActionState();

        try {
            this.showToast(`Loading ${preset.prompt}...`);
            if (!CharacterSpawner.instance) {
                throw new Error("Character spawner is not ready.");
            }

            const placement = SceneRig.instance?.hasContent()
                ? SceneRig.instance.root.position.clone()
                : ARPlacement.lastHitPosition.clone();

            await CharacterSpawner.instance.spawnAt(preset.glbUrl, placement, {
                initialYRotation: preset.initialYRotation,
            });
            this.currentPrompt = preset.prompt;
            this.promptInput.value = preset.prompt;
            this.captureEnabled = true;
            this.setPanelExpanded(false);
            this.updateHudMode();
            this.showToast(`${preset.prompt} ready`);
            window.setTimeout(() => this.hideToast(), 1400);
        }
        catch {
            this.showToast("Preset doll failed to load");
            window.setTimeout(() => this.hideToast(), 2200);
        }
        finally {
            this.isBusy = false;
            this.updateActionState();
        }
    }

    private async handleBuildWorld(): Promise<void> {
        if (this.isBusy) return;

        const prompt = this.worldInput.value.trim();
        if (!prompt) return;

        if (!ARPlacement.placementConfirmed) {
            this.showToast("Tap a surface to place first");
            window.setTimeout(() => this.hideToast(), 1600);
            return;
        }

        this.isBusy = true;
        this.updateActionState();

        try {
            this.showToast("Dreaming world...");
            const world = await generateWorld(prompt, (status) => this.showToast(status));
            if (!WorldSpawner.instance) {
                throw new Error("World spawner is not ready.");
            }

            const placement = SceneRig.instance?.hasContent()
                ? SceneRig.instance.root.position.clone()
                : ARPlacement.lastHitPosition.clone();

            await WorldSpawner.instance.spawnAt(world, placement);
            this.currentWorldPrompt = prompt;
            this.setPanelExpanded(false);
            this.updateHudMode();
            this.showToast("World ready");
            window.setTimeout(() => this.hideToast(), 1400);
        }
        catch (error) {
            const timedOut = error instanceof WorldLabsClientError && error.type === WorldLabsError.Timeout;
            const displayFailed = error instanceof WorldSpawnerError && error.type === WorldSpawnerErrorType.DisplayError;
            this.showToast(
                timedOut
                    ? "World timed out, try again"
                    : displayFailed
                        ? "World built, but failed to display"
                        : "World generation failed"
            );
            window.setTimeout(() => this.hideToast(), 2200);
        }
        finally {
            this.isBusy = false;
            this.updateActionState();
        }
    }

    private async handlePresetWorld(presetId: PresetWorldId): Promise<void> {
        if (this.isBusy) return;

        const preset = getPresetWorld(presetId);
        if (!preset) {
            this.showToast("Preset world missing");
            window.setTimeout(() => this.hideToast(), 1800);
            return;
        }

        if (!ARPlacement.placementConfirmed) {
            this.showToast("Tap a surface to place first");
            window.setTimeout(() => this.hideToast(), 1600);
            return;
        }

        this.isBusy = true;
        this.updateActionState();

        try {
            this.showToast(`Loading ${preset.world.caption}...`);
            if (!WorldSpawner.instance) {
                throw new Error("World spawner is not ready.");
            }

            const placement = SceneRig.instance?.hasContent()
                ? SceneRig.instance.root.position.clone()
                : ARPlacement.lastHitPosition.clone();

            await WorldSpawner.instance.spawnAt(preset.world, placement);
            this.currentWorldPrompt = preset.world.caption;
            this.worldInput.value = preset.world.caption;
            this.setPanelExpanded(false);
            this.updateHudMode();
            this.showToast(`${preset.world.caption} ready`);
            window.setTimeout(() => this.hideToast(), 1400);
        }
        catch {
            this.showToast("Preset world failed to load");
            window.setTimeout(() => this.hideToast(), 2200);
        }
        finally {
            this.isBusy = false;
            this.updateActionState();
        }
    }

    private handleStartAR(): void {
        if (NeedleXRSession.active?.isAR) {
            NeedleXRSession.stop();
            this.updateARButton();
            return;
        }

        const nativeButton = this.findNativeARButton();
        if (nativeButton) {
            nativeButton.click();
            return;
        }

        void NeedleXRSession.start("immersive-ar").catch(() => {
            this.showToast("AR launch failed");
            window.setTimeout(() => this.hideToast(), 2000);
        });
    }

    private findNativeARButton(): HTMLButtonElement | null {
        const menuButton = this.context.menu?.querySelector?.('button[data-needle="webxr-ar-button"]');
        if (menuButton instanceof HTMLButtonElement) return menuButton;

        const documentButton = document.querySelector('button[data-needle="webxr-ar-button"]');
        if (documentButton instanceof HTMLButtonElement) return documentButton;

        return null;
    }

    private getOverlayHost(): HTMLElement {
        const host = this.context.domElement;
        if (host instanceof HTMLElement) return this.getOrCreateOverlayRoot(host);

        const needleEngine = document.querySelector("needle-engine");
        if (needleEngine instanceof HTMLElement) return this.getOrCreateOverlayRoot(needleEngine);

        return document.body;
    }

    private getOrCreateOverlayRoot(host: HTMLElement): HTMLElement {
        const existingRoot = Array.from(host.children).find((child) => child instanceof HTMLElement && child.id === "barbie-overlay-root");
        if (existingRoot instanceof HTMLElement) return existingRoot;

        const overlayRoot = document.createElement("div");
        overlayRoot.id = "barbie-overlay-root";
        overlayRoot.className = "desktop ar";
        overlayRoot.dataset.barbieOverlay = "true";
        host.append(overlayRoot);
        return overlayRoot;
    }

    private async handleCapture(): Promise<void> {
        if (this.isBusy || !this.captureEnabled || !this.currentPrompt) return;

        const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
        if (!canvas) {
            this.showToast("Canvas not ready yet");
            window.setTimeout(() => this.hideToast(), 1500);
            return;
        }

        this.isBusy = true;
        this.updateActionState();

        try {
            const capturedDataUrl = canvas.toDataURL("image/png");
            let polishedDataUrl = capturedDataUrl;

            try {
                polishedDataUrl = await polishCaptureImage(
                    capturedDataUrl,
                    this.currentPrompt,
                    this.currentWorldPrompt,
                    (status) => this.showToast(status)
                );
            }
            catch (error) {
                if (error instanceof NanoBananaClientError && error.type === NanoBananaError.InvalidResponse) {
                    polishedDataUrl = capturedDataUrl;
                }
                else {
                    polishedDataUrl = capturedDataUrl;
                }
            }

            this.showToast("Writing caption...");
            const caption = await generateCaption(this.currentPrompt);
            const base64 = polishedDataUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");

            await savePage({
                id: crypto.randomUUID(),
                imageBase64: base64,
                caption,
                characterPrompt: this.currentPrompt,
                timestamp: Date.now(),
            });

            this.showToast("Saved to your book");
            window.setTimeout(() => this.hideToast(), 2000);
        }
        catch {
            this.showToast("Capture failed, try again");
            window.setTimeout(() => this.hideToast(), 2000);
        }
        finally {
            this.isBusy = false;
            this.updateActionState();
        }
    }

    private applySurfaceBadgeState(surfaceDetected: boolean, placementConfirmed: boolean): void {
        if (placementConfirmed) {
            this.surfaceBadge.textContent = "PLACED";
            this.surfaceBadge.classList.remove("is-ready");
            this.surfaceBadge.classList.add("is-placed");
            return;
        }

        this.surfaceBadge.textContent = surfaceDetected ? "SURFACE" : "SCANNING";
        this.surfaceBadge.classList.toggle("is-ready", surfaceDetected);
        this.surfaceBadge.classList.remove("is-placed");
    }

    private updateActionState(): void {
        this.magicButton.disabled = this.isBusy;
        this.addButton.disabled = !ARPlacement.placementConfirmed
            ? this.isBusy || !ARPlacement.surfaceDetected
            : this.isBusy || this.promptInput.value.trim().length === 0;
        this.buildWorldButton.disabled = this.isBusy || this.worldInput.value.trim().length === 0;
        this.presetCharacterButtons.forEach((button) => {
            button.disabled = this.isBusy;
        });
        this.presetWorldButtons.forEach((button) => {
            button.disabled = this.isBusy;
        });
        this.captureButton.disabled = this.isBusy || !this.captureEnabled;
        this.updateHudMode();
    }

    private updateARButton(): void {
        this.arButton.textContent = NeedleXRSession.active?.isAR ? "EXIT AR" : "START AR";
    }

    private setPanelExpanded(expanded: boolean): void {
        this.isPanelExpanded = expanded;
        this.bottomSheet.classList.toggle("is-expanded", expanded);
        this.advancedPanel.setAttribute("aria-hidden", String(!expanded));
        this.panelToggleButton.setAttribute("aria-expanded", String(expanded));
        this.updateHudMode();
    }

    private updateHudMode(): void {
        const isArSession = !!NeedleXRSession.active?.isAR;
        const hasPlacedDoll = !!CharacterSpawner.instance?.spawnedObject;
        const captureMode = this.captureEnabled && hasPlacedDoll;
        const compactArMode = isArSession && !this.isPanelExpanded;
        const placementConfirmed = ARPlacement.placementConfirmed;
        const scanningOnly = isArSession && !placementConfirmed;

        let stage = "setup";
        let kicker = "DOLL STUDIO";
        let title = "Place, pose, and capture";
        let panelLabel = this.isPanelExpanded ? "BACK" : "MORE";

        if (!placementConfirmed) {
            stage = "placement";
            kicker = "SCAN";
            title = ARPlacement.surfaceDetected ? "Tap to place your scene" : "Move iPhone to start";
        }
        else if (!hasPlacedDoll) {
            stage = "doll";
            kicker = "PLACE";
            title = this.isPanelExpanded ? "Choose a preset doll or world" : "Add a doll to start composing";
        }
        else if (captureMode) {
            stage = "capture";
            kicker = "CAPTURE";
            title = this.isPanelExpanded ? "Add presets, then jump back to capture" : "Drag, pinch, and twist to frame the shot";
        }

        if (this.isPanelExpanded) {
            stage = "advanced";
            kicker = captureMode ? "SCENE" : "DOLLS";
            title = captureMode ? "Choose a backdrop or preset scene" : "Choose a preset Barbie";
        }

        this.sheetKicker.textContent = kicker;
        this.sheetTitle.textContent = title;
        if (!this.isPanelExpanded) {
            panelLabel = !placementConfirmed ? "MORE" : hasPlacedDoll ? "SCENE" : "DOLLS";
        }
        this.panelToggleButton.textContent = panelLabel;
        this.panelToggleButton.hidden = !placementConfirmed;
        this.panelToggleButton.disabled = this.isBusy;

        if (!placementConfirmed) {
            this.addButton.textContent = ARPlacement.surfaceDetected ? "TAP TO PLACE" : "SCAN SURFACE";
        }
        else if (captureMode) {
            this.addButton.textContent = "ADD ANOTHER DOLL";
        }
        else {
            this.addButton.textContent = "ADD DOLL";
        }

        this.captureButton.textContent = captureMode ? "CAPTURE PAGE" : "CAPTURE";

        const showCharacterTools = this.isPanelExpanded && placementConfirmed && !captureMode;
        const showSceneTools = this.isPanelExpanded && placementConfirmed && captureMode;

        this.promptRow.classList.toggle("is-hidden", scanningOnly || captureMode || compactArMode || this.isPanelExpanded);
        this.actionRow.classList.toggle("is-capture-mode", captureMode);
        this.addButton.classList.toggle("is-hidden", captureMode);
        this.captureButton.classList.toggle("is-hidden", !captureMode);
        this.characterPresets.hidden = !showCharacterTools;
        this.magicButton.hidden = !showCharacterTools;
        this.worldBuilder.hidden = !showSceneTools;
        this.bottomSheet.classList.toggle("is-ar-session", isArSession);
        this.bottomSheet.classList.toggle("is-compact", compactArMode);
        this.bottomSheet.classList.toggle("is-capture-mode", captureMode);
        this.bottomSheet.classList.toggle("is-placement-stage", scanningOnly);
        this.bottomSheet.classList.toggle("is-tool-stage", this.isPanelExpanded);
        this.bottomSheet.classList.toggle("is-subpanel", this.isPanelExpanded);
        this.bottomSheet.dataset.stage = stage;

        Array.from(this.root.querySelectorAll<HTMLElement>(".hud-stage-dot")).forEach((dot) => {
            const dotStage = dot.dataset.stageDot;
            const active =
                (stage === "placement" && dotStage === "placement") ||
                ((stage === "doll" || stage === "advanced") && dotStage === "doll") ||
                (stage === "capture" && dotStage === "capture");
            dot.classList.toggle("is-active", active);
            dot.classList.toggle("is-complete", placementConfirmed && dotStage === "placement" && stage !== "placement");
            dot.classList.toggle("is-complete", hasPlacedDoll && dotStage === "doll" && stage === "capture");
        });
    }

    private showToast(message: string): void {
        this.toast.hidden = false;
        this.toast.textContent = message;
    }

    private hideToast(): void {
        this.toast.hidden = true;
    }

    private injectStyles(): void {
        if (document.getElementById("barbie-hud-styles")) return;

        const style = document.createElement("style");
        style.id = "barbie-hud-styles";
        style.textContent = `
            #barbie-hud {
                position: fixed;
                inset: 0;
                z-index: 80;
                pointer-events: none;
            }

            #barbie-hud *,
            #barbie-hud *::before,
            #barbie-hud *::after {
                box-sizing: border-box;
            }

            #barbie-hud button,
            #barbie-hud input {
                font-family: "DM Mono", monospace;
                min-height: 44px;
            }

            #hud-top,
            #hud-bottom {
                pointer-events: auto;
            }

            #hud-top {
                position: fixed;
                top: calc(env(safe-area-inset-top, 0px) + 12px);
                left: 12px;
                right: 12px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 10px;
                opacity: 0;
                transform: translateY(-12px);
                transition: opacity 0.34s ease, transform 0.34s ease;
            }

            #barbie-hud.is-ready #hud-top {
                opacity: 1;
                transform: translateY(0);
            }

            #top-actions {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            #surface-badge,
            #ar-btn,
            #gallery-btn {
                min-height: 42px;
                padding: 0 14px;
                border-radius: 18px;
            }

            #surface-badge {
                background: rgba(20,0,16,0.8);
                border: 1px solid rgba(255,36,114,0.3);
                color: rgba(255,255,255,0.6);
                font-size: 11px;
                letter-spacing: 2.2px;
                transition: color 0.3s ease, border-color 0.3s ease;
            }

            #surface-badge.is-ready {
                color: #4ADE80;
                border-color: rgba(74,222,128,0.4);
            }

            #surface-badge.is-placed {
                color: #f9a8d4;
                border-color: rgba(249,168,212,0.45);
            }

            #gallery-btn {
                border: 1px solid rgba(255,255,255,0.18);
                background: rgba(12,0,8,0.62);
                color: white;
                letter-spacing: 1px;
            }

            button[data-needle="webxr-ar-button"] {
                position: fixed !important;
                width: 1px !important;
                height: 1px !important;
                padding: 0 !important;
                margin: 0 !important;
                border: 0 !important;
                opacity: 0 !important;
                pointer-events: none !important;
                overflow: hidden !important;
                clip-path: inset(50%) !important;
            }

            #ar-btn {
                border: 1px solid rgba(255,36,114,0.38);
                background: rgba(255,36,114,0.22);
                color: #ffd6e7;
                letter-spacing: 1px;
            }

            #hud-bottom {
                position: fixed;
                left: 50%;
                transform: translateX(-50%) translateY(24px) scale(0.98);
                bottom: calc(env(safe-area-inset-bottom, 0px) + 14px);
                width: min(calc(100vw - 24px), 560px);
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 14px;
                border-radius: 28px;
                border: 1px solid rgba(255, 214, 231, 0.16);
                background:
                    linear-gradient(180deg, rgba(38, 6, 24, 0.92), rgba(18, 3, 14, 0.96)),
                    rgba(10, 0, 8, 0.9);
                box-shadow: 0 18px 48px rgba(0, 0, 0, 0.32);
                backdrop-filter: blur(18px);
                max-height: min(76vh, 620px);
                overflow-y: auto;
                opacity: 0;
                transition:
                    opacity 0.34s ease,
                    transform 0.38s cubic-bezier(0.2, 0.9, 0.2, 1),
                    width 0.28s ease,
                    padding 0.28s ease,
                    gap 0.28s ease,
                    border-radius 0.28s ease,
                    box-shadow 0.28s ease;
            }

            #barbie-hud.is-ready #hud-bottom {
                opacity: 1;
                transform: translateX(-50%) translateY(0) scale(1);
            }

            #hud-bottom.is-ar-session.is-compact {
                width: auto;
                min-width: min(320px, calc(100vw - 24px));
                max-width: calc(100vw - 24px);
                padding: 10px;
                gap: 8px;
                border-radius: 22px;
                max-height: none;
                overflow: visible;
                box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24);
            }

            #hud-bottom.is-subpanel {
                width: min(calc(100vw - 24px), 520px);
                gap: 10px;
            }

            #hud-sheet-header,
            #hud-sheet-actions,
            #prompt-row,
            #action-row {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            #hud-sheet-header {
                justify-content: space-between;
                align-items: flex-start;
                gap: 12px;
            }

            #hud-stage-rail {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-left: auto;
                margin-right: 4px;
                transition: opacity 0.22s ease, transform 0.24s ease;
            }

            #hud-bottom.is-ar-session.is-compact #hud-sheet-header {
                align-items: center;
                gap: 8px;
            }

            #hud-sheet-copy {
                display: flex;
                flex-direction: column;
                gap: 4px;
                transition: opacity 0.22s ease, transform 0.22s ease, filter 0.22s ease;
            }

            #hud-bottom.is-ar-session.is-compact #hud-sheet-copy {
                opacity: 0;
                transform: translateY(-6px);
                pointer-events: none;
                position: absolute;
            }

            #hud-bottom.is-ar-session.is-compact #hud-sheet-actions {
                width: 100%;
                justify-content: flex-end;
            }

            #hud-bottom.is-ar-session.is-compact #hud-stage-rail {
                opacity: 1;
                transform: translateY(0);
            }

            #hud-bottom.is-ar-session.is-compact #panel-toggle-btn {
                min-width: 92px;
            }

            .hud-stage-dot {
                min-height: 30px;
                padding: 0 10px;
                border-radius: 999px;
                border: 1px solid rgba(255,255,255,0.08);
                background: rgba(255,255,255,0.04);
                color: rgba(255,255,255,0.45);
                font-size: 10px;
                letter-spacing: 1.4px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition:
                    background 0.24s ease,
                    border-color 0.24s ease,
                    color 0.24s ease,
                    transform 0.24s ease,
                    box-shadow 0.24s ease;
            }

            .hud-stage-dot.is-active {
                background: rgba(255,36,114,0.22);
                border-color: rgba(255,36,114,0.35);
                color: #fff1f7;
                transform: translateY(-1px);
                box-shadow: 0 8px 20px rgba(255, 36, 114, 0.18);
            }

            .hud-stage-dot.is-complete:not(.is-active) {
                background: rgba(74,222,128,0.12);
                border-color: rgba(74,222,128,0.24);
                color: rgba(214,255,231,0.9);
            }

            #hud-sheet-kicker,
            #character-presets-label,
            #world-presets-label {
                color: rgba(255,255,255,0.48);
                font-size: 11px;
                letter-spacing: 2px;
            }

            #hud-sheet-title {
                color: #fff2f7;
                font-size: 13px;
                letter-spacing: 0.4px;
            }

            #panel-toggle-btn,
            #magic-btn,
            #world-btn,
            #speak-btn,
            #add-btn,
            #capture-btn,
            .character-preset-btn,
            .world-preset-btn {
                border-radius: 18px;
            }

            #panel-toggle-btn {
                padding: 0 14px;
                border: 1px solid rgba(255,255,255,0.14);
                background: rgba(255,255,255,0.08);
                color: white;
                font-size: 12px;
                letter-spacing: 1px;
                transition:
                    transform 0.18s ease,
                    background 0.22s ease,
                    border-color 0.22s ease,
                    color 0.22s ease;
            }

            #panel-toggle-btn {
                border-color: rgba(255,36,114,0.28);
                background: rgba(255,36,114,0.18);
                color: #ffd6e7;
            }

            #hud-primary,
            #hud-advanced,
            #character-presets,
            #world-builder,
            #world-presets {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            #hud-bottom.is-ar-session.is-compact #hud-primary {
                gap: 8px;
            }

            #hud-bottom.is-subpanel #hud-primary {
                max-height: 0;
                opacity: 0;
                overflow: hidden;
                pointer-events: none;
                transform: translateY(8px);
                margin: 0;
            }

            #hud-bottom.is-placement-stage {
                width: min(calc(100vw - 24px), 420px);
                padding-top: 12px;
                padding-bottom: 12px;
            }

            #hud-bottom.is-placement-stage #hud-primary {
                gap: 6px;
            }

            #hud-bottom.is-placement-stage #action-row {
                justify-content: stretch;
            }

            #hud-bottom.is-placement-stage #add-btn {
                width: 100%;
                flex: 1 1 100%;
            }

            #hud-bottom.is-tool-stage #hud-sheet-copy {
                filter: saturate(1.15);
            }

            #hud-primary > *,
            #hud-advanced > * {
                transition:
                    opacity 0.22s ease,
                    transform 0.26s cubic-bezier(0.2, 0.9, 0.2, 1),
                    max-height 0.24s ease,
                    margin 0.24s ease,
                    padding 0.24s ease;
            }

            #hud-primary > *:nth-child(1),
            #hud-advanced > *:nth-child(1) {
                transition-delay: 0.02s;
            }

            #hud-primary > *:nth-child(2),
            #hud-advanced > *:nth-child(2) {
                transition-delay: 0.05s;
            }

            #hud-advanced > *:nth-child(3) {
                transition-delay: 0.08s;
            }

            #hud-advanced {
                max-height: 0;
                opacity: 0;
                overflow: hidden;
                padding-top: 0;
                border-top: 1px solid rgba(255,255,255,0);
                transform: translateY(8px);
                pointer-events: none;
                transition:
                    max-height 0.34s cubic-bezier(0.2, 0.9, 0.2, 1),
                    opacity 0.22s ease,
                    transform 0.28s ease,
                    padding-top 0.24s ease,
                    border-color 0.24s ease;
            }

            #hud-bottom.is-expanded #hud-advanced {
                max-height: 420px;
                opacity: 1;
                padding-top: 10px;
                border-top-color: rgba(255,255,255,0.08);
                transform: translateY(0);
                pointer-events: auto;
            }

            #hud-bottom.is-subpanel #hud-advanced {
                max-height: 460px;
            }

            #character-preset-row,
            #world-preset-row {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }

            .character-preset-btn,
            .world-preset-btn {
                border: 1px solid rgba(255, 214, 231, 0.35);
                background: rgba(255, 214, 231, 0.1);
                color: #fff1f7;
                padding: 10px 14px;
                letter-spacing: 1px;
            }

            #prompt-input,
            #world-input {
                width: 100%;
                border: 1px solid rgba(255,255,255,0.15);
                background: rgba(255,255,255,0.07);
                color: white;
                padding: 12px 16px;
                font-size: 14px;
                min-width: 0;
                border-radius: 18px;
                transition:
                    border-color 0.2s ease,
                    background 0.2s ease,
                    transform 0.18s ease;
            }

            #prompt-input {
                flex: 1;
            }

            #prompt-input::placeholder,
            #world-input::placeholder {
                color: rgba(255,255,255,0.45);
            }

            #speak-btn {
                min-width: 70px;
                border: 1px solid rgba(255,255,255,0.15);
                background: rgba(255,255,255,0.08);
                color: white;
                letter-spacing: 1px;
            }

            #speak-btn.is-listening {
                background: rgba(239,68,68,0.88);
                border-color: rgba(255,255,255,0.24);
            }

            #add-btn,
            #world-btn {
                flex: 1;
                border: 1px solid rgba(255,36,114,0.4);
                background: rgba(255,36,114,0.18);
                color: #FFADD0;
                transition:
                    opacity 0.22s ease,
                    transform 0.24s ease,
                    background 0.22s ease,
                    border-color 0.22s ease,
                    color 0.22s ease;
            }

            #prompt-row.is-hidden,
            #add-btn.is-hidden,
            #capture-btn.is-hidden {
                opacity: 0;
                transform: translateY(10px) scale(0.98);
                pointer-events: none;
                max-height: 0;
                margin: 0;
                padding-top: 0;
                padding-bottom: 0;
                overflow: hidden;
            }

            #hud-bottom.is-ar-session.is-compact #add-btn,
            #hud-bottom.is-ar-session.is-compact #capture-btn {
                min-width: 148px;
            }

            #magic-btn {
                border: 1px solid rgba(255,214,231,0.32);
                background: linear-gradient(135deg, rgba(255,214,231,0.12), rgba(255,36,114,0.2));
                color: #fff1f7;
                letter-spacing: 1px;
            }

            #add-btn:not(:disabled),
            #world-btn:not(:disabled) {
                background: rgba(255,36,114,0.24);
            }

            #capture-btn {
                border: none;
                background: white;
                color: #0C0008;
                font-weight: 600;
                transition:
                    opacity 0.22s ease,
                    transform 0.24s ease,
                    background 0.22s ease,
                    color 0.22s ease,
                    box-shadow 0.22s ease;
            }

            #world-btn {
                width: 100%;
            }

            #hud-bottom[data-stage="placement"] #add-btn:not(:disabled) {
                background: linear-gradient(135deg, rgba(255,36,114,0.2), rgba(255,214,231,0.16));
                border-color: rgba(255,214,231,0.28);
                color: #fff1f7;
            }

            #hud-bottom[data-stage="capture"] #capture-btn:not(:disabled) {
                box-shadow: 0 14px 32px rgba(255, 255, 255, 0.18);
                transform: translateY(-1px);
            }

            #magic-btn:disabled,
            #add-btn:disabled,
            #world-btn:disabled,
            #capture-btn:disabled,
            .character-preset-btn:disabled,
            .world-preset-btn:disabled {
                opacity: 0.4;
            }

            #barbie-hud button:not(:disabled):active {
                transform: scale(0.98);
            }

            #status-toast {
                position: fixed;
                top: calc(env(safe-area-inset-top, 0px) + 84px);
                left: 50%;
                transform: translateX(-50%);
                max-width: min(calc(100vw - 48px), 360px);
                padding: 12px 24px;
                border-radius: 12px;
                border: 1px solid rgba(255,36,114,0.3);
                background: rgba(20,0,16,0.95);
                color: white;
                font-size: 13px;
                text-align: center;
                pointer-events: none;
                z-index: 90;
                opacity: 0;
                transform: translateX(-50%) translateY(-8px);
                transition: opacity 0.22s ease, transform 0.22s ease;
            }

            #status-toast:not([hidden]) {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }

            #hud-bottom[data-stage="capture"] {
                box-shadow: 0 12px 30px rgba(0, 0, 0, 0.26);
            }

            @media (max-width: 520px) {
                #hud-top {
                    gap: 8px;
                }

                #hud-bottom {
                    width: calc(100vw - 20px);
                    bottom: calc(env(safe-area-inset-bottom, 0px) + 10px);
                    padding: 12px;
                    border-radius: 24px;
                }

                #hud-sheet-header {
                    flex-direction: column;
                    align-items: stretch;
                }

                #hud-sheet-actions {
                    justify-content: space-between;
                }

                #panel-toggle-btn {
                    flex: 1;
                }

                #hud-bottom.is-ar-session.is-compact {
                    min-width: 0;
                    width: calc(100vw - 20px);
                }

                #hud-bottom.is-ar-session.is-compact #hud-sheet-header {
                    flex-direction: row;
                    align-items: center;
                }
            }

            @media (prefers-reduced-motion: reduce) {
                #barbie-hud *,
                #barbie-hud *::before,
                #barbie-hud *::after {
                    transition: none !important;
                    animation: none !important;
                }
            }
        `;

        document.head.append(style);
    }
}
