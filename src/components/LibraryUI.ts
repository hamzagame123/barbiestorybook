import { Behaviour } from "@needle-tools/engine";
import { PRESET_BACKGROUNDS, type PresetBackgroundId } from "../presets/PresetBackgrounds";
import { PRESET_CHARACTERS, type PresetCharacterId } from "../presets/PresetCharacters";
import { LIBRARY_ACCESSORIES, type LibraryAccessoryId } from "../presets/LibraryAccessories";

export type LibrarySelectEventDetail =
    | { kind: "background"; id: PresetBackgroundId }
    | { kind: "character"; id: PresetCharacterId }
    | { kind: "accessory"; id: LibraryAccessoryId };

export class LibraryUI extends Behaviour {
    static instance: LibraryUI | null = null;

    private overlay!: HTMLDivElement;

    static toggle(): void {
        LibraryUI.instance?.toggle();
    }

    static open(): void {
        LibraryUI.instance?.open();
    }

    static close(): void {
        LibraryUI.instance?.close();
    }

    static isOpen(): boolean {
        return !!LibraryUI.instance && !LibraryUI.instance.overlay.hidden;
    }

    awake(): void {
        LibraryUI.instance = this;
        this.injectStyles();
        this.injectMarkup();
    }

    onDestroy(): void {
        this.overlay?.remove();
        if (LibraryUI.instance === this) LibraryUI.instance = null;
    }

    toggle(): void {
        if (this.overlay.hidden) this.open();
        else this.close();
    }

    open(): void {
        if (!this.overlay.hidden) return;
        this.overlay.hidden = false;
        window.dispatchEvent(new CustomEvent("barbie-library-visibilitychange", {
            detail: { open: true },
        }));
    }

    close(): void {
        if (this.overlay.hidden) return;
        this.overlay.hidden = true;
        window.dispatchEvent(new CustomEvent("barbie-library-visibilitychange", {
            detail: { open: false },
        }));
    }

