import { Behaviour, NeedleXRSession, type NeedleXREventArgs, findObjectOfType, WebXR } from "@needle-tools/engine";
import * as THREE from "three";

const FALLBACK_POSITION = new THREE.Vector3();
const EARLY_INPUT_QUEUE = -100;

type PlacementInputEvent = Event & {
    used?: boolean;
    source?: Event | null;
    stopImmediatePropagation?: () => void;
    stopPropagation?: () => void;
    use?: () => void;
};

type SurfaceChangeDetail = {
    surfaceDetected: boolean;
    placementConfirmed: boolean;
};

export class ARPlacement extends Behaviour {
    static instance: ARPlacement | null = null;
    static events = new EventTarget();

    static get surfaceDetected(): boolean {
        return ARPlacement.instance?.surfaceDetected ?? false;
    }

    static get lastHitPosition(): THREE.Vector3 {
        return ARPlacement.instance?.lastHitPosition ?? FALLBACK_POSITION;
    }

    static get placementConfirmed(): boolean {
        return ARPlacement.instance?.placementConfirmed ?? false;
    }

    surfaceDetected = false;
    lastHitPosition = new THREE.Vector3();
    placementConfirmed = false;

    private readonly reticle = new THREE.Mesh(
        new THREE.TorusGeometry(0.08, 0.008, 16, 64),
        new THREE.MeshBasicMaterial({
            color: new THREE.Color("#FF2472"),
            transparent: true,
            opacity: 0.92,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
        })
    );

    private readonly tapHandler = (event: PlacementInputEvent) => {
        const activeSession = NeedleXRSession.active;
        if (!activeSession?.isAR || !this.surfaceDetected || this.placementConfirmed) return;
        if (event.used) return;

        const sourceTarget = (event.source?.target ?? null) as HTMLElement | null;
        if (sourceTarget?.closest("[data-barbie-overlay='true']")) return;

        event.stopImmediatePropagation?.();
        event.stopPropagation?.();
        event.use?.();

        this.placementConfirmed = true;
        this.reticle.visible = false;

        ARPlacement.events.dispatchEvent(new CustomEvent("surfaceTapped", {
            detail: this.lastHitPosition.clone(),
        }));
        this.emitSurfaceChange();
    };

    awake(): void {
        ARPlacement.instance = this;
        this.reticle.name = "Barbie Placement Reticle";
        this.reticle.rotation.x = Math.PI / 2;
        this.reticle.visible = false;
        this.context.scene.add(this.reticle);
    }

    start(): void {
        const webXR = findObjectOfType(WebXR);
        if (!webXR) {
            void NeedleXRSession.start("ar", undefined, this.context).catch(() => undefined);
        }
    }

    onDestroy(): void {
        this.context.input.removeEventListener("pointerup", this.tapHandler as EventListener, { queue: EARLY_INPUT_QUEUE });
        this.reticle.removeFromParent();
        if (ARPlacement.instance === this) {
            ARPlacement.instance = null;
        }
    }

    onEnterXR(args: NeedleXREventArgs): void {
        if (!args.xr.isAR) return;
        this.context.input.addEventListener("pointerup", this.tapHandler as EventListener, { queue: EARLY_INPUT_QUEUE });
        this.surfaceDetected = false;
        this.placementConfirmed = false;
        this.reticle.visible = false;
        this.emitSurfaceChange();
    }

    onLeaveXR(): void {
        this.context.input.removeEventListener("pointerup", this.tapHandler as EventListener, { queue: EARLY_INPUT_QUEUE });
        this.surfaceDetected = false;
        this.placementConfirmed = false;
        this.reticle.visible = false;
        this.emitSurfaceChange();
    }

    onUpdateXR(args: NeedleXREventArgs): void {
        if (!args.xr.isAR) return;

        const hit = args.xr.getHitTest();
        const didDetectSurface = !!hit && !this.placementConfirmed;

        if (hit) {
            this.lastHitPosition.copy(hit.position);
        }

        if (this.surfaceDetected !== didDetectSurface) {
            this.surfaceDetected = didDetectSurface;
            this.emitSurfaceChange();
        }

        if (didDetectSurface && hit) {
            this.reticle.visible = true;
            this.reticle.position.copy(hit.position);
            this.reticle.quaternion.copy(hit.quaternion);
        }
        else {
            this.reticle.visible = false;
        }
    }

    unlockPlacement(): void {
        this.placementConfirmed = false;
        this.emitSurfaceChange();
    }

    private emitSurfaceChange(): void {
        const detail: SurfaceChangeDetail = {
            surfaceDetected: this.surfaceDetected,
            placementConfirmed: this.placementConfirmed,
        };
        ARPlacement.events.dispatchEvent(new CustomEvent("surfacechange", { detail }));
    }
}
