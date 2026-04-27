import { Behaviour } from "@needle-tools/engine";
import { deletePage, getAllPages, savePage, type ScrapbookPage } from "../store/ScrapbookStore";
import defaultBookCoverUrl from "../assets/storybook/default-book-cover.png?url";
import pageQuiltedPinkUrl from "../assets/storybook/backgrounds/page-quilted-pink.png?url";
import pageCloudsUrl from "../assets/storybook/backgrounds/page-clouds.png?url";
import pageGlitterUrl from "../assets/storybook/backgrounds/page-glitter.png?url";
import pageBowsHeartsUrl from "../assets/storybook/backgrounds/page-bows-hearts.png?url";
import pageInfiniteBowsHeartsUrl from "../assets/storybook/backgrounds/page-infinite-bows-hearts.png?url";
import { playSfx } from "../utils/AudioPlayer";

type BookTheme = {
    id: string;
    label: string;
    coverUrl: string;
};

type PageBackgroundAsset = {
    id: string;
    label: string;
    url: string;
};

const BOOK_THEMES: BookTheme[] = [
    { id: "default", label: "Classic Pink", coverUrl: defaultBookCoverUrl },
];

const PAGE_BACKGROUNDS: readonly PageBackgroundAsset[] = [
    { id: "quilted", label: "Quilted Pink", url: pageQuiltedPinkUrl },
    { id: "clouds", label: "Clouds", url: pageCloudsUrl },
    { id: "glitter", label: "Glitter", url: pageGlitterUrl },
    { id: "bows-hearts", label: "Bows + Hearts", url: pageBowsHeartsUrl },
] as const;

function makeImageDataUrl(page: ScrapbookPage, usePolished = true): string {
    if (usePolished && page.polishedImageBase64) {
        return `data:${page.polishedMimeType || page.mimeType || "image/jpeg"};base64,${page.polishedImageBase64}`;
    }
    return `data:${page.mimeType || "image/jpeg"};base64,${page.imageBase64}`;
}

