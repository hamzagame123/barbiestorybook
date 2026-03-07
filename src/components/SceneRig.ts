import { Behaviour } from "@needle-tools/engine";
import * as THREE from "three";

const MIN_SCALE = 0.55;
const MAX_SCALE = 2.8;

export class SceneRig extends Behaviour {
    static instance: SceneRig | null = null;

    readonly root = new THREE.Group();
    private rigScale = 1;

    awake(): void {
        SceneRig.instance = this;
        this.root.name = "Barbie Scene Rig";
        this.context.scene.add(this.root);
        this.applyScale(1);
    }

    onDestroy(): void {
        this.root.removeFromParent();
        if (SceneRig.instance === this) {
            SceneRig.instance = null;
        }
    }

    placeAt(position: THREE.Vector3, resetScale = false): void {
        this.root.position.copy(position);
        if (resetScale) this.applyScale(1);
    }

    applyScale(scale: number): void {
        this.rigScale = THREE.MathUtils.clamp(scale, MIN_SCALE, MAX_SCALE);
        this.root.scale.setScalar(this.rigScale);
    }

    getScale(): number {
        return this.rigScale;
    }

    hasContent(): boolean {
        return this.root.children.length > 0;
    }
}