    private injectMarkup(): void {
        const overlay = document.createElement("div");
        overlay.id = "library-overlay";
        overlay.hidden = true;
        overlay.dataset.barbieOverlay = "true";
        overlay.innerHTML = `
            <div id="library-shell">
                <div id="library-header">
                    <div>
                        <div id="library-kicker">STYLE CLOSET</div>
                        <div id="library-title">Cast the star, set the backdrop, and layer in story details</div>
                    </div>
                    <button id="library-close" type="button" aria-label="Close library">X</button>
                </div>
                <div id="library-body">
                    <section class="library-section">
                        <div class="library-section-title">SCENE SETS</div>
                        <div class="library-grid" id="library-backgrounds"></div>
                    </section>
                    <section class="library-section">
                        <div class="library-section-title">LEAD CHARACTERS</div>
                        <div class="library-grid" id="library-dolls"></div>
                    </section>
                    <section class="library-section">
                        <div class="library-section-title">FINISHING TOUCHES</div>
                        <div class="library-grid" id="library-accessories"></div>
                    </section>
                </div>
            </div>
        `;

        this.getOverlayHost().append(overlay);
        this.overlay = overlay;

        (overlay.querySelector("#library-close") as HTMLButtonElement).addEventListener("click", () => this.close());
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) this.close();
        });

        const backgroundGrid = overlay.querySelector("#library-backgrounds") as HTMLDivElement;
        PRESET_BACKGROUNDS.forEach((item) => {
            backgroundGrid.append(this.makeCard(item.previewUrl, item.label, item.title, "USE", () => {
                window.dispatchEvent(new CustomEvent<LibrarySelectEventDetail>("toybox-library-select", {
                    detail: { kind: "background", id: item.id },
                }));
                this.close();
            }));
        });

        const dollGrid = overlay.querySelector("#library-dolls") as HTMLDivElement;
        PRESET_CHARACTERS.forEach((item) => {
            dollGrid.append(this.makeCard(item.previewUrl, item.label, item.prompt, "LOAD", () => {
                window.dispatchEvent(new CustomEvent<LibrarySelectEventDetail>("toybox-library-select", {
                    detail: { kind: "character", id: item.id },
                }));
                this.close();
            }));
        });

        const accessoryGrid = overlay.querySelector("#library-accessories") as HTMLDivElement;
        LIBRARY_ACCESSORIES.forEach((item) => {
            const card = this.makeCard(item.previewUrl, item.label, item.note, "ADD TO SCENE", () => {
                window.dispatchEvent(new CustomEvent<LibrarySelectEventDetail>("toybox-library-select", {
                    detail: { kind: "accessory", id: item.id },
                }));
                this.close();
            });
            card.classList.add("is-glass-accessory");
            accessoryGrid.append(card);
        });
    }

    private makeCard(previewUrl: string, label: string, body: string, actionLabel: string, onAction: () => void): HTMLDivElement {
        const card = document.createElement("article");
        card.className = "library-card";

        const image = document.createElement("img");
        image.src = previewUrl;
        image.alt = label;
        image.loading = "lazy";
        image.decoding = "async";

        const meta = document.createElement("div");
        meta.className = "library-card-meta";

        const title = document.createElement("div");
        title.className = "library-card-title";
        title.textContent = label;

        const copy = document.createElement("div");
        copy.className = "library-card-copy";
        copy.textContent = body;

        const button = document.createElement("button");
        button.type = "button";
        button.textContent = actionLabel;
        button.addEventListener("click", onAction);

        meta.append(title, copy, button);
        card.append(image, meta);
        return card;
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
        overlayRoot.dataset.barbieOverlay = "true";
        overlayRoot.style.position = "fixed";
        overlayRoot.style.inset = "0";
        overlayRoot.style.zIndex = "9999";
        overlayRoot.style.pointerEvents = "none";
        host.append(overlayRoot);
        return overlayRoot;
    }

    private injectStyles(): void {
        if (document.getElementById("barbie-library-styles")) return;

        const style = document.createElement("style");
        style.id = "barbie-library-styles";
        style.textContent = `
            #library-overlay[hidden] {
                display: none !important;
                pointer-events: none !important;
            }

            #library-overlay {
                position: fixed;
                inset: 0;
                z-index: 1050;
                background:
                    radial-gradient(circle at top left, rgba(247, 190, 214, 0.22), transparent 24%),
                    rgba(42, 16, 32, 0.48);
                display: flex;
                align-items: stretch;
                justify-content: center;
                padding: calc(env(safe-area-inset-top, 0px) + 18px) 14px calc(env(safe-area-inset-bottom, 0px) + 18px);
                pointer-events: auto;
                backdrop-filter: blur(18px);
                -webkit-backdrop-filter: blur(18px);
            }

            #library-shell {
                width: min(980px, 100%);
                background:
                    radial-gradient(circle at top left, rgba(255,255,255,0.56), transparent 30%),
                    linear-gradient(180deg, rgba(255, 249, 252, 0.94), rgba(252, 238, 245, 0.92));
                border: 1px solid rgba(173, 68, 118, 0.12);
                border-radius: 32px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                box-shadow:
                    inset 0 1px 0 rgba(255,255,255,0.88),
                    0 28px 70px rgba(74, 24, 52, 0.2);
            }

            #library-header {
                position: sticky;
                top: 0;
                z-index: 2;
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
                padding: 18px 18px 14px;
                border-bottom: 1px solid rgba(173, 68, 118, 0.1);
                background: rgba(255, 247, 251, 0.92);
            }

            #library-kicker {
                color: var(--brand-rose-deep);
                font: 700 10px/1 var(--font-ui);
                letter-spacing: 0.24em;
            }

            #library-title {
                margin-top: 6px;
                max-width: 28ch;
                color: var(--brand-ink);
                font: 700 28px/1.02 var(--font-display);
                letter-spacing: -0.05em;
            }

            #library-close,
            .library-card button {
                min-height: 44px;
                border-radius: 18px;
                border: 1px solid rgba(173, 68, 118, 0.14);
                background: rgba(255,255,255,0.72);
                color: var(--brand-ink);
                font-family: var(--font-ui);
                font-weight: 700;
                letter-spacing: 0.08em;
            }

            #library-body {
                overflow-y: auto;
                padding: 18px;
                display: flex;
                flex-direction: column;
                gap: 20px;
            }

            .library-section {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .library-section-title {
                color: rgba(143, 47, 91, 0.68);
                font: 700 10px/1 var(--font-ui);
                letter-spacing: 0.22em;
            }

            .library-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                gap: 12px;
            }

            .library-card {
                overflow: hidden;
                border-radius: 24px;
                border: 1px solid rgba(173, 68, 118, 0.12);
                background: rgba(255,255,255,0.56);
                display: flex;
                flex-direction: column;
                box-shadow: 0 16px 36px rgba(93, 33, 65, 0.08);
            }

            .library-card.is-glass-accessory {
                border-color: rgba(255, 220, 236, 0.2);
                background:
                    linear-gradient(180deg, rgba(255,255,255,0.38), rgba(255,255,255,0.14)),
                    linear-gradient(135deg, rgba(247, 190, 214, 0.3), rgba(241, 200, 125, 0.12));
                box-shadow:
                    inset 0 1px 0 rgba(255,255,255,0.28),
                    0 16px 36px rgba(93, 33, 65, 0.14);
                backdrop-filter: blur(18px) saturate(1.12);
                -webkit-backdrop-filter: blur(18px) saturate(1.12);
            }

            .library-card.is-glass-accessory img {
                opacity: 0.92;
                mix-blend-mode: screen;
            }

            .library-card img {
                width: 100%;
                aspect-ratio: 4 / 5;
                object-fit: cover;
                display: block;
                background: rgba(255,255,255,0.03);
            }

            .library-card-meta {
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .library-card.is-glass-accessory .library-card-meta {
                background:
                    linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
            }

            .library-card-title {
                color: var(--brand-ink);
                font: 700 18px/1.05 var(--font-display);
                letter-spacing: -0.03em;
            }

            .library-card-copy {
                color: rgba(42, 16, 32, 0.64);
                font: 500 12px/1.5 var(--font-ui);
                min-height: 52px;
            }

            .library-card.is-glass-accessory .library-card-copy {
                color: rgba(42, 16, 32, 0.72);
            }

            .library-card.is-glass-accessory button {
                background: rgba(255,255,255,0.68);
                border-color: rgba(173, 68, 118, 0.14);
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.16);
            }

            @media (max-width: 640px) {
                #library-overlay {
                    padding-left: 10px;
                    padding-right: 10px;
                }

                .library-grid {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
            }
        `;
        document.head.append(style);
    }
}
