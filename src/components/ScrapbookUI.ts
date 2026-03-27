import { Behaviour } from "@needle-tools/engine";
import { getAllPages, type ScrapbookPage } from "../store/ScrapbookStore";
import { exportDebugLogs, logDebug } from "../utils/DebugLog";

const TAPE_COLORS = [
    "rgba(255,180,100,0.8)",
    "rgba(180,220,255,0.8)",
    "rgba(200,255,180,0.8)",
    "rgba(255,180,220,0.8)",
];

function makeImageDataUrl(page: ScrapbookPage, usePolished = false): string {
    if (usePolished && page.polishedImageBase64) {
        return `data:${page.polishedMimeType || page.mimeType || "image/jpeg"};base64,${page.polishedImageBase64}`;
    }
    return `data:${page.mimeType || "image/jpeg"};base64,${page.imageBase64}`;
}

export class ScrapbookUI extends Behaviour {
    static instance: ScrapbookUI | null = null;

    private overlay!: HTMLDivElement;
    private grid!: HTMLDivElement;
    private emptyState!: HTMLDivElement;
    private viewer!: HTMLDivElement;
    private viewerImage!: HTMLImageElement;
    private viewerCaption!: HTMLDivElement;
    private exportLogsButton!: HTMLButtonElement;

    static toggle(): void {
        void ScrapbookUI.instance?.toggle();
    }

    awake(): void {
        ScrapbookUI.instance = this;
        this.injectStyles();
        this.injectMarkup();
    }

    onDestroy(): void {
        this.overlay?.remove();
        if (ScrapbookUI.instance === this) {
            ScrapbookUI.instance = null;
        }
    }

    async toggle(): Promise<void> {
        const shouldShow = this.overlay.hidden;
        if (!shouldShow) this.closeViewer();
        this.overlay.hidden = !shouldShow;
        const overlayHost = this.getOverlayHost();
        overlayHost.style.overflow = shouldShow ? "hidden" : "";
        logDebug("scrapbook.toggle", { open: shouldShow });

        if (shouldShow) await this.loadPages();
    }

    async loadPages(): Promise<void> {
        try {
            this.renderPages(await getAllPages());
        }
        catch (error) {
            logDebug("scrapbook.load_failed", {
                message: error instanceof Error ? error.message : String(error),
            });
            this.renderPages([]);
        }
    }

    private renderPages(pages: ScrapbookPage[]): void {
        this.grid.innerHTML = "";
        this.emptyState.hidden = pages.length > 0;

        pages.forEach((page, index) => {
            const card = document.createElement("article");
            card.className = "page-card";
            card.style.transform = `rotate(${this.getRotationFromId(page.id)}deg)`;
            card.addEventListener("click", () => this.openViewer(page));

            const tape = document.createElement("div");
            tape.className = "washi-tape";
            tape.style.background = TAPE_COLORS[index % TAPE_COLORS.length];

            const image = document.createElement("img");
            image.src = makeImageDataUrl(page);
            image.alt = page.caption;
            image.loading = "lazy";
            image.decoding = "async";
            image.addEventListener("error", () => {
                if (page.polishedImageBase64) {
                    image.src = makeImageDataUrl(page, true);
                }
            });

            const caption = document.createElement("div");
            caption.className = "card-caption";
            caption.textContent = page.caption;

            const world = document.createElement("div");
            world.className = "card-world";
            world.textContent = page.characterPrompt;

            card.append(tape, image, caption, world);
            this.grid.append(card);
        });
    }

    private openViewer(page: ScrapbookPage): void {
        logDebug("scrapbook.viewer_open", { id: page.id });
        this.viewer.hidden = false;
        this.viewerImage.src = makeImageDataUrl(page);
        this.viewerImage.alt = page.caption;
        this.viewerImage.decoding = "async";
        this.viewerImage.onerror = () => {
            if (page.polishedImageBase64) {
                this.viewerImage.src = makeImageDataUrl(page, true);
            }
        };
        this.viewerCaption.textContent = `${page.caption} • ${page.characterPrompt}`;
        this.overlay.style.overflow = "hidden";
    }

    private closeViewer(): void {
        logDebug("scrapbook.viewer_close");
        this.viewer.hidden = true;
        this.viewerImage.onerror = null;
        this.viewerImage.removeAttribute("src");
        this.viewerCaption.textContent = "";
        this.overlay.style.overflowY = "auto";
    }

