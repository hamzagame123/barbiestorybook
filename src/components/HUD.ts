import { Behaviour, NeedleXRSession, screenshot2 } from "@needle-tools/engine";
import * as THREE from "three";
import { NanoBananaClientError, NanoBananaError, generateBackdropPanorama, generateReferenceImage, polishCaptureImage } from "../api/NanoBananaClient";
import {
    connectLiveNarrator,
    disconnectLiveNarrator,
    generateNarratorReply,
    getLiveNarratorStatus,
    isLiveNarratorMicActive,
    preferChatNarrator,
    sendLiveNarratorText,
    subscribeToLiveNarrator,
    type NarratorTurn,
    type LiveNarratorEvent,
    type LiveNarratorStatus,
} from "../api/NarratorClient";
import { generateCharacter, generateCharacterFromImage } from "../api/RodinClient";
import { getPresetBackground, PRESET_BACKGROUNDS, type PresetBackgroundId } from "../presets/PresetBackgrounds";
import { PRESET_CHARACTERS, getPresetCharacter, type PresetCharacterId } from "../presets/PresetCharacters";
import { LIBRARY_ACCESSORIES, type LibraryAccessoryId } from "../presets/LibraryAccessories";
import { getPresetStageProp, type PresetStagePropId } from "../presets/PresetStageProps";
import { savePage } from "../store/ScrapbookStore";
import { logDebug } from "../utils/DebugLog";
import { playSfx } from "../utils/AudioPlayer";
import { AccessorySpawner } from "./AccessorySpawner";
import { ARPlacement } from "./ARPlacement";
import { BackgroundSpawner } from "./BackgroundSpawner";
import { CharacterSpawner } from "./CharacterSpawner";
import { LibraryUI, type LibrarySelectEventDetail } from "./LibraryUI";
import { SceneRig } from "./SceneRig";
import { ScrapbookUI } from "./ScrapbookUI";
import { SceneGestures } from "./SceneGestures";
import { StagePropSpawner } from "./StagePropSpawner";
import logoStorybookUrl from "../assets/ui/new-pack/logo-storybook.png?url";
import glimmerAvatarUrl from "../assets/ui/new-pack/glimmer-avatar.png?url";
import glimmerStateHappyUrl from "../assets/ui/new-pack/glimmer-state-happy.png?url";
import glimmerStateListeningUrl from "../assets/ui/new-pack/glimmer-state-listening.png?url";
import glimmerStateSpeakingUrl from "../assets/ui/new-pack/glimmer-state-speaking.png?url";
import glimmerStateThinkingUrl from "../assets/ui/new-pack/glimmer-state-thinking.png?url";
import glimmerStateSadUrl from "../assets/ui/new-pack/glimmer-state-sad.png?url";
import glimmerStateIdleUrl from "../assets/ui/new-pack/glimmer-state-idle.png?url";
import iconMenuUrl from "../assets/ui/new-pack/icon-menu.png?url";
import iconBookUrl from "../assets/ui/new-pack/icon-book.png?url";
import iconCloseUrl from "../assets/ui/new-pack/icon-close.png?url";
import iconHelpUrl from "../assets/ui/new-pack/icon-help.png?url";
import iconScanUrl from "../assets/ui/new-pack/icon-scan.png?url";
import iconCameraUrl from "../assets/ui/new-pack/icon-camera.png?url";
import iconBearUrl from "../assets/ui/new-pack/icon-bear.png?url";
import iconHeartUrl from "../assets/ui/new-pack/icon-heart.png?url";
import iconMicUrl from "../assets/ui/new-pack/icon-mic.png?url";
import iconSendUrl from "../assets/ui/new-pack/icon-send.png?url";
import iconWandUrl from "../assets/ui/new-pack/icon-wand.png?url";
import iconStarUrl from "../assets/ui/new-pack/icon-star.png?url";
import iconGearUrl from "../assets/ui/new-pack/icon-gear.png?url";
import iconBackUrl from "../assets/ui/new-pack/icon-back.png?url";
import scanCornersUrl from "../assets/ui/new-pack/scan-corners-tall.png?url";
import pillPrimaryUrl from "../assets/ui/new-pack/pill-primary.png?url";
import pillSecondaryUrl from "../assets/ui/new-pack/pill-secondary.png?url";
import cardFrameUrl from "../assets/ui/new-pack/card-frame.png?url";

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

type CaptureViewportState = {
    canvasWidth: number;
    canvasHeight: number;
    styleWidth: string;
    styleHeight: string;
    rendererWidth: number;
    rendererHeight: number;
    cameraAspect: number | null;
};

type OverlayScreen = "glimmer" | "library" | "storybook" | null;

declare global {
    interface Window {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
    }
}

export class HUD extends Behaviour {
    private static readonly ACCESSORY_SPAWN_OFFSET = new THREE.Vector3(0.18, 0, 0);

    private root!: HTMLDivElement;
    private bottomSheet!: HTMLDivElement;
    private sheetHeader!: HTMLDivElement;
    private homeScreen!: HTMLDivElement;
    private scanScreen!: HTMLDivElement;
    private stageScreen!: HTMLDivElement;
    private scanOverlayFrame!: HTMLImageElement;
    private surfaceBadge!: HTMLDivElement;
    private sheetKicker!: HTMLDivElement;
    private sheetTitle!: HTMLDivElement;
    private narratorStatusBadge!: HTMLSpanElement;
    private narratorLiveButton!: HTMLButtonElement;
    private narratorSendButton!: HTMLButtonElement;
    private narratorOutput!: HTMLDivElement;
    private narratorIdeasBoard!: HTMLDivElement;
    private narratorAvatar!: HTMLImageElement;
    private arButton!: HTMLButtonElement;
    private promptInput!: HTMLInputElement;
    private glimmerPromptInput!: HTMLInputElement;
    private promptRow!: HTMLDivElement;
    private actionRow!: HTMLDivElement;
    private objectSelectionRow!: HTMLDivElement;
    private worldPanel!: HTMLDivElement;
    private worldPromptInput!: HTMLInputElement;
    private worldGenerateButton!: HTMLButtonElement;
    private propsPanel!: HTMLDivElement;
    private propsPromptInput!: HTMLInputElement;
    private propsGenerateButton!: HTMLButtonElement;
    private panelToggleButton!: HTMLButtonElement;
    private advancedPanel!: HTMLDivElement;
    private speakButton!: HTMLButtonElement;
    private addButton!: HTMLButtonElement;
    private worldButton!: HTMLButtonElement;
    private dollButton!: HTMLButtonElement;
    private bookButton!: HTMLButtonElement;
    private captureButton!: HTMLButtonElement;
    private toast!: HTMLDivElement;

