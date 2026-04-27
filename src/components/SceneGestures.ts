import { Behaviour, type NeedleXREventArgs } from "@needle-tools/engine";

export class SceneGestures extends Behaviour {
    static instance: SceneGestures | null = null;

    private suppressUntil = 0;

    awake(): void {
        SceneGestures.instance = this;
    }

    onDestroy(): void {
        if (SceneGestures.instance === this) {
            SceneGestures.instance = null;
        }
    }

    onLeaveXR(): void {
        this.suppressUntil = 0;
    }

    onUpdateXR(_args: NeedleXREventArgs): void {
        // DragControls on individual scene items own the interaction path.
    }

    suppressInputs(durationMs: number): void {
        this.suppressUntil = performance.now() + Math.max(0, durationMs);
    }

    isSuppressed(): boolean {
        return performance.now() < this.suppressUntil;
    }
}
