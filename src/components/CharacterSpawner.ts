import { AssetReference, Behaviour } from "@needle-tools/engine";
import * as THREE from "three";
import { SceneRig } from "./SceneRig";

const TARGET_SCALE = 0.2;
const POP_DURATION_MS = 400;

type SpawnCharacterOptions = {
    initialYRotation?: number;
    worldYRotation?: number;
};

export class CharacterSpawner extends Behaviour {
    static instance: CharacterSpawner | null = null;

    spawnedObject: THREE.Object3D | null = null;

    awake(): void {
        CharacterSpawner.instance = this;
    }

    onDestroy(): void {
        if (CharacterSpawner.instance === this) {
            CharacterSpawner.instance = null;
        }
        this.clearScene();
    }

    async spawnAt(glbUrl: string, position: THREE.Vector3, options: SpawnCharacterOptions = {}): Promise<void> {
        const rig = SceneRig.instance;
        if (!rig) {
            throw new Error("Scene rig is not ready.");
        }

        const assetReference = AssetReference.getOrCreateFromUrl(glbUrl, this.context);
        await assetReference.preload();
        const instance = await assetReference.instantiate();

        if (!instance) {
            throw new Error("Failed to load generated character.");
        }

        if (!rig.hasContent()) {
            rig.placeAt(position);
        }
        instance.position.set(0, 0, 0);
        instance.rotation.set(0, options.initialYRotation ?? 0, 0);
        instance.scale.setScalar(0);
        rig.addItem("toy", instance, position, options.worldYRotation ?? 0);
        this.spawnedObject = instance;

        const startedAt = performance.now();
        const animate = () => {
            if (!this.spawnedObject || this.spawnedObject !== instance) return;

            const elapsed = Math.min((performance.now() - startedAt) / POP_DURATION_MS, 1);
            const eased = 1 - Math.pow(1 - elapsed, 3);
            const scale = TARGET_SCALE * eased;
            instance.scale.setScalar(scale);

            if (elapsed < 1) requestAnimationFrame(animate);
            else instance.scale.setScalar(TARGET_SCALE);
        };

        requestAnimationFrame(animate);
    }

    clearScene(): void {
        SceneRig.instance?.clearSlot("toy");
        this.spawnedObject = null;
    }

    rotateByRadians(deltaRadians: number): boolean {
        if (!this.spawnedObject) return false;
        this.spawnedObject.rotation.y += deltaRadians;
        return true;
    }
}
