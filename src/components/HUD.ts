import { Behaviour, NeedleXRSession } from "@needle-tools/engine";
import { generateBarbiePromptPack, generateCaption, generateRodinImagePrompt } from "../api/GeminiClient";
import { generateReferenceImage, NanoBananaClientError, NanoBananaError, polishCaptureImage } from "../api/NanoBananaClient";
import { generateCharacterFromImage, RodinClientError, RodinError } from "../api/RodinClient";
import { generateWorld, WorldLabsClientError, WorldLabsError } from "../api/WorldLabsClient";
import { savePage } from "../store/ScrapbookStore";
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
    private surfaceBadge!: HTMLDivElement;
    private arButton!: HTMLButtonElement;
    private galleryButton!: HTMLButtonElement;
    private magicButton!: HTMLButtonElement;
    private promptInput!: HTMLInputElement;
    private worldInput!: HTMLInputElement;
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
        this.updateActionState();
    }

    onDestroy(): void {
        ARPlacement.events.removeEventListener("surfacechange", this.onSurfaceChange);
        this.root?.remove();
        this.speechRecognition?.abort();
    }

    onEnterXR(): void {
        this.updateARButton();
    }

    onLeaveXR(): void {
        this.updateARButton();
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

        const prompt = this.promptInput.value.trim();
        if (!prompt) return;

        if (!ARPlacement.placementConfirmed) {
            this.showToast("Tap a surface to place first");
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

            await CharacterSpawner.instance.spawnAt(glbUrl, ARPlacement.lastHitPosition.clone());

            this.currentPrompt = prompt;
            this.currentWorldPrompt = this.worldInput.value.trim();
            this.captureEnabled = true;
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
            const capturedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
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
        this.addButton.disabled = this.isBusy || this.promptInput.value.trim().length === 0;
        this.buildWorldButton.disabled = this.isBusy || this.worldInput.value.trim().length === 0;
        this.captureButton.disabled = this.isBusy || !this.captureEnabled;
    }

    private updateARButton(): void {
        this.arButton.textContent = NeedleXRSession.active?.isAR ? "EXIT AR" : "START AR";
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

            #barbie-hud button,
            #barbie-hud input {
                font-family: "DM Mono", monospace;
                border-radius: 100px;
                min-height: 44px;
            }

            #hud-top,
            #hud-bottom {
                pointer-events: auto;
            }

            #hud-top {
                position: fixed;
                top: 16px;
                left: 16px;
                right: 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
            }

            #top-actions {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            #surface-badge,
            #ar-btn,
            #gallery-btn,
            #magic-btn {
                padding: 10px 16px;
            }

            #surface-badge {
                background: rgba(20,0,16,0.85);
                border: 1px solid rgba(255,36,114,0.3);
                color: rgba(255,255,255,0.6);
                font-size: 11px;
                letter-spacing: 2px;
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
                background: rgba(12,0,8,0.72);
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
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                flex-direction: column;
                gap: 10px;
                padding: 16px 16px 32px;
                background: rgba(10,0,8,0.9);
                backdrop-filter: blur(12px);
            }

            #magic-btn {
                border: 1px solid rgba(255,214,231,0.4);
                background: linear-gradient(135deg, rgba(255,214,231,0.18), rgba(255,36,114,0.22));
                color: #fff1f7;
                letter-spacing: 1px;
            }

            #prompt-row,
            #action-row {
                display: flex;
                gap: 10px;
            }

            #prompt-input,
            #world-input {
                width: 100%;
                border: 1px solid rgba(255,255,255,0.15);
                background: rgba(255,255,255,0.08);
                color: white;
                padding: 12px 16px;
                font-size: 14px;
                min-width: 0;
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
                background: rgba(255,36,114,0.15);
                color: #FFADD0;
            }

            #add-btn:not(:disabled),
            #world-btn:not(:disabled) {
                background: rgba(255,36,114,0.25);
            }

            #capture-btn {
                border: none;
                background: white;
                color: #0C0008;
                font-weight: 600;
            }

            #magic-btn:disabled,
            #add-btn:disabled,
            #world-btn:disabled,
            #capture-btn:disabled {
                opacity: 0.4;
            }

            #status-toast {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                max-width: calc(100vw - 48px);
                padding: 12px 24px;
                border-radius: 12px;
                border: 1px solid rgba(255,36,114,0.3);
                background: rgba(20,0,16,0.95);
                color: white;
                font-size: 13px;
                text-align: center;
                pointer-events: none;
                z-index: 90;
            }
        `;

        document.head.append(style);
    }
}
