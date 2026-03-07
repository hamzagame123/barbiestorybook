import { AssetReference, Behaviour, destroy } from "@needle-tools/engine";
import * as THREE from "three";
import type { MarbleWorldAssets } from "../api/WorldLabsClient";
import { SceneRig } from "./SceneRig";

const TARGET_WORLD_SIZE = 1.4;

export class WorldSpawner extends Behaviour {
    static instance: WorldSpawner | null = null;

    spawnedWorld: THREE.Object3D | null = null;

    awake(): void {
        WorldSpawner.instance = this;
    }

    onDestroy(): void {
        if (WorldSpawner.instance === this) {
            WorldSpawner.instance = null;
        }
        this.clearScene();
        this.context.domElement.removeAttribute("environment-image");
    }

    async spawnAt(world: MarbleWorldAssets, position: THREE.Vector3): Promise<void> {
        this.clearScene();

        const rig = SceneRig.instance;
        if (!rig) {
            throw new Error("Scene rig is not ready.");
        }

        rig.placeAt(position, false);

        const assetReference = AssetReference.getOrCreateFromUrl(world.colliderMeshUrl, this.context);
        await assetReference.preload();
        const instance = await assetReference.instantiate();
        if (!instance) {
            throw new Error("Failed to load generated world.");
        }

        rig.root.add(instance);
        this.fitIntoRig(instance);
        this.spawnedWorld = instance;
        this.context.domElement.setAttribute("environment-image", world.panoUrl);
    }

    clearScene(): void {
        if (this.spawnedWorld) {
            destroy(this.spawnedWorld);
            this.spawnedWorld = null;
        }
        this.context.domElement.removeAttribute("environment-image");
    }

    private fitIntoRig(instance: THREE.Object3D): void {
        instance.updateMatrixWorld(true);
        const initialBox = new THREE.Box3().setFromObject(instance);
        if (initialBox.isEmpty()) return;

        const initialSize = initialBox.getSize(new THREE.Vector3());
        const largestDimension = Math.max(initialSize.x, initialSize.y, initialSize.z);
        if (largestDimension > 0) {
            const scale = TARGET_WORLD_SIZE / largestDimension;
            instance.scale.multiplyScalar(scale);
        }

        instance.updateMatrixWorld(true);
        const fittedBox = new THREE.Box3().setFromObject(instance);
        const center = fittedBox.getCenter(new THREE.Vector3());
        instance.position.set(-center.x, -fittedBox.min.y, -center.z);
    }
}
