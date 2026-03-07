import { Behaviour, type NeedleXREventArgs } from "@needle-tools/engine";
import * as THREE from "three";
import { ARPlacement } from "./ARPlacement";
import { SceneRig } from "./SceneRig";

type GesturePointerEvent = Event & {
    pointerId?: number;
    clientX?: number;
    clientY?: number;
    source?: Event | null;
    use?: () => void;
};

export class SceneGestures extends Behaviour {
    private readonly pointers = new Map<number, THREE.Vector2>();
    private pinchStartDistance = 0;
    private pinchStartScale = 1;
    private hadMultitouch = false;

    private readonly onPointerDown = (event: Event) => {
        if (!this.shouldTrackEvent(event)) return;

        const pointer = event as GesturePointerEvent;
        const pointerId = pointer.pointerId;
        if (pointerId === undefined) return;

        this.pointers.set(pointerId, new THREE.Vector2(pointer.clientX ?? 0, pointer.clientY ?? 0));
        if (this.pointers.size >= 2) {
            this.hadMultitouch = true;
            this.beginPinch();
        }
        pointer.use?.();
    };

    private readonly onPointerMove = (event: Event) => {
        const pointer = event as GesturePointerEvent;
        const pointerId = pointer.pointerId;
        if (pointerId === undefined || !this.pointers.has(pointerId)) return;

        this.pointers.get(pointerId)?.set(pointer.clientX ?? 0, pointer.clientY ?? 0);
        if (this.pointers.size >= 2 && this.pinchStartDistance <= 0) {
            this.beginPinch();
        }
        pointer.use?.();
    };

    private readonly onPointerUp = (event: Event) => {
        const pointer = event as GesturePointerEvent;
        const pointerId = pointer.pointerId;
        if (pointerId === undefined) return;

        this.pointers.delete(pointerId);
        if (this.pointers.size < 2) {
            this.pinchStartDistance = 0;
            this.pinchStartScale = SceneRig.instance?.getScale() ?? 1;
        }
        if (this.pointers.size === 0) {
            this.hadMultitouch = false;
        }
    };

    awake(): void {
        this.context.input.addEventListener("pointerdown", this.onPointerDown as EventListener);
        this.context.input.addEventListener("pointermove", this.onPointerMove as EventListener);
        this.context.input.addEventListener("pointerup", this.onPointerUp as EventListener);
    }

    onDestroy(): void {
        this.context.input.removeEventListener("pointerdown", this.onPointerDown as EventListener);
        this.context.input.removeEventListener("pointermove", this.onPointerMove as EventListener);
        this.context.input.removeEventListener("pointerup", this.onPointerUp as EventListener);
        this.pointers.clear();
    }

    onLeaveXR(): void {
        this.pointers.clear();
        this.pinchStartDistance = 0;
        this.hadMultitouch = false;
    }

    onUpdateXR(args: NeedleXREventArgs): void {
        const rig = SceneRig.instance;
        if (!args.xr.isAR || !rig?.hasContent() || !ARPlacement.placementConfirmed) return;

        if (this.pointers.size >= 2) {
            const currentDistance = this.getCurrentPinchDistance();
            if (this.pinchStartDistance > 0 && currentDistance > 0) {
                rig.applyScale(this.pinchStartScale * (currentDistance / this.pinchStartDistance));
            }
            return;
        }

        if (this.pointers.size === 1) {
            if (this.hadMultitouch) return;

            const hit = args.xr.getHitTest();
            if (hit) {
                rig.placeAt(hit.position, false);
            }
        }
    }

    private shouldTrackEvent(event: Event): boolean {
        const rig = SceneRig.instance;
        if (!rig?.hasContent() || !ARPlacement.placementConfirmed) return false;

        const pointer = event as GesturePointerEvent;
        const sourceTarget = (pointer.source?.target ?? null) as HTMLElement | null;
        return !sourceTarget?.closest("[data-barbie-overlay='true']");
    }

    private beginPinch(): void {
        const distance = this.getCurrentPinchDistance();
        if (distance <= 0) return;

        this.pinchStartDistance = distance;
        this.pinchStartScale = SceneRig.instance?.getScale() ?? 1;
    }

    private getCurrentPinchDistance(): number {
        const touches = Array.from(this.pointers.values());
        if (touches.length < 2) return 0;
        return touches[0].distanceTo(touches[1]);
    }
}