    private getRotationFromId(id: string): number {
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            hash = ((hash << 5) - hash) + id.charCodeAt(i);
            hash |= 0;
        }
        return ((Math.abs(hash) % 400) / 100) - 2;
    }

    private injectMarkup(): void {
        const overlay = document.createElement("div");
        overlay.id = "scrapbook-overlay";
        overlay.hidden = true;
        overlay.dataset.barbieOverlay = "true";
        overlay.innerHTML = `
            <div id="scrapbook-header">
                <span id="scrapbook-title">Barbie's Storybook</span>
                <div id="scrapbook-header-actions">
                    <button id="scrapbook-export-logs" type="button" aria-label="Export debug logs">LOGS</button>
                    <button id="scrapbook-close" type="button" aria-label="Close scrapbook">X</button>
                </div>
            </div>
            <div id="scrapbook-grid"></div>
            <div id="scrapbook-empty" hidden>Your story starts here ✨</div>
            <div id="scrapbook-viewer" hidden>
                <button id="scrapbook-viewer-close" type="button" aria-label="Close image preview">X</button>
                <img id="scrapbook-viewer-image" alt="" />
                <div id="scrapbook-viewer-caption"></div>
            </div>
        `;

        this.getOverlayHost().append(overlay);

        this.overlay = overlay;
        this.grid = overlay.querySelector("#scrapbook-grid") as HTMLDivElement;
        this.emptyState = overlay.querySelector("#scrapbook-empty") as HTMLDivElement;
        this.viewer = overlay.querySelector("#scrapbook-viewer") as HTMLDivElement;
        this.viewerImage = overlay.querySelector("#scrapbook-viewer-image") as HTMLImageElement;
        this.viewerCaption = overlay.querySelector("#scrapbook-viewer-caption") as HTMLDivElement;

        const closeButton = overlay.querySelector("#scrapbook-close") as HTMLButtonElement;
        closeButton.addEventListener("click", (event) => {
            event.stopPropagation();
            void this.toggle();
        });

        this.exportLogsButton = overlay.querySelector("#scrapbook-export-logs") as HTMLButtonElement;
        this.exportLogsButton.addEventListener("click", (event) => {
            event.stopPropagation();
            logDebug("scrapbook.export_logs");
            exportDebugLogs();
        });

        const viewerCloseButton = overlay.querySelector("#scrapbook-viewer-close") as HTMLButtonElement;
        viewerCloseButton.addEventListener("click", (event) => {
            event.stopPropagation();
            this.closeViewer();
        });

        this.viewer.addEventListener("click", (event) => {
            if (event.target === this.viewer) this.closeViewer();
        });
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
        if (document.getElementById("barbie-scrapbook-styles")) return;

        const style = document.createElement("style");
        style.id = "barbie-scrapbook-styles";
        style.textContent = `
            #scrapbook-overlay {
                position: fixed;
                inset: 0;
                background: rgba(255, 246, 240, 0.992);
                z-index: 1000;
                overflow-y: auto;
                font-family: "Fraunces", serif;
                color: #3a1a2a;
                opacity: 1;
                isolation: isolate;
                pointer-events: auto;
                touch-action: pan-y;
            }

            #scrapbook-header {
                position: sticky;
                top: 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: calc(env(safe-area-inset-top, 0px) + 20px) 20px 20px;
                background: rgba(255, 246, 240, 0.995);
                border-bottom: 1px solid rgba(200,100,130,0.2);
                z-index: 2;
            }

            #scrapbook-header-actions {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            #scrapbook-title {
                font-size: 24px;
                font-style: italic;
                color: #C0185A;
            }

            #scrapbook-close,
            #scrapbook-export-logs,
            #scrapbook-viewer-close {
                min-width: 48px;
                min-height: 48px;
                padding: 0 14px;
                border: 1px solid rgba(192,24,90,0.14);
                background: rgba(255,255,255,0.92);
                color: #C0185A;
                border-radius: 999px;
                cursor: pointer;
                touch-action: manipulation;
            }

            #scrapbook-export-logs {
                font-size: 14px;
            }

            #scrapbook-close,
            #scrapbook-viewer-close {
                font-size: 20px;
            }

            #scrapbook-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 16px;
                padding: 20px;
            }

            #scrapbook-empty {
                padding: 72px 24px;
                text-align: center;
                font-size: 24px;
                font-style: italic;
                color: #C0185A;
            }

            .page-card {
                background: #ffffff;
                border-radius: 14px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                overflow: hidden;
                cursor: zoom-in;
                transition: transform 0.2s ease;
                display: flex;
                flex-direction: column;
            }

            .page-card img {
                display: block;
                width: 100%;
                aspect-ratio: 4 / 5;
                object-fit: contain;
                background: #FFF7F2;
            }

            .page-card .card-caption {
                padding: 10px 12px 4px;
                font-size: 12px;
                font-style: italic;
                line-height: 1.5;
                color: #3a1a2a;
            }

            .page-card .card-world {
                padding: 0 12px 10px;
                font-family: "DM Mono", monospace;
                font-size: 9px;
                color: #FF2472;
                text-transform: uppercase;
                letter-spacing: 1px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .washi-tape {
                height: 14px;
                width: 48px;
                margin: 10px auto 4px;
                border-radius: 2px;
                opacity: 0.7;
                transform: rotate(-2deg);
            }

            #scrapbook-viewer {
                position: fixed;
                inset: 0;
                z-index: 1100;
                background: rgba(255, 246, 240, 0.992);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 16px;
                padding: calc(env(safe-area-inset-top, 0px) + 24px) 24px calc(env(safe-area-inset-bottom, 0px) + 24px);
                pointer-events: auto;
            }

            #scrapbook-viewer-image {
                width: min(92vw, 900px);
                max-height: 72vh;
                object-fit: contain;
                background: #fffaf6;
                border-radius: 18px;
                box-shadow: 0 16px 50px rgba(0,0,0,0.12);
            }

            #scrapbook-viewer-caption {
                width: min(92vw, 900px);
                font-size: 16px;
                line-height: 1.5;
                color: #3a1a2a;
                text-align: center;
            }

            #scrapbook-viewer-close {
                position: absolute;
                top: calc(env(safe-area-inset-top, 0px) + 20px);
                right: 16px;
            }

            @media (max-width: 480px) {
                #scrapbook-grid {
                    grid-template-columns: 1fr;
                }

                #scrapbook-header {
                    padding-left: 16px;
                    padding-right: 16px;
                }

                #scrapbook-title {
                    font-size: 22px;
                }
            }
        `;

        document.head.append(style);
    }
}
