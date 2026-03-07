import { Behaviour } from "@needle-tools/engine";
import { getAllPages, type ScrapbookPage } from "../store/ScrapbookStore";

const TAPE_COLORS = [
    "rgba(255,180,100,0.8)",
    "rgba(180,220,255,0.8)",
    "rgba(200,255,180,0.8)",
    "rgba(255,180,220,0.8)",
];

export class ScrapbookUI extends Behaviour {
    static instance: ScrapbookUI | null = null;

    private overlay!: HTMLDivElement;
    private grid!: HTMLDivElement;
    private emptyState!: HTMLDivElement;

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
        this.overlay.hidden = !shouldShow;
        const overlayHost = this.getOverlayHost();
        overlayHost.style.overflow = shouldShow ? "hidden" : "";

        if (shouldShow) await this.loadPages();
    }

    async loadPages(): Promise<void> {
        try {
            this.renderPages(await getAllPages());
        }
        catch {
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

            const tape = document.createElement("div");
            tape.className = "washi-tape";
            tape.style.background = TAPE_COLORS[index % TAPE_COLORS.length];

            const image = document.createElement("img");
            image.src = `data:image/jpeg;base64,${page.imageBase64}`;
            image.alt = page.caption;

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
                <button id="scrapbook-close" type="button" aria-label="Close scrapbook">✕</button>
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

    private injectStyles(): void {
        if (document.getElementById("barbie-scrapbook-styles")) return;

        const style = document.createElement("style");
        style.id = "barbie-scrapbook-styles";
        style.textContent = `
            #scrapbook-overlay {
                position: fixed;
                inset: 0;
                background: #FFF6F0;
                z-index: 1000;
                overflow-y: auto;
                font-family: "Fraunces", serif;
                color: #3a1a2a;
            }

            #scrapbook-header {
                position: sticky;
                top: 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 24px;
                background: #FFF6F0;
                border-bottom: 1px solid rgba(200,100,130,0.2);
            }

            #scrapbook-title {
                font-size: 24px;
                font-style: italic;
                color: #C0185A;
            }

            #scrapbook-close {
                min-width: 44px;
                min-height: 44px;
                border: none;
                background: none;
                color: #C0185A;
                font-size: 20px;
                cursor: pointer;
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
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                overflow: hidden;
                cursor: pointer;
                transition: transform 0.2s ease;
            }

            .page-card img {
                display: block;
                width: 100%;
                aspect-ratio: 4 / 3;
                object-fit: cover;
            }

            .page-card .card-caption {
                padding: 10px 12px;
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

            @media (max-width: 480px) {
                #scrapbook-grid {
                    grid-template-columns: 1fr;
                }
            }
        `;

        document.head.append(style);
    }
}