function getSeed(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = ((hash << 5) - hash) + id.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function getBackgroundAsset(page: ScrapbookPage): PageBackgroundAsset {
    if (page.backgroundId) {
        const match = PAGE_BACKGROUNDS.find(asset => asset.id === page.backgroundId);
        if (match) return match;
    }
    return PAGE_BACKGROUNDS[getSeed(page.id) % PAGE_BACKGROUNDS.length];
}

export class ScrapbookUI extends Behaviour {
    static instance: ScrapbookUI | null = null;

    private overlay!: HTMLDivElement;
    private coverStage!: HTMLDivElement;
    private coverArtButton!: HTMLButtonElement;
    private coverArtImage!: HTMLImageElement;
    private coverStrip!: HTMLDivElement;
    private feedStage!: HTMLDivElement;
    private feedList!: HTMLDivElement;
    private emptyState!: HTMLDivElement;
    private viewer!: HTMLDivElement;
    private viewerImage!: HTMLImageElement;
    private viewerCaption!: HTMLDivElement;

    private pages: ScrapbookPage[] = [];
    private activeThemeId = BOOK_THEMES[0].id;

    static toggle(): void {
        void ScrapbookUI.instance?.toggle();
    }

    static open(): void {
        void ScrapbookUI.instance?.open();
    }

    static close(): void {
        ScrapbookUI.instance?.close();
    }

    static isOpen(): boolean {
        return !!ScrapbookUI.instance && !ScrapbookUI.instance.overlay.hidden;
    }

    awake(): void {
        ScrapbookUI.instance = this;
        this.injectStyles();
        this.injectMarkup();
    }

    onDestroy(): void {
        this.overlay?.remove();
        if (ScrapbookUI.instance === this) ScrapbookUI.instance = null;
    }

    async toggle(): Promise<void> {
        if (this.overlay.hidden) await this.open();
        else this.close();
    }

    async open(): Promise<void> {
        if (!this.overlay.hidden) return;
        this.overlay.hidden = false;
        this.getOverlayHost().style.overflow = "hidden";
        window.dispatchEvent(new CustomEvent("barbie-scrapbook-visibilitychange", { detail: { open: true } }));
        this.showCover();
        await this.loadPages();
    }

    close(): void {
        if (this.overlay.hidden) return;
        this.closeViewer();
        this.overlay.hidden = true;
        this.getOverlayHost().style.overflow = "";
        window.dispatchEvent(new CustomEvent("barbie-scrapbook-visibilitychange", { detail: { open: false } }));
    }

    private get activeTheme(): BookTheme {
        return BOOK_THEMES.find(theme => theme.id === this.activeThemeId) ?? BOOK_THEMES[0];
    }

    private async loadPages(): Promise<void> {
        try {
            this.pages = await getAllPages();
        }
        catch {
            this.pages = [];
        }
        this.renderCoverPicker();
        this.renderFeed();
    }

    private showCover(): void {
        playSfx("page_turn", 0.6);
        this.coverStage.hidden = false;
        this.feedStage.hidden = true;
        this.coverArtImage.src = this.activeTheme.coverUrl;
        this.coverArtImage.alt = `${this.activeTheme.label} cover`;
    }

    private showFeed(): void {
        playSfx("page_turn", 0.6);
        this.coverStage.hidden = true;
        this.feedStage.hidden = false;
        this.renderFeed();
    }

    private renderCoverPicker(): void {
        this.coverStrip.replaceChildren();
        if (BOOK_THEMES.length <= 1) {
            this.coverStrip.hidden = true;
            return;
        }
        this.coverStrip.hidden = false;
        BOOK_THEMES.forEach((theme) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "storybook-cover-chip";
            if (theme.id === this.activeThemeId) button.classList.add("is-active");
            button.textContent = theme.label;
            button.addEventListener("click", () => {
                this.activeThemeId = theme.id;
                this.coverArtImage.src = theme.coverUrl;
                this.renderCoverPicker();
            });
            this.coverStrip.append(button);
        });
    }

    private renderFeed(): void {
        this.feedList.replaceChildren();
        this.emptyState.hidden = this.pages.length > 0;
        if (this.pages.length === 0) return;

        this.pages.forEach((page, index) => {
            const backgroundAsset = getBackgroundAsset(page);

            const card = document.createElement("article");
            card.className = "storybook-feed-card";
            card.style.setProperty("--page-background", `url("${backgroundAsset.url}")`);

            const mediaButton = document.createElement("button");
            mediaButton.type = "button";
            mediaButton.className = "storybook-media-button";
            mediaButton.addEventListener("click", () => this.openViewer(page));

            const media = document.createElement("div");
            media.className = "storybook-media";
            media.style.setProperty("--media-aspect", "0.82");

            const image = document.createElement("img");
            image.className = "storybook-photo";
            image.src = makeImageDataUrl(page);
            image.alt = page.caption || "Storybook memory";
            image.decoding = "async";
            image.loading = "lazy";
            image.onerror = () => {
                if (page.polishedImageBase64) image.src = makeImageDataUrl(page, true);
            };

            media.append(image);
            mediaButton.append(media);

            const text = document.createElement("div");
            text.className = "storybook-text";

            const captionInput = document.createElement("textarea");
            captionInput.className = "storybook-caption-input";
            captionInput.rows = 2;
            captionInput.placeholder = "Write your caption...";
            captionInput.value = page.caption;

            const prompt = document.createElement("div");
            prompt.className = "storybook-prompt";
            prompt.textContent = page.characterPrompt;

            const meta = document.createElement("div");
            meta.className = "storybook-meta";
            meta.textContent = this.formatDate(page.timestamp, index);

            const actions = document.createElement("div");
            actions.className = "storybook-actions";

            const saveButton = document.createElement("button");
            saveButton.type = "button";
            saveButton.className = "storybook-action-btn is-primary";
            saveButton.textContent = "SAVE";
            saveButton.addEventListener("click", () => {
                void this.updatePage(page, { caption: captionInput.value.trim() }, saveButton, "SAVED");
            });

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "storybook-action-btn is-danger";
            deleteButton.textContent = "DELETE";
            deleteButton.addEventListener("click", () => {
                void this.removePage(page.id, deleteButton);
            });

            actions.append(saveButton, deleteButton);

            text.append(captionInput, prompt, meta, actions);
            card.append(mediaButton, text);
            this.feedList.append(card);
        });
    }

    private formatDate(timestamp: number, index: number): string {
        const date = new Date(timestamp);
        const pretty = Number.isNaN(date.getTime())
            ? "Saved moment"
            : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
        return `${pretty} - Memory ${index + 1}`;
    }

    private async updatePage(
        page: ScrapbookPage,
        patch: Partial<ScrapbookPage>,
        button?: HTMLButtonElement,
        successText = "DONE"
    ): Promise<void> {
        const nextPage = { ...page, ...patch };
        if (button) {
            button.disabled = true;
            button.textContent = "SAVING...";
        }
        await savePage(nextPage);
        const pageIndex = this.pages.findIndex(entry => entry.id === page.id);
        if (pageIndex >= 0) this.pages[pageIndex] = nextPage;
        this.renderFeed();
        if (button) {
            button.disabled = false;
            button.textContent = successText;
            window.setTimeout(() => {
                button.textContent = button.classList.contains("is-primary") ? "SAVE" : "AUTO CAPTION";
            }, 900);
        }
    }

    private async removePage(id: string, button: HTMLButtonElement): Promise<void> {
        button.disabled = true;
        button.textContent = "DELETING...";
        playSfx("delete", 0.6);
        await deletePage(id);
        this.pages = this.pages.filter(page => page.id !== id);
        this.renderFeed();
    }

    private openViewer(page: ScrapbookPage): void {
        this.viewer.hidden = false;
        this.viewerImage.src = makeImageDataUrl(page);
        this.viewerImage.alt = page.caption || "Storybook memory";
        this.viewerImage.decoding = "async";
        this.viewerImage.onerror = () => {
            if (page.polishedImageBase64) this.viewerImage.src = makeImageDataUrl(page, true);
        };
        this.viewerCaption.textContent = page.caption
            ? `${page.caption} - ${page.characterPrompt}`
            : page.characterPrompt;
    }

    private closeViewer(): void {
        this.viewer.hidden = true;
        this.viewerImage.onerror = null;
        this.viewerImage.removeAttribute("src");
        this.viewerCaption.textContent = "";
    }

    private injectMarkup(): void {
        const overlay = document.createElement("div");
        overlay.id = "scrapbook-overlay";
        overlay.hidden = true;
        overlay.dataset.barbieOverlay = "true";
        overlay.innerHTML = `
            <div id="storybook-topbar">
                <div id="storybook-topbar-title">Barbie Storybook</div>
                <button id="scrapbook-close" type="button" aria-label="Close storybook">X</button>
            </div>

            <section id="storybook-cover-stage">
                <div id="storybook-cover-copy">
                    <div class="storybook-kicker">YOUR BOOK</div>
                    <div class="storybook-headline">Start with the classic cover, then open into your saved memories.</div>
                </div>
                <button id="storybook-cover-art" type="button" aria-label="Open storybook">
                    <img id="storybook-cover-image" alt="" />
                </button>
                <div id="storybook-cover-hint">Tap the book to open</div>
                <div id="storybook-cover-strip" hidden></div>
            </section>

            <section id="storybook-feed-stage" hidden>
                <div id="storybook-feed-header">
                    <button id="storybook-back-to-cover" type="button">COVER</button>
                    <div id="storybook-feed-copy">
                        <div class="storybook-kicker">STORYBOOK FEED</div>
                        <div class="storybook-feed-title">Your Barbie memories</div>
                    </div>
                </div>
                <div id="storybook-empty" hidden>Your first polished page will appear here.</div>
                <div id="storybook-feed-list"></div>
            </section>

            <div id="scrapbook-viewer" hidden>
                <button id="scrapbook-viewer-close" type="button" aria-label="Close image preview">X</button>
                <img id="scrapbook-viewer-image" alt="" />
                <div id="scrapbook-viewer-caption"></div>
            </div>
        `;

        this.getOverlayHost().append(overlay);

        this.overlay = overlay;
        this.coverStage = overlay.querySelector("#storybook-cover-stage") as HTMLDivElement;
        this.coverArtButton = overlay.querySelector("#storybook-cover-art") as HTMLButtonElement;
        this.coverArtImage = overlay.querySelector("#storybook-cover-image") as HTMLImageElement;
        this.coverStrip = overlay.querySelector("#storybook-cover-strip") as HTMLDivElement;
        this.feedStage = overlay.querySelector("#storybook-feed-stage") as HTMLDivElement;
        this.feedList = overlay.querySelector("#storybook-feed-list") as HTMLDivElement;
        this.emptyState = overlay.querySelector("#storybook-empty") as HTMLDivElement;
        this.viewer = overlay.querySelector("#scrapbook-viewer") as HTMLDivElement;
        this.viewerImage = overlay.querySelector("#scrapbook-viewer-image") as HTMLImageElement;
        this.viewerCaption = overlay.querySelector("#scrapbook-viewer-caption") as HTMLDivElement;

        (overlay.querySelector("#scrapbook-close") as HTMLButtonElement).addEventListener("click", (event) => {
            event.stopPropagation();
            this.close();
        });
        this.coverArtButton.addEventListener("click", () => this.showFeed());
        (overlay.querySelector("#storybook-back-to-cover") as HTMLButtonElement).addEventListener("click", () => this.showCover());
        (overlay.querySelector("#scrapbook-viewer-close") as HTMLButtonElement).addEventListener("click", (event) => {
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
        const existingRoot = Array.from(host.children).find(child => child instanceof HTMLElement && child.id === "barbie-overlay-root");
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
            #scrapbook-overlay[hidden],
            #scrapbook-viewer[hidden],
            #storybook-cover-stage[hidden],
            #storybook-feed-stage[hidden],
            #storybook-cover-strip[hidden],
            #storybook-empty[hidden] {
                display: none !important;
            }

            #scrapbook-overlay {
                position: fixed;
                inset: 0;
                z-index: 1000;
                display: flex;
                flex-direction: column;
                background:
                    linear-gradient(180deg, rgba(255, 248, 252, 0.82), rgba(248, 234, 241, 0.82)),
                    url("${pageInfiniteBowsHeartsUrl}");
                background-size: auto, 340px auto;
                background-repeat: repeat;
                color: var(--brand-ink);
                font-family: var(--font-display);
                pointer-events: auto;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
            }

            #storybook-topbar {
                position: sticky;
                top: 0;
                z-index: 2;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: calc(env(safe-area-inset-top, 0px) + 16px) 18px 12px;
                background: rgba(255, 247, 251, 0.88);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
            }

            #storybook-topbar-title {
                font-size: 28px;
                font-weight: 700;
                letter-spacing: -0.05em;
            }

            #scrapbook-close,
            #storybook-back-to-cover,
            #scrapbook-viewer-close,
            .storybook-cover-chip,
            .storybook-cycle-btn,
            .storybook-action-btn {
                min-height: 46px;
                border: 1px solid rgba(173, 68, 118, 0.16);
                background: rgba(255, 255, 255, 0.86);
                color: var(--brand-ink);
                border-radius: 999px;
                cursor: pointer;
                font-family: var(--font-ui);
                font-weight: 700;
                letter-spacing: 0.08em;
                touch-action: manipulation;
            }

            #scrapbook-close,
            #scrapbook-viewer-close {
                min-width: 48px;
                font-size: 20px;
            }

            #storybook-cover-stage {
                min-height: calc(100dvh - 84px);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 18px 16px calc(env(safe-area-inset-bottom, 0px) + 24px);
            }

            #storybook-cover-copy {
                width: min(92vw, 520px);
                text-align: center;
                margin-bottom: 18px;
            }

            .storybook-kicker {
                font-family: var(--font-ui);
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.22em;
                text-transform: uppercase;
                color: rgba(154, 36, 97, 0.68);
                margin-bottom: 10px;
            }

            .storybook-headline,
            .storybook-feed-title {
                font-size: clamp(24px, 4vw, 38px);
                line-height: 1.05;
                font-weight: 700;
            }

            #storybook-cover-art {
                display: block;
                width: min(76vw, 420px);
                padding: 0;
                border: 0;
                background: transparent;
                cursor: pointer;
            }

            #storybook-cover-image {
                display: block;
                width: 100%;
                height: auto;
                filter: drop-shadow(0 22px 34px rgba(124, 31, 79, 0.18));
            }

            #storybook-cover-hint {
                margin-top: 16px;
                font-family: var(--font-ui);
                font-size: 12px;
                font-weight: 700;
                letter-spacing: 0.16em;
                text-transform: uppercase;
                color: rgba(154, 36, 97, 0.64);
            }

            #storybook-cover-strip {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
                justify-content: center;
                margin-top: 18px;
            }

            .storybook-cover-chip {
                padding: 0 18px;
            }

            .storybook-cover-chip.is-active {
                background: linear-gradient(180deg, rgba(255, 226, 239, 0.98), rgba(255, 246, 250, 0.98));
                box-shadow: 0 10px 24px rgba(164, 51, 104, 0.12);
            }

            #storybook-feed-stage {
                padding: 8px 12px calc(env(safe-area-inset-bottom, 0px) + 28px);
            }

            #storybook-feed-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 18px;
            }

            #storybook-back-to-cover {
                padding: 0 18px;
                flex: 0 0 auto;
            }

            #storybook-feed-copy {
                min-width: 0;
            }

            #storybook-feed-list {
                display: flex;
                flex-direction: column;
                gap: 18px;
                width: min(100%, 760px);
                margin: 0 auto;
            }

            #storybook-empty {
                padding: 48px 20px;
                text-align: center;
                font-size: 28px;
                line-height: 1.08;
                color: rgba(154, 36, 97, 0.44);
            }

            .storybook-feed-card {
                display: flex;
                flex-direction: column;
                gap: 14px;
                padding: 16px;
                background:
                    linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(255, 250, 252, 0.76)),
                    var(--page-background);
                background-size: cover;
                background-position: center;
                border-radius: 30px;
                border: 1px solid rgba(173, 68, 118, 0.08);
                box-shadow:
                    0 14px 34px rgba(104, 37, 72, 0.08),
                    inset 0 0 0 1px rgba(255, 255, 255, 0.32);
            }

            .storybook-media-button {
                display: block;
                padding: 0;
                border: 0;
                background: transparent;
                cursor: zoom-in;
                text-align: left;
                width: 100%;
            }

            .storybook-media {
                position: relative;
                width: min(100%, 430px);
                aspect-ratio: var(--media-aspect, 0.8);
                margin: 0 auto;
                overflow: hidden;
                border-radius: 26px;
                background: rgba(255, 255, 255, 0.68);
                box-shadow:
                    0 12px 28px rgba(104, 37, 72, 0.09),
                    inset 0 0 0 1px rgba(255, 255, 255, 0.38);
            }

            .storybook-photo {
                display: block;
                width: 100%;
                height: 100%;
                object-fit: cover;
                object-position: center;
            }

            .storybook-text {
                display: flex;
                flex-direction: column;
                gap: 10px;
                padding: 2px;
            }

            .storybook-caption-input {
                width: 100%;
                min-height: 80px;
                resize: vertical;
                border-radius: 20px;
                border: 1px solid rgba(189, 132, 160, 0.24);
                background: linear-gradient(180deg, rgba(255, 252, 245, 0.96), rgba(255, 248, 239, 0.96));
                padding: 16px 18px;
                color: rgba(122, 52, 88, 0.96);
                font-family: var(--font-display);
                font-size: clamp(18px, 2.3vw, 24px);
                line-height: 1.18;
                font-weight: 700;
                box-shadow:
                    0 8px 18px rgba(104, 37, 72, 0.06),
                    inset 0 0 0 1px rgba(255, 255, 255, 0.55);
                transform: rotate(-0.6deg);
            }

            .storybook-prompt {
                font-size: 15px;
                line-height: 1.4;
                color: rgba(99, 45, 73, 0.76);
            }

            .storybook-meta {
                font-family: var(--font-ui);
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.16em;
                text-transform: uppercase;
                color: rgba(154, 36, 97, 0.6);
            }

            .storybook-actions {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }

            .storybook-action-btn {
                padding: 0 14px;
                min-height: 42px;
                font-size: 11px;
            }

            .storybook-action-btn.is-primary {
                background: linear-gradient(180deg, rgba(255, 88, 169, 0.96), rgba(237, 58, 142, 0.96));
                color: white;
                border-color: rgba(206, 41, 120, 0.3);
            }

            .storybook-action-btn.is-danger {
                background: rgba(103, 26, 61, 0.08);
                color: rgba(103, 26, 61, 0.92);
            }

            #scrapbook-viewer {
                position: fixed;
                inset: 0;
                z-index: 1100;
                background: rgba(42, 16, 32, 0.72);
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
                background: rgba(255, 255, 255, 0.78);
                border-radius: 24px;
                box-shadow: 0 22px 58px rgba(76, 27, 53, 0.26);
            }

            #scrapbook-viewer-caption {
                width: min(92vw, 900px);
                font-size: 16px;
                line-height: 1.5;
                color: #fff7fb;
                text-align: center;
            }

            #scrapbook-viewer-close {
                position: absolute;
                top: calc(env(safe-area-inset-top, 0px) + 20px);
                right: 16px;
            }

            @media (max-width: 760px) {
                #storybook-topbar-title {
                    font-size: 22px;
                }

                #storybook-cover-art {
                    width: min(86vw, 420px);
                }

                .storybook-feed-card {
                    padding: 14px;
                }

                .storybook-caption-input {
                    min-height: 72px;
                    font-size: 18px;
                }

                .storybook-prompt {
                    font-size: 14px;
                }
            }
        `;
        document.head.append(style);
    }
}