    private speechRecognition: SpeechRecognitionLike | null = null;
    private removeNarratorSubscription: (() => void) | null = null;
    private currentPrompt = "";
    private currentWorldPrompt = "";
    private worldPanelOpen = false;
    private propsPanelOpen = false;
    private narratorLatestText = "";
    private narratorStatus: LiveNarratorStatus = "offline";
    private narratorHistory: NarratorTurn[] = [];
    private narratorDebugLines: string[] = [];
    private narratorSpeaking = false;
    private narratorLastResponseAt = 0;
    private backdropBuildNonce = 0;
    private captureEnabled = false;
    private isBusy = false;
    private isPanelExpanded = false;
    private activeOverlayScreen: OverlayScreen = null;
    private sheetDragStartY: number | null = null;
    private sheetDragDeltaY = 0;
    private lastSpawnWorldPosition: THREE.Vector3 | null = null;
    private readonly preventSelectionEvent = (event: Event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest("input, textarea, [contenteditable='true']")) return;
        event.preventDefault();
    };

    private readonly onSurfaceChange = (event: Event) => {
        const customEvent = event as CustomEvent<{ surfaceDetected: boolean; placementConfirmed: boolean }>;
        this.applySurfaceBadgeState(customEvent.detail.surfaceDetected, customEvent.detail.placementConfirmed);
        if (customEvent.detail.placementConfirmed) {
            this.setPanelExpanded(false);
        }
        this.updateActionState();
    };

    private readonly onSelectionChange = () => {
        this.updateSelectionUI();
    };

    private readonly onLibraryVisibilityChange = (event: Event) => {
        const customEvent = event as CustomEvent<{ open: boolean }>;
        if (customEvent.detail?.open) {
            this.activeOverlayScreen = "library";
            this.isPanelExpanded = false;
        }
        else if (this.activeOverlayScreen === "library") {
            this.activeOverlayScreen = null;
        }
        this.updateHudMode();
    };

    private readonly onScrapbookVisibilityChange = (event: Event) => {
        const customEvent = event as CustomEvent<{ open: boolean }>;
        if (customEvent.detail?.open) {
            this.activeOverlayScreen = "storybook";
            this.isPanelExpanded = false;
        }
        else if (this.activeOverlayScreen === "storybook") {
            this.activeOverlayScreen = null;
        }
        this.updateHudMode();
    };

    private readonly onNarratorEvent = (event: LiveNarratorEvent) => {
        if (event.type === "status") {
            this.narratorStatus = event.status;
            this.pushNarratorDebug(`status -> ${event.status}${event.message ? ` (${event.message})` : ""}`);
            this.speakButton.classList.toggle("is-listening", isLiveNarratorMicActive());
            this.updateNarratorUI(event.message);
            return;
        }

        if (event.type === "partial" || event.type === "response") {
            this.narratorLatestText = event.text;
            this.pushNarratorDebug(`${event.type}: ${event.text.slice(0, 120)}`);
            if (event.type === "response") {
                this.narratorLastResponseAt = performance.now();
                const lastTurn = this.narratorHistory[this.narratorHistory.length - 1];
                if (lastTurn?.speaker !== "glimmer" || lastTurn.text !== event.text) {
                    this.narratorHistory.push({ speaker: "glimmer", text: event.text });
                    this.narratorHistory = this.narratorHistory.slice(-8);
                }
            }
            this.updateNarratorUI();
            return;
        }

        if (event.type === "speaking") {
            this.narratorSpeaking = event.active;
            this.updateNarratorUI();
            return;
        }

        if (event.type === "debug") {
            this.pushNarratorDebug(event.text);
            return;
        }

        if (event.type === "input") {
            this.pushNarratorDebug(`input: ${event.text.slice(0, 120)}`);
            this.showToast(`Glimmer heard: ${event.text}`);
            window.setTimeout(() => this.hideToast(), 1300);
        }
    };

    private readonly onLibrarySelect = (event: Event) => {
        const customEvent = event as CustomEvent<LibrarySelectEventDetail>;
        const detail = customEvent.detail;
        if (!detail) return;

        if (detail.kind === "background") {
            void this.handlePresetBackground(detail.id);
            return;
        }

        if (detail.kind === "character") {
            void this.handlePresetCharacter(detail.id);
            return;
        }

        const accessory = LIBRARY_ACCESSORIES.find((item) => item.id === detail.id);
        if (!accessory) return;
        void this.handleAccessorySelect(accessory.id);
    };

    awake(): void {
        this.injectStyles();
        this.injectNewPackStyles();
        this.injectMarkup();
        this.bindEvents();
        this.setupSpeechRecognition();
        document.addEventListener("selectstart", this.preventSelectionEvent);
        document.addEventListener("contextmenu", this.preventSelectionEvent);
        this.applySurfaceBadgeState(ARPlacement.surfaceDetected, ARPlacement.placementConfirmed);
        window.addEventListener("toybox-library-select", this.onLibrarySelect as EventListener);
        window.addEventListener("barbie-library-visibilitychange", this.onLibraryVisibilityChange as EventListener);
        window.addEventListener("barbie-scrapbook-visibilitychange", this.onScrapbookVisibilityChange as EventListener);
        SceneRig.events.addEventListener("selectionchange", this.onSelectionChange);
        this.removeNarratorSubscription = subscribeToLiveNarrator(this.onNarratorEvent);
        this.narratorStatus = getLiveNarratorStatus();
        this.updateARButton();
        this.setPanelExpanded(false);
        this.updateHudMode();
        this.updateActionState();
        this.updateNarratorUI();
        this.updateSelectionUI();
        window.requestAnimationFrame(() => {
            this.root.classList.add("is-ready");
        });
    }

    onDestroy(): void {
        ARPlacement.events.removeEventListener("surfacechange", this.onSurfaceChange);
        window.removeEventListener("toybox-library-select", this.onLibrarySelect as EventListener);
        window.removeEventListener("barbie-library-visibilitychange", this.onLibraryVisibilityChange as EventListener);
        window.removeEventListener("barbie-scrapbook-visibilitychange", this.onScrapbookVisibilityChange as EventListener);
        SceneRig.events.removeEventListener("selectionchange", this.onSelectionChange);
        this.removeNarratorSubscription?.();
        document.removeEventListener("selectstart", this.preventSelectionEvent);
        document.removeEventListener("contextmenu", this.preventSelectionEvent);
        disconnectLiveNarrator();
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
        root.style.setProperty("--asset-pill-primary", `url("${pillPrimaryUrl}")`);
        root.style.setProperty("--asset-pill-secondary", `url("${pillSecondaryUrl}")`);
        root.style.setProperty("--asset-card-frame", `url("${cardFrameUrl}")`);
        root.innerHTML = `
            <div id="hud-bottom">
                <section id="hud-home-screen" class="hud-screen">
                    <div class="hud-card-shell hud-home-shell">
                        <div class="hud-utility-row">
                            <button id="home-menu-btn" type="button" class="hud-icon-btn" aria-label="Open Glimmer"><img src="${iconMenuUrl}" alt="" /></button>
                            <div class="hud-icon-btn hud-icon-btn-static" aria-hidden="true"><img src="${iconGearUrl}" alt="" /></div>
                        </div>
                        <img id="hud-home-logo" src="${logoStorybookUrl}" alt="Barbie Storybook" />
                        <div id="hud-home-hero">
                            <div id="hud-home-copy">
                                <div class="hud-home-heading">Build Barbie scenes in AR</div>
                                <div class="hud-home-body">Place your stage, generate a backdrop, add props, and save the moment as a storybook page.</div>
                            </div>
                            <img id="hud-home-glimmer" src="${glimmerStateHappyUrl}" alt="Glimmer story helper" />
                        </div>
                        <button id="ar-btn" type="button" class="hud-primary-cta"><img src="${iconScanUrl}" alt="" /><span>START SCANNING</span></button>
                        <div id="hud-home-features">
                            <button id="home-scan-card" type="button" class="hud-feature-card">
                                <img class="hud-feature-icon" src="${iconCameraUrl}" alt="" />
                                <span class="hud-feature-title">Start AR</span>
                                <span class="hud-feature-copy">Place your stage</span>
                            </button>
                            <button id="home-glimmer-card" type="button" class="hud-feature-card">
                                <img class="hud-feature-icon" src="${glimmerAvatarUrl}" alt="" />
                                <span class="hud-feature-title">Glimmer</span>
                                <span class="hud-feature-copy">Story helper</span>
                            </button>
                            <button id="home-library-card" type="button" class="hud-feature-card">
                                <img class="hud-feature-icon" src="${iconBearUrl}" alt="" />
                                <span class="hud-feature-title">My Library</span>
                                <span class="hud-feature-copy">Stories and props</span>
                            </button>
                            <button id="home-favorites-card" type="button" class="hud-feature-card">
                                <img class="hud-feature-icon" src="${iconHeartUrl}" alt="" />
                                <span class="hud-feature-title">Saved</span>
                                <span class="hud-feature-copy">Story pages</span>
                            </button>
                        </div>
                    </div>
                </section>
                <section id="hud-scan-screen" class="hud-screen">
                    <div id="surface-badge" hidden>SCANNING</div>
                    <button id="add-btn" type="button" class="hud-floating-cta" hidden disabled><img src="${iconStarUrl}" alt="" /><span>ANCHOR STAGE</span></button>
                    <div id="hud-scan-minimal-copy">Tap on your surface</div>
                </section>
                <section id="hud-stage-screen" class="hud-screen">
                    <div class="hud-card-shell hud-stage-shell">
                        <div id="hud-sheet-header">
                            <div id="hud-sheet-copy">
                                <div id="hud-sheet-kicker">BARBIE STORYWORLD</div>
                                <div id="hud-sheet-title">Build a polished scene, then turn it into a picture-book page</div>
                            </div>
                            <div id="hud-sheet-actions">
                                <button id="panel-toggle-btn" type="button" aria-expanded="false"><img src="${iconWandUrl}" alt="" /><span>GLIMMER</span></button>
                            </div>
                        </div>
                        <div id="hud-stage-status-row">
                            <div class="hud-stage-pill">PLACED</div>
                            <div class="hud-stage-pill hud-stage-pill-soft">AR scene ready</div>
                        </div>
                        <div id="hud-stage-prompt">
                            <div id="prompt-row">
                                <input id="prompt-input" type="text" placeholder="Type a world, prop, or story idea..." autocomplete="off" />
                                <button id="speak-btn" type="button" aria-label="Hold to speak"><img src="${iconMicUrl}" alt="" /><span>VOICE</span></button>
                            </div>
                        </div>
                        <div id="action-row">
                            <button id="world-btn" type="button" disabled><img src="${iconScanUrl}" alt="" /><span>WORLD</span></button>
                            <button id="doll-btn" type="button" disabled><img src="${iconBearUrl}" alt="" /><span>PROPS</span></button>
                            <button id="book-btn" type="button"><img src="${iconBookUrl}" alt="" /><span>BOOK</span></button>
                            <button id="capture-btn" type="button" disabled><img src="${iconCameraUrl}" alt="" /><span>SAVE PAGE</span></button>
                            <button id="library-launch-btn" type="button"><img src="${iconGearUrl}" alt="" /><span>OPEN LIBRARY</span></button>
                        </div>
                        <div id="world-panel" hidden>
                            <div class="hud-world-label">Describe the world you want to generate</div>
                            <div class="hud-world-row">
                                <input id="world-prompt-input" type="text" placeholder="Dream closet, music room, beach sunset..." autocomplete="off" />
                                <button id="world-generate-btn" type="button" disabled><span>GENERATE</span></button>
                            </div>
                        </div>
                        <div id="props-panel" hidden>
                            <div class="hud-props-label">Describe the prop you want to generate</div>
                            <div class="hud-props-row">
                                <input id="props-prompt-input" type="text" placeholder="Pink guitar, vanity chair, toy cake..." autocomplete="off" />
                                <button id="props-generate-btn" type="button" disabled><span>GENERATE</span></button>
                            </div>
                        </div>
                        <div id="object-selection-row" hidden></div>
                    </div>
                </section>
                <section id="hud-advanced" class="hud-screen" aria-hidden="true">
                    <div class="hud-card-shell hud-glimmer-shell">
                        <div class="hud-utility-row">
                            <button id="glimmer-back-btn" type="button" class="hud-icon-btn" aria-label="Back to scene"><img src="${iconBackUrl}" alt="" /></button>
                            <div class="hud-glimmer-heading-block">
                                <div class="hud-glimmer-title">GLIMMER</div>
                                <div class="hud-glimmer-subtitle">Your story helper</div>
                            </div>
                            <button id="glimmer-menu-btn" type="button" class="hud-icon-btn" aria-label="Open storybook"><img src="${iconBookUrl}" alt="" /></button>
                        </div>
                        <div id="narrator-panel">
                            <div id="narrator-panel-head">
                                <div id="narrator-avatar-column">
                                    <div id="narrator-ideas-board">
                                        <div id="narrator-ideas-title">IDEAS BOARD</div>
                                        <div id="narrator-ideas-text">Ask Glimmer for a story beat or prop ideas.</div>
                                    </div>
                                    <div id="narrator-avatar-shell">
                                        <img id="narrator-avatar" src="${glimmerStateIdleUrl}" alt="Glimmer story helper" />
                                    </div>
                                </div>
                                <div id="narrator-copy">
                                    <div id="narrator-label">Hi! I'm Glimmer</div>
                                    <div id="narrator-subtitle">I help with story direction and prop ideas for your Barbie world.</div>
                                </div>
                                <span id="narrator-status-badge">OFFLINE</span>
                            </div>
                            <div class="hud-glimmer-field-label">What would you like to create?</div>
                            <div class="hud-glimmer-input-row">
                                <input id="glimmer-prompt-input" type="text" placeholder="Type your idea here..." autocomplete="off" />
                                <img class="hud-input-send-icon" src="${iconSendUrl}" alt="" />
                            </div>
                            <div id="hud-idea-pills">
                                <button type="button" class="hud-idea-pill" data-prompt-suggestion="Magical adventure">Magical adventure</button>
                                <button type="button" class="hud-idea-pill" data-prompt-suggestion="Fashion show">Fashion show</button>
                                <button type="button" class="hud-idea-pill" data-prompt-suggestion="Beach day">Beach day</button>
                                <button type="button" class="hud-idea-pill" data-prompt-suggestion="Music room">Music room</button>
                            </div>
                            <div id="narrator-output" hidden>Ask Glimmer for styling help, then build the scene from there.</div>
                            <div id="narrator-actions">
                                <button id="narrator-live-btn" type="button"><img src="${iconMicUrl}" alt="" /><span>LIVE GLIMMER</span></button>
                                <button id="narrator-send-btn" type="button"><img src="${iconStarUrl}" alt="" /><span>GET DIRECTION</span></button>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
            <img id="hud-scan-overlay-frame" src="${scanCornersUrl}" alt="" hidden />
            <div id="status-toast" hidden></div>
        `;

        this.getOverlayHost().append(root);
        this.root = root;
        this.bottomSheet = root.querySelector("#hud-bottom") as HTMLDivElement;
        this.sheetHeader = root.querySelector("#hud-sheet-header") as HTMLDivElement;
        this.homeScreen = root.querySelector("#hud-home-screen") as HTMLDivElement;
        this.scanScreen = root.querySelector("#hud-scan-screen") as HTMLDivElement;
        this.stageScreen = root.querySelector("#hud-stage-screen") as HTMLDivElement;
        this.scanOverlayFrame = root.querySelector("#hud-scan-overlay-frame") as HTMLImageElement;
        this.surfaceBadge = root.querySelector("#surface-badge") as HTMLDivElement;
        this.sheetKicker = root.querySelector("#hud-sheet-kicker") as HTMLDivElement;
        this.sheetTitle = root.querySelector("#hud-sheet-title") as HTMLDivElement;
        this.narratorStatusBadge = root.querySelector("#narrator-status-badge") as HTMLSpanElement;
        this.narratorLiveButton = root.querySelector("#narrator-live-btn") as HTMLButtonElement;
        this.narratorSendButton = root.querySelector("#narrator-send-btn") as HTMLButtonElement;
        this.narratorOutput = root.querySelector("#narrator-output") as HTMLDivElement;
        this.narratorIdeasBoard = root.querySelector("#narrator-ideas-text") as HTMLDivElement;
        this.narratorAvatar = root.querySelector("#narrator-avatar") as HTMLImageElement;
        this.arButton = root.querySelector("#ar-btn") as HTMLButtonElement;
        this.promptInput = root.querySelector("#prompt-input") as HTMLInputElement;
        this.glimmerPromptInput = root.querySelector("#glimmer-prompt-input") as HTMLInputElement;
        this.promptRow = root.querySelector("#prompt-row") as HTMLDivElement;
        this.actionRow = root.querySelector("#action-row") as HTMLDivElement;
        this.objectSelectionRow = root.querySelector("#object-selection-row") as HTMLDivElement;
        this.worldPanel = root.querySelector("#world-panel") as HTMLDivElement;
        this.worldPromptInput = root.querySelector("#world-prompt-input") as HTMLInputElement;
        this.worldGenerateButton = root.querySelector("#world-generate-btn") as HTMLButtonElement;
        this.propsPanel = root.querySelector("#props-panel") as HTMLDivElement;
        this.propsPromptInput = root.querySelector("#props-prompt-input") as HTMLInputElement;
        this.propsGenerateButton = root.querySelector("#props-generate-btn") as HTMLButtonElement;
        this.panelToggleButton = root.querySelector("#panel-toggle-btn") as HTMLButtonElement;
        this.advancedPanel = root.querySelector("#hud-advanced") as HTMLDivElement;
        this.speakButton = root.querySelector("#speak-btn") as HTMLButtonElement;
        this.addButton = root.querySelector("#add-btn") as HTMLButtonElement;
        this.worldButton = root.querySelector("#world-btn") as HTMLButtonElement;
        this.dollButton = root.querySelector("#doll-btn") as HTMLButtonElement;
        this.bookButton = root.querySelector("#book-btn") as HTMLButtonElement;
        this.captureButton = root.querySelector("#capture-btn") as HTMLButtonElement;
        this.toast = root.querySelector("#status-toast") as HTMLDivElement;
    }

    private bindEvents(): void {
        ARPlacement.events.addEventListener("surfacechange", this.onSurfaceChange);

        const syncFromInput = (value: string) => {
            this.syncPromptInputs(value);
            this.updateActionState();
        };
        this.promptInput.addEventListener("input", () => syncFromInput(this.promptInput.value));
        this.glimmerPromptInput.addEventListener("input", () => syncFromInput(this.glimmerPromptInput.value));
        this.worldPromptInput.addEventListener("input", () => {
            this.currentPrompt = this.worldPromptInput.value.trim();
            this.updateActionState();
        });
        this.propsPromptInput.addEventListener("input", () => {
            this.currentPrompt = this.propsPromptInput.value.trim();
            this.updateActionState();
        });

        this.narratorSendButton.addEventListener("click", () => {
            void this.handleNarratorSend();
        });

        this.narratorLiveButton.addEventListener("click", () => {
            void this.handleNarratorLiveToggle();
        });

        this.panelToggleButton.addEventListener("click", () => {
            this.setPanelExpanded(!this.isPanelExpanded);
        });

        this.arButton.addEventListener("click", () => {
            logDebug("ui.ar_button_tapped", {
                active: !!NeedleXRSession.active?.isAR,
            });
            this.handleStartAR();
        });

        this.addButton.addEventListener("click", () => {
            void this.handleAddToScene();
        });

        this.worldButton.addEventListener("click", () => {
            this.worldPanelOpen = !this.worldPanelOpen;
            if (this.worldPanelOpen) {
                this.propsPanelOpen = false;
                this.worldPromptInput.value = this.currentWorldPrompt || this.currentPrompt;
                this.worldPromptInput.focus();
            }
            this.updateActionState();
        });

        this.dollButton.addEventListener("click", () => {
            this.propsPanelOpen = !this.propsPanelOpen;
            if (this.propsPanelOpen) {
                this.worldPanelOpen = false;
                this.propsPromptInput.value = this.currentPrompt;
                this.propsPromptInput.focus();
            }
            this.updateActionState();
        });

        this.worldGenerateButton.addEventListener("click", () => {
            void this.handleGenerateWorldButton();
        });

        this.propsGenerateButton.addEventListener("click", () => {
            void this.handleGenerateDollButton();
        });

        this.bookButton.addEventListener("click", () => {
            logDebug("ui.book_tapped");
            this.setOverlayScreen("storybook");
        });

        this.captureButton.addEventListener("click", () => {
            void this.handleCapture();
        });

        this.root.querySelector("#home-scan-card")?.addEventListener("click", () => {
            this.handleStartAR();
        });
        this.root.querySelector("#home-glimmer-card")?.addEventListener("click", () => {
            this.setOverlayScreen("glimmer");
        });
        this.root.querySelector("#home-menu-btn")?.addEventListener("click", () => {
            this.setOverlayScreen("glimmer");
        });
        this.root.querySelector("#home-library-card")?.addEventListener("click", () => {
            this.setOverlayScreen("library");
        });
        this.root.querySelector("#home-favorites-card")?.addEventListener("click", () => {
            this.setOverlayScreen("storybook");
        });
        this.root.querySelector("#scan-close-btn")?.addEventListener("click", () => {
            this.handleStartAR();
        });
        this.root.querySelector("#scan-help-btn")?.addEventListener("click", () => {
            this.setOverlayScreen("glimmer");
        });
        this.root.querySelector("#scan-toys-btn")?.addEventListener("click", () => {
            if (!ARPlacement.placementConfirmed) {
                this.showToast("Anchor the stage first");
                window.setTimeout(() => this.hideToast(), 1200);
                return;
            }
            this.setOverlayScreen("library");
        });
        this.root.querySelector("#scan-book-btn")?.addEventListener("click", () => {
            this.setOverlayScreen("storybook");
        });
        this.root.querySelector("#library-launch-btn")?.addEventListener("click", () => {
            void this.handleAddToScene();
        });
        this.root.querySelector("#glimmer-back-btn")?.addEventListener("click", () => {
            this.setOverlayScreen(null);
        });
        this.root.querySelector("#glimmer-menu-btn")?.addEventListener("click", () => {
            this.setOverlayScreen("storybook");
        });
        Array.from(this.root.querySelectorAll<HTMLElement>("[data-prompt-suggestion]")).forEach((button) => {
            button.addEventListener("click", () => {
                this.syncPromptInputs(button.dataset.promptSuggestion ?? "");
                this.updateActionState();
            });
        });
    }

    private setupSpeechRecognition(): void {
        const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.pushNarratorDebug("browser speech recognition unavailable; live mic mode only");
        }

        let recognition: SpeechRecognitionLike | null = null;
        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = "en-US";
            recognition.onresult = (event) => {
                const transcript = event.results[0]?.[0]?.transcript?.trim();
                if (!transcript) return;
                this.syncPromptInputs(transcript);
                this.updateActionState();
                void this.handleNarratorSend(transcript);
            };
            recognition.onend = () => {
                if (isLiveNarratorMicActive()) return;
                this.speakButton.classList.remove("is-listening");
            };
            recognition.onerror = () => {
                if (isLiveNarratorMicActive()) return;
                this.speakButton.classList.remove("is-listening");
            };
        }

        const startListening = () => {
            if (this.narratorStatus === "live" || this.narratorStatus === "connecting") {
                this.pushNarratorDebug("voice disabled in live mode; type and tap ASK GLIMMER");
                this.showToast("Type to Glimmer in live mode");
                window.setTimeout(() => this.hideToast(), 1600);
                return;
            }

            if (!recognition) return;

            try {
                recognition.start();
                this.speakButton.classList.add("is-listening");
            }
            catch {
                return;
            }
        };

        const stopListening = () => {
            if (this.narratorStatus === "live" || this.narratorStatus === "connecting") {
                return;
            }
            recognition?.stop();
            this.speakButton.classList.remove("is-listening");
        };

        this.speakButton.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            startListening();
        });
        this.speakButton.addEventListener("pointerup", stopListening);
        this.speakButton.addEventListener("pointercancel", stopListening);
        this.speakButton.addEventListener("pointerleave", stopListening);
        this.speakButton.addEventListener("contextmenu", (event) => {
            event.preventDefault();
        });

        this.speechRecognition = recognition;
    }

    private async handleAddToScene(): Promise<void> {
        if (this.isBusy) return;
        logDebug("ui.add_to_scene_tapped", {
            placementConfirmed: ARPlacement.placementConfirmed,
            surfaceDetected: ARPlacement.surfaceDetected,
        });

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

        this.setOverlayScreen("library");
    }

    private async handlePresetCharacter(presetId: PresetCharacterId): Promise<void> {
        if (this.isBusy) return;
        logDebug("ui.preset_character_tapped", { presetId });

        const preset = getPresetCharacter(presetId);
        if (!preset) {
            this.showToast("Preset toy missing");
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

            const placement = this.getAccessorySpawnWorldPosition();
            const worldYRotation = this.getCameraFacingYaw();

            await CharacterSpawner.instance.spawnAt(preset.glbUrl, placement, {
                initialYRotation: preset.initialYRotation,
                worldYRotation,
            });
            this.lastSpawnWorldPosition = placement.clone();
            SceneGestures.instance?.suppressInputs(500);
            ARPlacement.suppressInputs(500);
            this.syncPromptInputs(preset.prompt);
            this.captureEnabled = true;
            this.setPanelExpanded(false);
            this.updateHudMode();
            this.showToast(`${preset.prompt} ready`);
            window.setTimeout(() => this.hideToast(), 1400);
        }
        catch {
            this.showToast("Preset toy failed to load");
            window.setTimeout(() => this.hideToast(), 2200);
        }
        finally {
            this.isBusy = false;
            this.updateActionState();
        }
    }

    private async handlePresetBackground(presetId: PresetBackgroundId): Promise<void> {
        if (this.isBusy) return;
        logDebug("ui.preset_background_tapped", { presetId });

        const preset = getPresetBackground(presetId);
        if (!preset) {
            this.showToast("Backdrop missing");
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
            this.showToast(`Loading ${preset.title}...`);
            if (!BackgroundSpawner.instance) {
                throw new Error("Background spawner is not ready.");
            }
            await BackgroundSpawner.instance.setBackground(preset.panoUrl);
            this.currentWorldPrompt = preset.title;

            this.setPanelExpanded(false);
            this.updateHudMode();
            this.showToast(`${preset.title} ready`);
            window.setTimeout(() => this.hideToast(), 1400);
        }
        catch {
            playSfx("error", 0.5);
            this.showToast("Backdrop failed to load");
            window.setTimeout(() => this.hideToast(), 2200);
        }
        finally {
            this.isBusy = false;
            this.updateActionState();
        }
    }

    private async handleAccessorySelect(accessoryId: LibraryAccessoryId): Promise<void> {
        if (this.isBusy) return;

        const accessory = LIBRARY_ACCESSORIES.find((item) => item.id === accessoryId);
        if (!accessory) {
            this.showToast("Accessory missing");
            window.setTimeout(() => this.hideToast(), 1800);
            return;
        }

        if (!ARPlacement.placementConfirmed) {
            this.showToast("Place the scene first");
            window.setTimeout(() => this.hideToast(), 1600);
            return;
        }

        if (!AccessorySpawner.instance) {
            this.showToast("Accessory loader is not ready");
            window.setTimeout(() => this.hideToast(), 1800);
            return;
        }

        this.isBusy = true;
        this.updateActionState();

        try {
            this.showToast(`Loading ${accessory.title}...`);
            const placement = this.getAccessorySpawnWorldPosition();
            const worldYRotation = this.getCameraFacingYaw();

            await AccessorySpawner.instance.spawnAt(accessory, placement, worldYRotation);
            this.lastSpawnWorldPosition = placement.clone();
            SceneGestures.instance?.suppressInputs(500);
            ARPlacement.suppressInputs(500);
            this.syncPromptInputs([this.currentPrompt, accessory.title].filter(Boolean).join(", "));
            this.captureEnabled = true;
            this.setPanelExpanded(false);
            this.updateHudMode();
            this.showToast(`${accessory.title} ready`);
            window.setTimeout(() => this.hideToast(), 1400);
        }
        catch {
            playSfx("error", 0.5);
            this.showToast("Accessory failed to load");
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

    private getSpawnWorldPosition(distanceMeters: number): THREE.Vector3 {
        if (ARPlacement.placementConfirmed) {
            const hit = ARPlacement.lastHitPosition.clone();
            if (Number.isFinite(hit.x) && Number.isFinite(hit.y) && Number.isFinite(hit.z)) {
                return hit;
            }
        }

        const camera = this.context.mainCamera;
        const rig = SceneRig.instance;
        const planeY = rig?.root.position.y ?? ARPlacement.lastHitPosition.y;
        if (!camera) return ARPlacement.lastHitPosition.clone();

        const cameraWorldPosition = camera.getWorldPosition(new THREE.Vector3());
        const forward = camera.getWorldDirection(new THREE.Vector3());
        forward.y = 0;
        if (forward.lengthSq() < 1e-6) {
            return (rig?.hasContent() ? rig.root.position : ARPlacement.lastHitPosition).clone();
        }

        forward.normalize();
        const spawn = cameraWorldPosition.add(forward.multiplyScalar(distanceMeters));
        spawn.y = planeY;
        return spawn;
    }

    private getAccessorySpawnWorldPosition(): THREE.Vector3 {
        const rig = SceneRig.instance;
        const basePosition =
            this.lastSpawnWorldPosition?.clone() ??
            rig?.getLatestWorldPosition() ??
            this.getSpawnWorldPosition(0.34);

        return basePosition.add(HUD.ACCESSORY_SPAWN_OFFSET);
    }

    private getCameraFacingYaw(): number {
        const camera = this.context.mainCamera;
        if (!camera) return 0;
        const forward = camera.getWorldDirection(new THREE.Vector3());
        forward.y = 0;
        if (forward.lengthSq() < 1e-6) return 0;
        forward.normalize();
        return Math.atan2(forward.x, forward.z);
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
        logDebug("capture.started", {
            prompt: this.currentPrompt,
            worldPrompt: this.currentWorldPrompt,
        });

        this.isBusy = true;
        this.updateActionState();
        const viewportState = this.captureViewportState();

        try {
            SceneGestures.instance?.suppressInputs(700);
            ARPlacement.suppressInputs(700);
            this.root.classList.add("is-capture-hidden");
            await this.waitForFrames(2);
            playSfx("shutter", 0.8);

            const capturedBlob = await screenshot2({
                context: this.context,
                type: "blob",
                mimeType: "image/png",
            });

            if (!capturedBlob) {
                throw new Error("Screenshot capture returned no image.");
            }

            const capturedDataUrl = await this.blobToDataUrl(capturedBlob);
            this.root.classList.remove("is-capture-hidden");
            this.showToast("Captured. Saving page...");
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

            const rawMimeType = capturedDataUrl.startsWith("data:image/png") ? "image/png" : "image/jpeg";
            const polishedMimeType = polishedDataUrl.startsWith("data:image/png") ? "image/png" : "image/jpeg";
            const rawBase64 = capturedDataUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
            const polishedBase64 = polishedDataUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");

            await savePage({
                id: crypto.randomUUID(),
                imageBase64: rawBase64,
                mimeType: rawMimeType,
                polishedImageBase64: polishedBase64,
                polishedMimeType,
                caption: "",
                characterPrompt: this.currentPrompt,
                timestamp: Date.now(),
            });
            logDebug("capture.saved", {
                rawMimeType,
                polishedMimeType,
                polishedChanged: polishedDataUrl !== capturedDataUrl,
            });

            playSfx("success", 0.6);
            this.showToast("Saved to your book");
            window.setTimeout(() => this.hideToast(), 2000);
        }
        catch (error) {
            logDebug("capture.failed", {
                message: error instanceof Error ? error.message : String(error),
            });
            playSfx("error", 0.5);
            this.showToast("Capture failed, try again");
            window.setTimeout(() => this.hideToast(), 2000);
        }
        finally {
            this.root.classList.remove("is-capture-hidden");
            this.restoreViewportAfterCapture(viewportState);
            this.isBusy = false;
            this.updateActionState();
        }
    }

    private buildNarratorPrompt(userText: string): string {
        const backgroundTitle = this.currentWorldPrompt || "none";
        const dollTitle = this.currentPrompt || "none";
        const hasStageProp = !!StagePropSpawner.instance?.spawnedStageProp;
        const stageLabel = hasStageProp ? "stage prop in scene" : "none";
        const sceneState = ARPlacement.placementConfirmed ? "scene placed" : "scene not placed yet";
        const captureState = this.captureEnabled ? "capture available" : "capture not ready yet";

        return `Child idea: ${userText}

Current Barbie AR scene:
- Placement: ${sceneState}
- Doll or toy prompt: ${dollTitle}
- Background or backdrop: ${backgroundTitle}
- Stage prop: ${stageLabel}
- Capture state: ${captureState}

Help with the next best story move or a few prop ideas only. Keep it short and useful for this exact scene.`;
    }

    private async buildSceneFromPrompt(prompt: string): Promise<void> {
        if (!ARPlacement.placementConfirmed) {
            throw new Error("Place the scene first.");
        }
        if (!BackgroundSpawner.instance) {
            throw new Error("Background spawner is not ready.");
        }

        const nonce = ++this.backdropBuildNonce;
        this.syncPromptInputs(prompt);
        this.pushNarratorDebug("generating nano banana backdrop");
        const backdropDataUrl = await generateBackdropPanorama(prompt, (status) => {
            if (nonce !== this.backdropBuildNonce) return;
            this.showToast(status);
        });
        if (nonce !== this.backdropBuildNonce) return;

        await BackgroundSpawner.instance.setBackground(backdropDataUrl);
        this.currentWorldPrompt = prompt;
        this.captureEnabled = true;
        SceneGestures.instance?.suppressInputs(500);
        ARPlacement.suppressInputs(500);
        this.pushNarratorDebug("nano banana backdrop ready");
        playSfx("sparkle", 0.5);
        this.showToast("World ready");
        window.setTimeout(() => this.hideToast(), 1500);
        this.updateHudMode();
    }

    private async handleGenerateWorldButton(): Promise<void> {
        if (this.isBusy) return;

        const prompt = this.worldPromptInput.value.trim();
        if (!prompt) {
            this.showToast("Type a world idea first");
            this.worldPanelOpen = true;
            this.propsPanelOpen = false;
            this.updateActionState();
            this.worldPromptInput.focus();
            window.setTimeout(() => this.hideToast(), 1600);
            return;
        }

        this.isBusy = true;
        this.currentPrompt = prompt;
        this.currentWorldPrompt = prompt;
        this.syncPromptInputs(prompt);
        this.updateActionState();
        this.pushNarratorDebug(`world requested (${prompt.length} chars)`);

        try {
            await this.buildSceneFromPrompt(prompt);
            this.worldPanelOpen = false;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.pushNarratorDebug(`world failed: ${message}`);
            playSfx("error", 0.5);
            this.showToast(message === "Place the scene first." ? message : "World generation failed");
            window.setTimeout(() => this.hideToast(), 1800);
        }
        finally {
            this.isBusy = false;
            this.updateActionState();
        }
    }

    private async handleGenerateDollButton(): Promise<void> {
        if (this.isBusy) return;

        const prompt = this.propsPromptInput.value.trim();
        if (!prompt) {
            this.showToast("Type a prop idea first");
            this.propsPanelOpen = true;
            this.updateActionState();
            this.propsPromptInput.focus();
            window.setTimeout(() => this.hideToast(), 1600);
            return;
        }

        if (!ARPlacement.placementConfirmed) {
            this.showToast("Place the scene first.");
            window.setTimeout(() => this.hideToast(), 1600);
            return;
        }

        if (!AccessorySpawner.instance) {
            this.showToast("Prop spawner is not ready");
            window.setTimeout(() => this.hideToast(), 1800);
            return;
        }

        this.isBusy = true;
        this.currentPrompt = prompt;
        this.syncPromptInputs(prompt);
        this.updateActionState();
        this.pushNarratorDebug(`props requested (${prompt.length} chars)`);

        try {
            this.showToast("Planning props...");
            const imagePrompt = `Create a Barbie-only toy prop concept image for: ${prompt}.

Rules:
- must feel unmistakably Barbie
- make this a Barbie accessory, Barbie furniture piece, Barbie decor object, Barbie playset prop, or Barbie fashion/lifestyle item
- glamorous, cute, polished, toy-like, stylized, collectible look
- favor pinks, pastels, sparkle, glossy plastics, heart shapes, bows, fashion-studio energy, dreamhouse styling, music-room styling, vanity-room styling, beach-club styling when appropriate
- no people
- no dolls
- no characters
- centered studio composition
- light background
- full object visible
- playful, stylized, readable shape
- suitable to convert into one 3D prop
- do not make generic realistic furniture with no Barbie identity
- do not make weapons, vehicles, gore, monsters, gritty tools, or dark objects
- no text
- no watermark`;
            const referenceImage = await generateReferenceImage(imagePrompt, (status) => this.showToast(status));
            const glbUrl = await generateCharacterFromImage(referenceImage, `Barbie-only story prop or prop set inspired by: ${prompt}. Make it look like a polished Barbie accessory or Barbie playset object, not a generic real-world object.`, (status) => this.showToast(status));
            const placement = this.getAccessorySpawnWorldPosition();
            const worldYRotation = this.getCameraFacingYaw();

            await AccessorySpawner.instance.spawnGeneratedGlb(glbUrl, placement, {
                title: prompt,
                worldYRotation,
                targetSize: 0.26,
            });
            this.lastSpawnWorldPosition = placement.clone();
            this.syncPromptInputs(prompt);
            this.captureEnabled = true;
            this.propsPanelOpen = false;
            SceneGestures.instance?.suppressInputs(500);
            ARPlacement.suppressInputs(500);
            playSfx("sparkle", 0.5);
            this.showToast("Generated prop ready");
            window.setTimeout(() => this.hideToast(), 1600);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.pushNarratorDebug(`props image flow failed: ${message}`);

            try {
                this.showToast("Trying direct 3D build...");
                const glbUrl = await generateCharacter(`Barbie story scene prop: ${prompt}`, (status) => this.showToast(status));
                const placement = this.getAccessorySpawnWorldPosition();
                const worldYRotation = this.getCameraFacingYaw();
                await AccessorySpawner.instance.spawnGeneratedGlb(glbUrl, placement, {
                    title: prompt,
                    worldYRotation,
                    targetSize: 0.26,
                });
                this.lastSpawnWorldPosition = placement.clone();
                this.syncPromptInputs(prompt);
                this.captureEnabled = true;
                this.propsPanelOpen = false;
                SceneGestures.instance?.suppressInputs(500);
                ARPlacement.suppressInputs(500);
                playSfx("sparkle", 0.5);
                this.showToast("Generated prop ready");
                window.setTimeout(() => this.hideToast(), 1600);
            }
            catch (fallbackError) {
                const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
                this.pushNarratorDebug(`props failed: ${fallbackMessage}`);
                playSfx("error", 0.5);
                this.showToast("Prop generation failed");
                window.setTimeout(() => this.hideToast(), 1800);
            }
        }
        finally {
            this.isBusy = false;
            this.updateActionState();
        }
    }

    private buildNarratorGreetingPrompt(): string {
        const backgroundTitle = this.currentWorldPrompt || "none";
        const dollTitle = this.currentPrompt || "none";

        return `You just connected to a Barbie AR story session.

Current scene:
- Doll or toy prompt: ${dollTitle}
- Background or backdrop: ${backgroundTitle}

Give a very short spoken hello as Glimmer and invite the child to share a story idea or prop idea next.
Keep it to 1 sentence.`;
    }

    private async handleNarratorLiveToggle(): Promise<void> {
        if (this.isBusy) return;
        this.pushNarratorDebug(`go live tapped while ${this.narratorStatus}`);
        logDebug("ui.narrator_live_tapped", { status: this.narratorStatus });

        if (this.narratorStatus === "live" || this.narratorStatus === "connecting") {
            disconnectLiveNarrator();
            this.narratorLatestText = "";
            this.pushNarratorDebug("live session closed from HUD");
            this.updateNarratorUI("Live mode off. Chat mode is ready.");
            return;
        }

        this.narratorLatestText = "";
        this.pushNarratorDebug("requesting live connection");
        this.updateNarratorUI("Connecting Glimmer...");

        try {
            await connectLiveNarrator();
            this.pushNarratorDebug("connectLiveNarrator resolved");
            this.pushNarratorDebug("sending live greeting");
            await sendLiveNarratorText(this.buildNarratorGreetingPrompt());
            playSfx("glimmer_chime", 0.6);
            this.showToast("Glimmer live is ready");
            window.setTimeout(() => this.hideToast(), 1400);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.pushNarratorDebug(`connect failed: ${message}`);
            preferChatNarrator("Live mode failed. Chat mode is ready.");
            playSfx("error", 0.5);
            this.showToast("Live mode unavailable");
            window.setTimeout(() => this.hideToast(), 1800);
        }
    }

    private async handleNarratorSend(overrideText?: string): Promise<void> {
        const prompt = (overrideText ?? this.currentPrompt).trim();
        if (!prompt) {
            this.showToast("Tell Glimmer your Barbie idea first");
            window.setTimeout(() => this.hideToast(), 1600);
            return;
        }
        if (overrideText) this.syncPromptInputs(prompt);

        const userTurn: NarratorTurn = { speaker: "child", text: prompt };
        this.narratorHistory.push(userTurn);
        this.narratorHistory = this.narratorHistory.slice(-8);

        this.isBusy = true;
        this.updateActionState();
        try {
            this.narratorLatestText = "Glimmer is thinking...";
            this.pushNarratorDebug(`send requested (${prompt.length} chars) in ${this.narratorStatus}`);
            this.updateNarratorUI();

            if (this.narratorStatus === "live" || this.narratorStatus === "connecting") {
                this.pushNarratorDebug("routing prompt through live session");
                await sendLiveNarratorText(this.buildNarratorPrompt(prompt));
                return;
            }

            this.pushNarratorDebug("routing prompt through chat fallback");
            const reply = await generateNarratorReply(prompt, {
                backgroundTitle: this.currentWorldPrompt || undefined,
                stagePropTitle: StagePropSpawner.instance?.spawnedStageProp ? "stage prop in scene" : undefined,
                dollTitle: this.currentPrompt || undefined,
                beatCount: 3,
            }, this.narratorHistory);

            this.narratorLatestText = reply;
            this.narratorHistory.push({ speaker: "glimmer", text: reply });
            this.narratorHistory = this.narratorHistory.slice(-8);
            playSfx("glimmer_chime", 0.6);
            this.updateNarratorUI("Chat mode");
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.pushNarratorDebug(`send failed: ${message}`);
            this.narratorLatestText = "Glimmer could not answer right now.";
            this.updateNarratorUI("Live reply failed");
            playSfx("error", 0.5);
            this.showToast("Glimmer reply failed");
            window.setTimeout(() => this.hideToast(), 1800);
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

    private syncPromptInputs(value: string): void {
        this.currentPrompt = value.trim();
        if (this.promptInput.value !== value) this.promptInput.value = value;
        if (this.glimmerPromptInput.value !== value) this.glimmerPromptInput.value = value;
        if (this.worldPromptInput.value !== value && !this.worldPanelOpen) this.worldPromptInput.value = value;
        if (this.propsPromptInput.value !== value) this.propsPromptInput.value = value;
    }

    private setButtonLabel(button: HTMLButtonElement, label: string): void {
        const span = button.querySelector("span");
        if (span) span.textContent = label;
        else button.textContent = label;
    }

    private updateActionState(): void {
        this.addButton.disabled = !ARPlacement.placementConfirmed
            ? this.isBusy || !ARPlacement.surfaceDetected
            : this.isBusy;
        this.worldButton.disabled = this.isBusy;
        this.dollButton.disabled = this.isBusy;
        this.worldGenerateButton.disabled = this.isBusy || !ARPlacement.placementConfirmed || this.worldPromptInput.value.trim().length === 0;
        this.worldPanel.hidden = !this.worldPanelOpen;
        this.propsGenerateButton.disabled = this.isBusy || !ARPlacement.placementConfirmed || this.propsPromptInput.value.trim().length === 0;
        this.propsPanel.hidden = !this.propsPanelOpen;
        this.bookButton.disabled = this.isBusy;
        this.captureButton.disabled = this.isBusy || !this.captureEnabled;
        this.narratorLiveButton.hidden = false;
        this.narratorLiveButton.disabled = this.isBusy;
        this.narratorSendButton.disabled = this.isBusy || this.currentPrompt.length === 0;
        this.updateHudMode();
    }

    private updateARButton(): void {
        this.setButtonLabel(this.arButton, NeedleXRSession.active?.isAR ? "EXIT AR" : "START SCANNING");
    }

    private setPanelExpanded(expanded: boolean): void {
        this.setOverlayScreen(expanded ? "glimmer" : null);
    }

    private setOverlayScreen(screen: OverlayScreen): void {
        const nextScreen = screen;
        this.activeOverlayScreen = nextScreen;
        this.isPanelExpanded = nextScreen === "glimmer";

        this.bottomSheet.classList.toggle("is-expanded", this.isPanelExpanded);
        this.advancedPanel.setAttribute("aria-hidden", String(!this.isPanelExpanded));
        this.panelToggleButton.setAttribute("aria-expanded", String(this.isPanelExpanded));

        if (nextScreen === "library") {
            if (ScrapbookUI.isOpen()) ScrapbookUI.close();
            if (!LibraryUI.isOpen()) LibraryUI.open();
        }
        else if (nextScreen === "storybook") {
            if (LibraryUI.isOpen()) LibraryUI.close();
            if (!ScrapbookUI.isOpen()) ScrapbookUI.open();
        }
        else {
            if (LibraryUI.isOpen()) LibraryUI.close();
            if (ScrapbookUI.isOpen()) ScrapbookUI.close();
        }

        this.updateHudMode();
    }

    private commitSheetSwipe(): void {
        if (this.sheetDragStartY === null) return;

        const SWIPE_THRESHOLD = 36;
        if (this.sheetDragDeltaY <= -SWIPE_THRESHOLD) {
            this.setPanelExpanded(true);
        }
        else if (this.sheetDragDeltaY >= SWIPE_THRESHOLD) {
            this.setPanelExpanded(false);
        }

        this.resetSheetSwipe();
    }

    private resetSheetSwipe(): void {
        this.sheetDragStartY = null;
        this.sheetDragDeltaY = 0;
    }

    private updateHudMode(): void {
        const isArSession = !!NeedleXRSession.active?.isAR;
        const hasPlacedDoll = !!SceneRig.instance?.hasSlotContent("toy");
        const captureMode = this.captureEnabled && hasPlacedDoll;
        const compactArMode = isArSession && !this.isPanelExpanded;
        const placementConfirmed = ARPlacement.placementConfirmed;
        const scanningOnly = isArSession && !placementConfirmed;

        let stage = "setup";
        let kicker = "BARBIE STORYWORLD";
        let title = "Build a polished scene, then turn it into a picture-book page";
        let panelLabel = this.isPanelExpanded ? "CLOSE" : "GLIMMER";

        if (!placementConfirmed) {
            stage = "placement";
            kicker = "SCAN";
            title = ARPlacement.surfaceDetected ? "Tap to anchor the stage" : "Move your phone to scan the room";
        }
        else if (!hasPlacedDoll) {
            stage = "doll";
            kicker = "CAST";
            title = this.isPanelExpanded ? "Shape the look with Glimmer or the library" : "Open the closet and bring in the star";
        }
        else if (captureMode) {
            stage = "capture";
            kicker = "EDITORIAL";
            title = this.isPanelExpanded ? "Refine the moment with Glimmer" : "Frame the shot and save a storybook page";
        }

        if (this.isPanelExpanded) {
            stage = "advanced";
            kicker = "STUDIO";
            title = "Direct the mood, pacing, and caption styling";
        }

        const showHome = !isArSession && this.activeOverlayScreen === null;
        const showScan = isArSession && !placementConfirmed && this.activeOverlayScreen === null;
        const showStage = isArSession && placementConfirmed && this.activeOverlayScreen === null;
        const showGlimmer = this.activeOverlayScreen === "glimmer";
        this.homeScreen.hidden = !showHome;
        this.scanScreen.hidden = !showScan;
        this.stageScreen.hidden = !showStage;
        this.advancedPanel.hidden = !showGlimmer;
        this.scanOverlayFrame.hidden = !showScan;

        this.sheetKicker.textContent = kicker;
        this.sheetTitle.textContent = title;
        this.setButtonLabel(this.panelToggleButton, panelLabel);
        this.panelToggleButton.hidden = false;
        this.panelToggleButton.disabled = this.isBusy;

        if (!placementConfirmed) {
            this.setButtonLabel(this.addButton, ARPlacement.surfaceDetected ? "ANCHOR STAGE" : "SCAN ROOM");
        }
        else {
            this.setButtonLabel(this.addButton, "ANCHOR STAGE");
        }

        this.setButtonLabel(this.worldButton, "WORLD");
        this.setButtonLabel(this.dollButton, "PROPS");
        this.setButtonLabel(this.bookButton, "BOOK");
        this.setButtonLabel(this.captureButton, "SAVE PAGE");

        const showNarratorPanel = this.isPanelExpanded;

        this.promptRow.classList.toggle("is-hidden", !showNarratorPanel);
        this.actionRow.classList.toggle("is-capture-mode", captureMode);
        this.addButton.classList.remove("is-hidden");
        this.bookButton.classList.remove("is-hidden");
        this.captureButton.classList.toggle("is-hidden", !captureMode);
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

        this.updateSelectionUI();
        this.updateNarratorUI();
    }

    private updateSelectionUI(): void {
        if (!this.objectSelectionRow) return;

        const rig = SceneRig.instance;
        const entries = rig?.getSelectableEntries() ?? [];
        const selectedId = rig?.getSelectedItemId() ?? null;

        this.objectSelectionRow.replaceChildren();
        this.objectSelectionRow.hidden = entries.length <= 1;
        if (entries.length <= 1) return;

        entries.forEach((entry, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "hud-slot-btn";
            if (entry.id === selectedId) button.classList.add("is-active");
            button.textContent = `${entry.slot === "toy" ? "DOLL" : "ITEM"} ${index + 1}`;
            button.addEventListener("click", () => {
                SceneRig.instance?.selectItem(entry.id);
                this.showToast(`Selected ${entry.slot === "toy" ? "doll" : "item"} ${index + 1}`);
                window.setTimeout(() => this.hideToast(), 900);
            });
            this.objectSelectionRow.append(button);
        });
    }

    private getNarratorAvatarSrc(): string {
        if (this.narratorSpeaking) return glimmerStateSpeakingUrl;
        if (this.narratorStatus === "connecting") return glimmerStateThinkingUrl;
        if (this.narratorStatus === "error") return glimmerStateSadUrl;
        if (this.narratorStatus === "live") {
            if (performance.now() - this.narratorLastResponseAt < 2800) return glimmerStateHappyUrl;
            return glimmerStateListeningUrl;
        }
        if (this.narratorStatus === "offline") return glimmerStateSadUrl;
        if (this.narratorStatus === "chat" && this.narratorLatestText.trim().length > 0 && performance.now() - this.narratorLastResponseAt < 2800) {
            return glimmerStateHappyUrl;
        }
        return glimmerStateIdleUrl;
    }

    private updateNarratorUI(statusMessage?: string): void {
        const outputText = this.narratorLatestText.trim();
        const resolvedMessage = statusMessage?.trim();
        const idleCopy = this.narratorStatus === "live"
            ? "Share a story beat or prop idea and Glimmer will guide the next move."
            : this.narratorStatus === "connecting"
                ? "Connecting Glimmer live..."
                : this.narratorStatus === "chat"
                    ? "Type a story beat or prop prompt for Glimmer."
                    : "Ask Glimmer for story direction and prop ideas.";
        const statusLabel = this.narratorStatus === "live"
            ? "LIVE"
            : this.narratorStatus === "connecting"
                ? "CONNECTING"
                : this.narratorStatus === "chat"
                    ? "CHAT"
                : this.narratorStatus === "error"
                    ? "ERROR"
                    : "OFFLINE";

        this.narratorStatusBadge.textContent = statusLabel;
        this.narratorStatusBadge.dataset.status = this.narratorStatus;
        this.setButtonLabel(this.narratorLiveButton, this.narratorStatus === "live" || this.narratorStatus === "connecting"
            ? "END LIVE"
            : "LIVE GLIMMER");
        this.setButtonLabel(this.narratorSendButton, "GET IDEAS");
        this.speakButton.disabled = this.narratorStatus === "live" || this.narratorStatus === "connecting";
        const boardText = outputText || resolvedMessage || idleCopy;
        this.narratorIdeasBoard.textContent = boardText;
        this.narratorOutput.hidden = true;
        this.narratorOutput.textContent = boardText;
        this.narratorOutput.classList.toggle("is-live", this.narratorStatus === "live");
        this.narratorOutput.classList.toggle("is-error", this.narratorStatus === "error");
        this.narratorAvatar.classList.toggle("is-speaking", this.narratorSpeaking);
        this.narratorAvatar.src = this.getNarratorAvatarSrc();
    }

    private pushNarratorDebug(message: string): void {
        const time = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
        const line = `${time}  ${message}`;
        this.narratorDebugLines.push(line);
        this.narratorDebugLines = this.narratorDebugLines.slice(-8);
        logDebug("ui.narrator_debug", { message });
    }

    private waitForFrames(frameCount: number): Promise<void> {
        return new Promise((resolve) => {
            const tick = (remaining: number) => {
                if (remaining <= 0) {
                    resolve();
                    return;
                }
                window.requestAnimationFrame(() => tick(remaining - 1));
            };
            tick(frameCount);
        });
    }

    private captureViewportState(): CaptureViewportState {
        const size = this.context.renderer.getSize(new THREE.Vector2());
        const camera = this.context.mainCamera;
        const perspectiveCamera = camera instanceof THREE.PerspectiveCamera ? camera : null;
        const canvas = this.context.renderer.domElement;

        return {
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            styleWidth: canvas.style.width,
            styleHeight: canvas.style.height,
            rendererWidth: size.x,
            rendererHeight: size.y,
            cameraAspect: perspectiveCamera?.aspect ?? null,
        };
    }

    private restoreViewportAfterCapture(state: CaptureViewportState): void {
        const renderer = this.context.renderer;
        const canvas = renderer.domElement;
        const camera = this.context.mainCamera;

        canvas.width = state.canvasWidth;
        canvas.height = state.canvasHeight;
        canvas.style.width = state.styleWidth;
        canvas.style.height = state.styleHeight;
        renderer.setSize(state.rendererWidth, state.rendererHeight, false);

        if (camera instanceof THREE.PerspectiveCamera && state.cameraAspect) {
            camera.aspect = state.cameraAspect;
            camera.updateProjectionMatrix();
            this.context.updateAspect(camera, state.rendererWidth, state.rendererHeight);
        }
        else if (camera instanceof THREE.OrthographicCamera) {
            this.context.updateAspect(camera, state.rendererWidth, state.rendererHeight);
        }

        this.context.updateSize(true);
        this.context.renderNow(camera ?? null);
    }

    private blobToDataUrl(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                if (typeof reader.result === "string") resolve(reader.result);
                else reject(new Error("Failed to read capture blob."));
            };
            reader.onerror = () => reject(reader.error ?? new Error("Failed to read capture blob."));
            reader.readAsDataURL(blob);
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
                user-select: none;
                -webkit-user-select: none;
                -webkit-touch-callout: none;
                -webkit-tap-highlight-color: transparent;
            }

            #barbie-hud.is-capture-hidden {
                pointer-events: none;
            }

            #barbie-hud.is-capture-hidden > * {
                opacity: 0;
                visibility: hidden;
            }

            #barbie-hud *,
            #barbie-hud *::before,
            #barbie-hud *::after {
                box-sizing: border-box;
                user-select: none;
                -webkit-user-select: none;
                -webkit-touch-callout: none;
            }

            #barbie-overlay-root,
            #barbie-overlay-root * {
                user-select: none;
                -webkit-user-select: none;
                -webkit-touch-callout: none;
                -webkit-tap-highlight-color: transparent;
            }

            needle-engine,
            needle-engine *,
            canvas {
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                user-select: none;
                -webkit-tap-highlight-color: transparent;
            }

            #barbie-hud button,
            #barbie-hud input {
                font-family: var(--font-ui);
                min-height: 44px;
            }

            #hud-top,
            #hud-bottom {
                pointer-events: auto;
            }

            #hud-top {
                position: fixed;
                top: calc(env(safe-area-inset-top, 0px) + 10px);
                left: 14px;
                right: calc(env(safe-area-inset-right, 0px) + 58px);
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 10px;
                padding: 8px;
                border-radius: 24px;
                background:
                    linear-gradient(180deg, rgba(255, 249, 252, 0.88), rgba(253, 237, 245, 0.7)),
                    rgba(255, 255, 255, 0.62);
                border: 1px solid var(--brand-line);
                box-shadow:
                    inset 0 1px 0 rgba(255,255,255,0.85),
                    0 18px 42px rgba(108, 36, 73, 0.16);
                backdrop-filter: blur(18px) saturate(1.08);
                -webkit-backdrop-filter: blur(18px) saturate(1.08);
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
                margin-left: auto;
                min-width: 0;
            }

            #surface-badge,
            #ar-btn {
                min-height: 42px;
                padding: 0 12px;
                border-radius: 18px;
                touch-action: manipulation;
            }

            #surface-badge {
                background: rgba(255, 255, 255, 0.62);
                border: 1px solid var(--brand-line);
                color: var(--brand-ink-soft);
                font-size: 10px;
                font-weight: 700;
                letter-spacing: 0.24em;
                transition: color 0.3s ease, border-color 0.3s ease;
            }

            #surface-badge.is-ready {
                color: #2d7f65;
                border-color: rgba(143, 216, 187, 0.65);
            }

            #surface-badge.is-placed {
                color: var(--brand-rose-deep);
                border-color: rgba(207, 77, 134, 0.4);
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
                border: 1px solid rgba(207, 77, 134, 0.28);
                background: linear-gradient(135deg, rgba(251, 232, 240, 0.92), rgba(245, 206, 223, 0.84));
                color: var(--brand-rose-deep);
                font-weight: 700;
                letter-spacing: 0.08em;
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.72);
            }

            #hud-bottom {
                position: fixed;
                left: 50%;
                transform: translateX(-50%) translateY(24px) scale(0.98);
                bottom: calc(env(safe-area-inset-bottom, 0px) + 14px);
                width: min(calc(100vw - 24px), 620px);
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 16px;
                border-radius: 32px;
                border: 1px solid rgba(173, 68, 118, 0.18);
                background:
                    radial-gradient(circle at top left, rgba(255, 255, 255, 0.48), transparent 34%),
                    linear-gradient(180deg, rgba(255, 250, 252, 0.88), rgba(248, 229, 238, 0.84)),
                    rgba(255, 247, 251, 0.72);
                box-shadow:
                    inset 0 1px 0 rgba(255,255,255,0.92),
                    0 26px 60px rgba(110, 42, 77, 0.18);
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
                max-height: calc(100dvh - env(safe-area-inset-top, 0px) - 84px);
                overflow-y: auto;
                overscroll-behavior: contain;
                -webkit-overflow-scrolling: touch;
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
                max-height: calc(100dvh - env(safe-area-inset-top, 0px) - 84px);
                overflow-y: auto;
                box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24);
            }

            #hud-bottom.is-subpanel {
                width: min(calc(100vw - 24px), 520px);
                gap: 10px;
            }

            #hud-sheet-header,
            #hud-sheet-actions,
            #prompt-row,
            #action-row,
            #object-selection-row {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            #world-panel[hidden],
            #props-panel[hidden] {
                display: none !important;
            }

            #world-panel,
            #props-panel {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-top: 10px;
                padding: 12px;
                border-radius: 18px;
                border: 1px solid rgba(173, 68, 118, 0.14);
                background: rgba(255,255,255,0.58);
            }

            .hud-world-label,
            .hud-props-label {
                color: rgba(64, 26, 44, 0.74);
                font: 600 12px/1.25 var(--font-ui);
            }

            .hud-world-row,
            .hud-props-row {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                gap: 8px;
                align-items: center;
            }

            #action-row {
                flex-wrap: wrap;
            }

            #hud-sheet-header {
                justify-content: space-between;
                align-items: flex-start;
                gap: 12px;
                position: sticky;
                top: 0;
                z-index: 2;
                padding-bottom: 2px;
                background: linear-gradient(180deg, rgba(255, 247, 251, 0.92), rgba(255, 247, 251, 0.68));
                backdrop-filter: blur(8px);
            }

            #narrator-panel-head {
                display: grid;
                grid-template-columns: auto 1fr auto;
                align-items: center;
                gap: 12px;
            }

            #narrator-avatar-shell {
                width: 56px;
                height: 56px;
                display: grid;
                place-items: center;
                border-radius: 18px;
                background: radial-gradient(circle at 30% 30%, rgba(255, 246, 251, 0.94), rgba(255, 205, 227, 0.72));
                border: 1px solid rgba(255, 223, 238, 0.52);
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.45), 0 10px 24px rgba(47, 8, 28, 0.2);
            }

            #narrator-avatar {
                width: 42px;
                height: 42px;
                display: block;
                transform-origin: center bottom;
                animation: glimmerFloat 2.6s ease-in-out infinite;
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
                border: 1px solid rgba(173, 68, 118, 0.16);
                background: rgba(255,255,255,0.5);
                color: rgba(42, 16, 32, 0.46);
                font-size: 10px;
                font-weight: 700;
                letter-spacing: 0.18em;
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
                background: rgba(207, 77, 134, 0.14);
                border-color: rgba(207, 77, 134, 0.28);
                color: var(--brand-rose-deep);
                transform: translateY(-1px);
                box-shadow: 0 8px 20px rgba(191, 92, 138, 0.14);
            }

            .hud-stage-dot.is-complete:not(.is-active) {
                background: rgba(143, 216, 187, 0.16);
                border-color: rgba(143, 216, 187, 0.34);
                color: #2d7f65;
            }

            #hud-sheet-kicker,
            #character-presets-label,
            #world-presets-label {
                color: rgba(143, 47, 91, 0.68);
                font-size: 10px;
                font-weight: 700;
                letter-spacing: 0.24em;
            }

            #object-selection-row {
                flex-wrap: wrap;
                gap: 8px;
            }

            .hud-slot-btn {
                min-height: 34px;
                padding: 0 12px;
                border-radius: 999px;
                border: 1px solid rgba(173, 68, 118, 0.16);
                background: rgba(255,255,255,0.52);
                color: rgba(42, 16, 32, 0.7);
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.08em;
            }

            .hud-slot-btn.is-active {
                background: rgba(207, 77, 134, 0.16);
                border-color: rgba(207, 77, 134, 0.3);
                color: var(--brand-rose-deep);
            }

            #hud-sheet-title {
                max-width: 30ch;
                color: var(--brand-ink);
                font-family: var(--font-display);
                font-size: 20px;
                font-weight: 700;
                line-height: 1.02;
                letter-spacing: -0.04em;
            }

            #panel-toggle-btn,
            #magic-btn,
            #narrator-live-btn,
            #narrator-send-btn,
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
                border: 1px solid rgba(173, 68, 118, 0.18);
                background: rgba(255,255,255,0.56);
                color: var(--brand-rose-deep);
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.16em;
                transition:
                    transform 0.18s ease,
                    background 0.22s ease,
                    border-color 0.22s ease,
                    color 0.22s ease;
            }

            #hud-primary,
            #hud-advanced,
            #narrator-panel,
            #character-presets,
            #world-builder,
            #world-presets {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            #object-selection-row[hidden] {
                display: none !important;
            }

            #object-selection-row {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }

            #narrator-panel {
                padding: 14px;
                border-radius: 26px;
                border: 1px solid rgba(173, 68, 118, 0.12);
                background:
                    radial-gradient(circle at top left, rgba(247, 190, 214, 0.32), transparent 52%),
                    linear-gradient(180deg, rgba(255,255,255,0.62), rgba(255, 242, 247, 0.5));
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.86);
            }

            #narrator-panel-head,
            #narrator-actions {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            #narrator-panel-head {
                justify-content: space-between;
                align-items: flex-start;
            }

            #narrator-copy {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            #narrator-label {
                color: var(--brand-rose-deep);
                font-size: 10px;
                font-weight: 700;
                letter-spacing: 0.22em;
            }

            #narrator-subtitle {
                color: rgba(42, 16, 32, 0.58);
                font-size: 12px;
                line-height: 1.45;
            }

            #narrator-status-badge {
                min-height: 28px;
                padding: 0 10px;
                border-radius: 999px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: 1px solid rgba(173, 68, 118, 0.14);
                background: rgba(255,255,255,0.54);
                color: rgba(42, 16, 32, 0.68);
                font-size: 10px;
                font-weight: 700;
                letter-spacing: 0.16em;
            }

            #narrator-status-badge[data-status="live"] {
                border-color: rgba(74,222,128,0.32);
                background: rgba(74,222,128,0.14);
                color: #d8ffe6;
            }

            #narrator-status-badge[data-status="connecting"] {
                border-color: rgba(255,214,102,0.28);
                background: rgba(255,214,102,0.12);
                color: #fff0b8;
            }

            #narrator-status-badge[data-status="error"] {
                border-color: rgba(251,113,133,0.28);
                background: rgba(251,113,133,0.12);
                color: #ffd8df;
            }

            #narrator-output {
                min-height: 56px;
                padding: 12px 14px;
                border-radius: 18px;
                border: 1px solid rgba(173, 68, 118, 0.12);
                background: rgba(255,255,255,0.54);
                color: var(--brand-ink);
                font-size: 13px;
                line-height: 1.5;
            }

            #narrator-output.is-live {
                border-color: rgba(255,214,231,0.16);
            }

            #narrator-output.is-error {
                border-color: rgba(251,113,133,0.24);
                color: #ffe2e7;
            }

            #narrator-debug-output {
                min-height: 74px;
                max-height: 148px;
                overflow-y: auto;
                padding: 10px 12px;
                border-radius: 16px;
                border: 1px solid rgba(255,255,255,0.08);
                background: rgba(8, 0, 6, 0.52);
                color: rgba(255,255,255,0.82);
                font-size: 11px;
                line-height: 1.45;
                white-space: pre-wrap;
                font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
            }

            #narrator-actions {
                justify-content: stretch;
            }

            #narrator-live-btn,
            #narrator-send-btn {
                flex: 1;
                border-radius: 16px;
            }

            #narrator-live-btn {
                border: 1px solid rgba(173, 68, 118, 0.16);
                background: rgba(255,255,255,0.54);
                color: var(--brand-rose-deep);
            }

            #narrator-send-btn {
                border: 1px solid rgba(207, 77, 134, 0.26);
                background: linear-gradient(135deg, rgba(247, 190, 214, 0.56), rgba(255, 242, 247, 0.82));
                color: var(--brand-rose-deep);
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);
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
                max-height: none;
                opacity: 1;
                padding-top: 10px;
                border-top-color: rgba(255,255,255,0.08);
                transform: translateY(0);
                pointer-events: auto;
            }

            #hud-bottom.is-subpanel #hud-advanced {
                max-height: none;
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
            #world-prompt-input,
            #props-prompt-input,
            #world-input {
                width: 100%;
                border: 1px solid rgba(173, 68, 118, 0.16);
                background: rgba(255,255,255,0.74);
                color: var(--brand-ink);
                padding: 12px 16px;
                font-size: 14px;
                min-width: 0;
                border-radius: 18px;
                transition:
                    border-color 0.2s ease,
                    background 0.2s ease,
                    transform 0.18s ease;
            }

            #prompt-input,
            #world-prompt-input,
            #props-prompt-input {
                flex: 1;
                min-width: 0;
            }

            #prompt-input::placeholder,
            #world-prompt-input::placeholder,
            #props-prompt-input::placeholder,
            #world-input::placeholder {
                color: rgba(42, 16, 32, 0.4);
            }

            #speak-btn {
                min-width: 70px;
                border: 1px solid rgba(173, 68, 118, 0.18);
                background: rgba(255,255,255,0.54);
                color: var(--brand-rose-deep);
                font-weight: 700;
                letter-spacing: 0.14em;
                user-select: none;
                -webkit-user-select: none;
                -webkit-touch-callout: none;
                touch-action: none;
            }

            #speak-btn.is-listening {
                background: rgba(239,68,68,0.88);
                border-color: rgba(255,255,255,0.24);
            }

            #add-btn,
            #world-btn {
                flex: 1;
                border: 1px solid rgba(207, 77, 134, 0.22);
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.84), rgba(247, 190, 214, 0.46));
                color: var(--brand-rose-deep);
                font-weight: 700;
                letter-spacing: 0.06em;
                transition:
                    opacity 0.22s ease,
                    transform 0.24s ease,
                    background 0.22s ease,
                    border-color 0.22s ease,
                    color 0.22s ease;
            }

            #doll-btn,
            #book-btn,
            #capture-btn {
                flex: 1;
            }

            #doll-btn {
                border: 1px solid rgba(173, 68, 118, 0.14);
                background: rgba(255,255,255,0.58);
                color: var(--brand-ink);
            }

            #world-generate-btn,
            #props-generate-btn {
                min-width: 108px;
                border: 1px solid rgba(207, 77, 134, 0.24);
                background: linear-gradient(135deg, rgba(247, 190, 214, 0.74), rgba(255, 247, 251, 0.92));
                color: var(--brand-rose-deep);
                font-weight: 700;
                letter-spacing: 0.06em;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                white-space: nowrap;
            }

            #book-btn {
                border: 1px solid rgba(173, 68, 118, 0.16);
                background: rgba(255, 249, 252, 0.76);
                color: var(--brand-ink);
            }

            #prompt-row.is-hidden,
            #add-btn.is-hidden,
            #book-btn.is-hidden,
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
            #hud-bottom.is-ar-session.is-compact #world-btn,
            #hud-bottom.is-ar-session.is-compact #doll-btn,
            #hud-bottom.is-ar-session.is-compact #book-btn,
            #hud-bottom.is-ar-session.is-compact #capture-btn {
                min-width: 148px;
            }

            #magic-btn {
                border: 1px solid rgba(255,214,231,0.32);
                background: linear-gradient(135deg, rgba(255,214,231,0.12), rgba(255,36,114,0.2));
                color: #fff1f7;
                letter-spacing: 1px;
            }

            #narrator-live-btn:not(:disabled),
            #narrator-send-btn:not(:disabled) {
                transform: translateY(0);
            }

            #add-btn:not(:disabled),
            #world-btn:not(:disabled) {
                background: linear-gradient(135deg, rgba(247, 190, 214, 0.74), rgba(255, 247, 251, 0.92));
            }

            #capture-btn {
                border: 1px solid rgba(207, 77, 134, 0.24);
                background: linear-gradient(135deg, rgba(42, 16, 32, 0.96), rgba(91, 32, 63, 0.94));
                color: #fff7fb;
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
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(241, 200, 125, 0.52));
                border-color: rgba(241, 200, 125, 0.48);
                color: var(--brand-rose-deep);
            }

            #hud-bottom[data-stage="capture"] #capture-btn:not(:disabled) {
                box-shadow: 0 14px 32px rgba(102, 31, 68, 0.24);
                transform: translateY(-1px);
            }

            #magic-btn:disabled,
            #narrator-live-btn:disabled,
            #narrator-send-btn:disabled,
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

            @keyframes glimmerFloat {
                0%, 100% {
                    transform: translateY(0) rotate(0deg);
                }
                50% {
                    transform: translateY(-3px) rotate(-2deg);
                }
            }

            @keyframes glimmerListen {
                0%, 100% {
                    transform: translateY(0) scale(1);
                }
                50% {
                    transform: translateY(-2px) scale(1.04);
                }
            }

            @keyframes glimmerTalk {
                0%, 100% {
                    transform: translateY(0) scale(1) rotate(0deg);
                }
                25% {
                    transform: translateY(-5px) scale(1.06) rotate(-2deg);
                }
                50% {
                    transform: translateY(0) scale(0.98) rotate(0deg);
                }
                75% {
                    transform: translateY(-3px) scale(1.04) rotate(2deg);
                }
            }

            #narrator-avatar.is-speaking {
                animation: glimmerTalk 0.72s ease-in-out infinite;
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
                    left: 8px;
                    right: calc(env(safe-area-inset-right, 0px) + 58px);
                    gap: 8px;
                    top: calc(env(safe-area-inset-top, 0px) + 2px);
                }

                #top-actions {
                    gap: 6px;
                }

                #surface-badge,
                #ar-btn {
                    min-height: 38px;
                    padding: 0 10px;
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

    private injectNewPackStyles(): void {
        if (document.getElementById("barbie-hud-new-pack-styles")) return;
        const style = document.createElement("style");
        style.id = "barbie-hud-new-pack-styles";
        style.textContent = `
            #barbie-hud {
                font-family: var(--font-ui);
            }

            #barbie-hud #hud-top {
                display: none !important;
            }

            #barbie-hud #hud-bottom,
            #barbie-hud.is-ready #hud-bottom,
            #barbie-hud #hud-bottom.is-ar-session,
            #barbie-hud #hud-bottom.is-ar-session.is-compact,
            #barbie-hud #hud-bottom.is-subpanel,
            #barbie-hud #hud-bottom.is-placement-stage,
            #barbie-hud #hud-bottom.is-tool-stage {
                position: fixed !important;
                inset: auto 0 calc(env(safe-area-inset-bottom, 0px) + 10px) 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: calc(env(safe-area-inset-bottom, 0px) + 10px) !important;
                width: auto !important;
                min-width: 0 !important;
                max-width: none !important;
                margin: 0 !important;
                padding: 0 !important;
                border: 0 !important;
                border-radius: 0 !important;
                background: transparent !important;
                box-shadow: none !important;
                transform: none !important;
                z-index: 81;
                pointer-events: none;
                display: block !important;
                max-height: none !important;
            }

            .hud-screen {
                width: 100%;
                display: flex;
                justify-content: center;
                pointer-events: auto;
            }

            .hud-screen[hidden] {
                display: none !important;
                pointer-events: none !important;
            }

            .hud-card-shell {
                width: min(calc(100vw - 24px), 440px);
                margin: 0 auto;
                border-radius: 30px;
                border: 1px solid rgba(246, 117, 177, 0.36);
                background: linear-gradient(180deg, rgba(255, 251, 254, 0.96), rgba(255, 242, 249, 0.95));
                box-shadow: 0 24px 55px rgba(120, 30, 78, 0.24);
                padding: 14px;
                display: grid;
                gap: 12px;
                position: relative;
                overflow: hidden;
            }

            .hud-card-shell::before {
                content: "";
                position: absolute;
                inset: 0;
                background: radial-gradient(circle at top right, rgba(255, 200, 226, 0.55), transparent 42%);
                pointer-events: none;
            }

            .hud-card-shell > * {
                position: relative;
                z-index: 1;
            }

            .hud-utility-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .hud-icon-btn {
                width: 42px;
                height: 42px;
                border: 1px solid rgba(247, 115, 177, 0.48);
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.9);
                display: grid;
                place-items: center;
                padding: 0;
                cursor: pointer;
            }

            .hud-icon-btn img {
                width: 24px;
                height: 24px;
                object-fit: contain;
            }

            #hud-home-logo {
                width: min(82%, 280px);
                margin: 4px auto 2px;
                display: block;
            }

            #hud-home-hero {
                display: grid;
                grid-template-columns: 1fr 0.9fr;
                gap: 8px;
                align-items: end;
            }

            .hud-home-heading {
                color: #ce1f79;
                font: 800 30px/1.02 var(--font-display);
                letter-spacing: -0.04em;
            }

            .hud-home-body {
                margin-top: 8px;
                color: rgba(63, 22, 43, 0.76);
                font: 600 13px/1.4 var(--font-ui);
            }

            #hud-home-glimmer {
                width: 100%;
                max-width: 170px;
                justify-self: end;
            }

            .hud-primary-cta,
            .hud-secondary-cta,
            #action-row button,
            #narrator-actions button,
            #add-btn {
                min-height: 52px;
                border-radius: 18px;
                border: 0;
                font: 800 13px/1 var(--font-ui);
                letter-spacing: 0.08em;
                text-transform: uppercase;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                cursor: pointer;
            }

            .hud-primary-cta {
                color: white;
                background: linear-gradient(180deg, #ff4ea0, #e52383);
            }

            .hud-secondary-cta {
                color: #de2f8d;
                border: 1px solid rgba(239, 101, 168, 0.45);
                background: rgba(255, 255, 255, 0.95);
            }

            .hud-primary-cta img,
            .hud-secondary-cta img,
            #action-row button img,
            #narrator-actions button img,
            #add-btn img {
                width: 22px;
                height: 22px;
                object-fit: contain;
            }

            #hud-home-features {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 8px;
            }

            .hud-feature-card {
                border: 1px solid rgba(238, 104, 168, 0.34);
                background: rgba(255, 255, 255, 0.9);
                border-radius: 16px;
                min-height: 88px;
                display: grid;
                place-items: center;
                text-align: center;
                gap: 2px;
                padding: 8px 6px;
            }

            .hud-feature-icon {
                width: 22px;
                height: 22px;
                object-fit: contain;
            }

            .hud-feature-title {
                color: #ce287e;
                font: 800 11px/1 var(--font-ui);
                text-transform: uppercase;
                letter-spacing: 0.06em;
            }

            .hud-feature-copy {
                color: rgba(64, 24, 44, 0.65);
                font: 600 10px/1.25 var(--font-ui);
            }

            .hud-scan-shell {
                min-height: 0;
                padding: 0;
                background: transparent;
                border: 0;
                box-shadow: none;
                overflow: visible;
            }

            #hud-scan-copy {
                text-align: center;
                margin-top: 4px;
            }

            .hud-scan-title {
                color: #d92c84;
                font: 800 30px/1 var(--font-display);
                letter-spacing: 0.03em;
            }

            .hud-scan-subtitle {
                color: rgba(64, 26, 44, 0.72);
                font: 600 14px/1.2 var(--font-ui);
            }

            #surface-badge {
                justify-self: center;
                min-width: 124px;
                min-height: 44px;
                padding: 0 18px;
                color: #2f8b67;
                font: 800 12px/1 var(--font-ui);
                letter-spacing: 0.18em;
                text-transform: uppercase;
                border: 1px solid rgba(122, 205, 170, 0.65);
                border-radius: 999px;
                background: rgba(255, 255, 255, 0.78);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
            }

            #hud-scan-frame {
                border-radius: 30px;
                border: 1px solid rgba(255, 214, 234, 0.88);
                background: rgba(255, 250, 253, 0.28);
                min-height: 0;
                aspect-ratio: 1 / 0.7;
                display: grid;
                place-items: center;
                overflow: hidden;
                position: relative;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
            }

            #hud-scan-corners {
                width: min(100%, 245px);
                opacity: 0.94;
            }

            #hud-scan-crosshair {
                position: absolute;
                color: white;
                font: 300 54px/1 var(--font-display);
                text-shadow: 0 3px 10px rgba(42, 16, 32, 0.34);
            }

            #hud-scan-hint {
                position: absolute;
                bottom: 10px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(255, 255, 255, 0.8);
                border-radius: 999px;
                padding: 7px 12px;
                color: rgba(68, 30, 48, 0.78);
                font: 700 11px/1 var(--font-ui);
                white-space: normal;
                text-align: center;
                width: min(calc(100% - 20px), 360px);
            }

            #hud-scan-controls {
                display: grid;
                grid-template-columns: 1fr;
                gap: 10px;
                align-items: stretch;
            }

            #hud-stage-rail {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                border-radius: 16px;
                background: rgba(255, 255, 255, 0.84);
                border: 1px solid rgba(239, 104, 169, 0.35);
                overflow: hidden;
                width: min(100%, 220px);
                justify-self: end;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
            }

            .hud-stage-tab {
                min-height: 52px;
                border: 0;
                background: transparent;
                color: #d02d82;
                font: 800 12px/1 var(--font-ui);
            }

            .hud-stage-tab.is-active {
                background: rgba(255, 84, 160, 0.12);
            }

            #add-btn.hud-floating-cta {
                border-radius: 20px;
                min-height: 60px;
                min-width: 0;
                width: 100%;
                color: #8e3367;
                background: linear-gradient(180deg, rgba(255, 243, 210, 0.95), rgba(255, 234, 190, 0.92));
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.88);
            }

            .hud-utility-row-scan {
                margin-bottom: 8px;
            }

            #hud-scan-screen {
                align-items: end;
                padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 12px);
            }

            #hud-scan-overlay-frame {
                position: fixed;
                left: 50%;
                top: 47%;
                transform: translate(-50%, -50%);
                width: min(calc(100vw - 24px), 410px);
                max-width: 92vw;
                pointer-events: none;
                z-index: 79;
                opacity: 0.96;
                filter: drop-shadow(0 10px 22px rgba(216, 46, 133, 0.18));
            }

            .hud-stage-shell,
            .hud-glimmer-shell {
                max-height: 60vh;
                overflow: auto;
            }

            #hud-sheet-header {
                display: flex;
                justify-content: space-between;
                gap: 10px;
                align-items: flex-start;
            }

            #hud-sheet-kicker {
                color: #c73081;
                font: 800 10px/1 var(--font-ui);
                letter-spacing: 0.2em;
            }

            #hud-sheet-title {
                margin-top: 5px;
                color: rgba(63, 22, 43, 0.8);
                font: 700 14px/1.3 var(--font-ui);
            }

            #panel-toggle-btn {
                border: 1px solid rgba(246, 117, 177, 0.45);
                border-radius: 999px;
                min-height: 44px;
                background: rgba(255,255,255,0.9);
                color: #ce2f84;
                font: 800 12px/1 var(--font-ui);
                letter-spacing: 0.08em;
                display: inline-flex;
                gap: 6px;
                align-items: center;
                padding: 0 12px;
            }

            #panel-toggle-btn img {
                width: 18px;
                height: 18px;
            }

            #hud-stage-status-row {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            .hud-stage-pill {
                background: rgba(255, 255, 255, 0.9);
                border: 1px solid rgba(246, 117, 177, 0.4);
                color: #cf2f85;
                border-radius: 999px;
                padding: 7px 11px;
                font: 800 11px/1 var(--font-ui);
                letter-spacing: 0.08em;
                text-transform: uppercase;
            }

            .hud-stage-pill-soft {
                color: rgba(63, 22, 43, 0.76);
                border-color: rgba(237, 149, 192, 0.46);
            }

            #prompt-row,
            .hud-world-row,
            .hud-props-row,
            .hud-glimmer-input-row {
                display: grid;
                grid-template-columns: 1fr auto;
                gap: 8px;
            }

            #prompt-input,
            #world-prompt-input,
            #props-prompt-input,
            #glimmer-prompt-input {
                min-height: 50px;
                border-radius: 16px;
                border: 1px solid rgba(238, 104, 169, 0.34);
                background: rgba(255, 255, 255, 0.94);
                color: #451f34;
                padding: 0 14px;
                font: 600 14px/1 var(--font-ui);
            }

            #world-generate-btn,
            #props-generate-btn {
                min-height: 50px;
                border-radius: 16px;
                padding: 0 16px;
            }

            #speak-btn {
                min-width: 108px;
                color: #d13084;
                background: rgba(255, 255, 255, 0.96);
                border: 1px solid rgba(238, 104, 169, 0.45);
            }

            .hud-input-send-icon {
                width: 26px;
                height: 26px;
                align-self: center;
                justify-self: center;
                opacity: 0.9;
            }

            #action-row {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 8px;
            }

            #action-row button {
                min-height: 46px;
                color: #d12f84;
                border: 1px solid rgba(238, 104, 169, 0.42);
                background: rgba(255, 255, 255, 0.96);
            }

            #action-row button:disabled,
            #narrator-actions button:disabled,
            #add-btn:disabled {
                opacity: 0.56;
                cursor: default;
            }

            #narrator-panel {
                border-radius: 18px;
                border: 1px solid rgba(237, 109, 171, 0.36);
                background: rgba(255, 255, 255, 0.94);
                padding: 12px;
                display: grid;
                gap: 10px;
            }

            #narrator-panel-head {
                display: grid;
                grid-template-columns: auto 1fr auto;
                gap: 10px;
                align-items: start;
            }

            #narrator-avatar-column {
                display: grid;
                gap: 8px;
                align-content: start;
            }

            #narrator-ideas-board {
                position: relative;
                width: 160px;
                min-height: 84px;
                border-radius: 16px;
                padding: 10px 10px 8px;
                border: 1px solid rgba(237, 113, 174, 0.44);
                background:
                    radial-gradient(circle at 20% 12%, rgba(255,255,255,0.82), rgba(255,255,255,0)),
                    linear-gradient(140deg, rgba(255, 241, 250, 0.96), rgba(255, 227, 242, 0.94), rgba(255, 240, 248, 0.98));
                box-shadow:
                    0 8px 18px rgba(201, 45, 128, 0.2),
                    inset 0 1px 0 rgba(255,255,255,0.96);
                overflow: hidden;
            }

            #narrator-ideas-board::after {
                content: "";
                position: absolute;
                inset: -20% -60%;
                background: linear-gradient(110deg, rgba(255,255,255,0), rgba(255,255,255,0.42), rgba(255,255,255,0));
                animation: ideasBoardShimmer 2.4s linear infinite;
                pointer-events: none;
            }

            #narrator-ideas-title {
                color: #cb2f82;
                font: 800 10px/1 var(--font-ui);
                letter-spacing: 0.14em;
                text-transform: uppercase;
                margin-bottom: 6px;
            }

            #narrator-ideas-text {
                color: rgba(63, 23, 43, 0.84);
                font: 700 11px/1.35 var(--font-ui);
                max-height: 72px;
                overflow: auto;
                padding-right: 2px;
                animation: ideasBoardPulse 1.8s ease-in-out infinite;
            }

            #narrator-avatar-shell {
                width: 120px;
                height: 144px;
                border-radius: 24px;
                border: 1px solid rgba(240, 110, 173, 0.4);
                overflow: visible;
                background: radial-gradient(circle at 50% 22%, rgba(255,255,255,0.98), rgba(255, 242, 248, 0.95));
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.95);
                display: flex;
                align-items: end;
                justify-content: center;
            }

            #narrator-avatar {
                width: 100%;
                height: 100%;
                object-fit: contain;
                object-position: center bottom;
                transform-origin: center bottom;
            }

            #narrator-label {
                color: #d12e84;
                font: 800 22px/1.05 var(--font-display);
                letter-spacing: -0.02em;
            }

            #narrator-subtitle {
                margin-top: 3px;
                color: rgba(66, 25, 45, 0.74);
                font: 600 12px/1.35 var(--font-ui);
            }

            #narrator-copy {
                align-self: center;
            }

            #narrator-status-badge {
                background: rgba(255, 255, 255, 0.92);
                border: 1px solid rgba(240, 113, 174, 0.42);
                border-radius: 999px;
                min-height: 30px;
                padding: 0 10px;
                display: inline-flex;
                align-items: center;
                color: #d12f84;
                font: 800 10px/1 var(--font-ui);
                letter-spacing: 0.1em;
            }

            #hud-idea-pills {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
            }

            .hud-idea-pill {
                border: 1px solid rgba(236, 106, 169, 0.4);
                border-radius: 999px;
                background: rgba(255,255,255,0.9);
                min-height: 32px;
                padding: 0 11px;
                color: #ca2f81;
                font: 700 11px/1 var(--font-ui);
            }

            #narrator-output {
                min-height: 70px;
                border-radius: 14px;
                border: 1px solid rgba(238, 112, 173, 0.35);
                background: rgba(255, 255, 255, 0.9);
                color: rgba(63, 23, 43, 0.82);
                padding: 10px;
                font: 600 13px/1.45 var(--font-ui);
                white-space: pre-wrap;
            }

            #narrator-actions {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 8px;
            }

            #narrator-live-btn {
                color: #d13084;
                border: 1px solid rgba(236, 104, 168, 0.45);
                background: rgba(255, 255, 255, 0.96);
            }

            #narrator-send-btn {
                color: white;
                background: linear-gradient(180deg, #ff4ea0, #e52483);
            }

            @keyframes ideasBoardShimmer {
                from {
                    transform: translateX(-45%);
                }
                to {
                    transform: translateX(35%);
                }
            }

            @keyframes ideasBoardPulse {
                0% {
                    transform: translateY(0);
                }
                50% {
                    transform: translateY(-1px);
                }
                100% {
                    transform: translateY(0);
                }
            }

            #object-selection-row {
                display: flex;
                gap: 8px;
                overflow: auto;
            }

            .hud-slot-btn {
                min-height: 32px;
                border-radius: 999px;
                border: 1px solid rgba(237, 110, 171, 0.42);
                background: rgba(255, 255, 255, 0.92);
                color: #cc2f82;
                font: 800 11px/1 var(--font-ui);
                padding: 0 10px;
                letter-spacing: 0.07em;
                text-transform: uppercase;
            }

            .hud-slot-btn.is-active {
                background: linear-gradient(180deg, #ff50a2, #e11f80);
                color: white;
            }

            @media (max-width: 520px) {
                #barbie-hud #hud-bottom,
                #barbie-hud.is-ready #hud-bottom {
                    inset: auto 0 calc(env(safe-area-inset-bottom, 0px) + 8px) 0 !important;
                }

                .hud-card-shell {
                    width: min(calc(100vw - 16px), 440px);
                    border-radius: 24px;
                    padding: 10px;
                }

                #hud-home-hero {
                    grid-template-columns: 1fr;
                    gap: 4px;
                }

                #hud-home-glimmer {
                    max-width: 130px;
                    justify-self: center;
                }

                #hud-home-features {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }

                #hud-scan-controls {
                    grid-template-columns: 1fr;
                }

                #add-btn.hud-floating-cta {
                    width: 100%;
                }
            }
        `;
        document.head.append(style);
    }
}
