import { AssetReference, Behaviour, destroy } from "@needle-tools/engine";
import * as THREE from "three";

const TARGET_SCALE = 0.2;
const POP_DURATION_MS = 400;

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

    async spawnAt(glbUrl: string, position: THREE.Vector3): Promise<void> {
        this.clearScene();

        const assetReference = AssetReference.getOrCreateFromUrl(glbUrl, this.context);
        await assetReference.preload();
        const instance = await assetReference.instantiate();

        if (!instance) {
            throw new Error("Failed to load generated character.");
        }

        instance.position.copy(position);
        instance.scale.setScalar(0);
        this.context.scene.add(instance);
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
        if (!this.spawnedObject) return;
        destroy(this.spawnedObject);
        this.spawnedObject = null;
    }
}
