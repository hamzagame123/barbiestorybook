import { AssetReference, Behaviour } from "@needle-tools/engine";
import * as THREE from "three";
import type { LibraryAccessory } from "../presets/LibraryAccessories";
import { SceneRig } from "./SceneRig";

export class AccessorySpawner extends Behaviour {
    static instance: AccessorySpawner | null = null;

    spawnedAccessory: THREE.Object3D | null = null;

    awake(): void {
        AccessorySpawner.instance = this;
    }

    onDestroy(): void {
        if (AccessorySpawner.instance === this) {
            AccessorySpawner.instance = null;
        }
        this.clear();
    }

    async spawnAt(accessory: LibraryAccessory, position: THREE.Vector3, worldYRotation = 0): Promise<void> {
        await this.spawnGeneratedGlb(accessory.glbUrl, position, {
            title: accessory.title,
            initialYRotation: accessory.initialYRotation ?? 0,
            targetSize: accessory.targetSize,
            worldYRotation,
        });
    }

    async spawnGeneratedGlb(
        glbUrl: string,
        position: THREE.Vector3,
        options: {
            title?: string;
            initialYRotation?: number;
            targetSize?: number;
            worldYRotation?: number;
        } = {}
    ): Promise<void> {
        const rig = SceneRig.instance;
        if (!rig) throw new Error("Scene rig is not ready.");

        const assetReference = AssetReference.getOrCreateFromUrl(glbUrl, this.context);
        await assetReference.preload();
        const instance = await assetReference.instantiate();
        if (!instance) throw new Error("Failed to instantiate accessory.");

        if (!rig.hasContent()) {
            rig.placeAt(position);
        }

        instance.name = options.title ?? "Generated Prop";
        instance.position.set(0, 0, 0);
        instance.rotation.set(0, options.initialYRotation ?? 0, 0);
        this.fitIntoRig(instance, options.targetSize ?? 0.28);
        this.enableShadows(instance);

        rig.addItem("stage", instance, position, options.worldYRotation ?? 0);
        this.spawnedAccessory = instance;
    }

    clear(): void {
        SceneRig.instance?.clearSlot("stage");
        this.spawnedAccessory = null;
    }

    private fitIntoRig(instance: THREE.Object3D, targetSize: number): void {
        instance.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(instance);
        if (box.isEmpty()) return;

        const size = box.getSize(new THREE.Vector3());
        const largestDimension = Math.max(size.x, size.y, size.z);
        if (largestDimension > 0) {
            const scale = targetSize / largestDimension;
            instance.scale.setScalar(scale);
        }

        instance.updateMatrixWorld(true);
        const fittedBox = new THREE.Box3().setFromObject(instance);
        const center = fittedBox.getCenter(new THREE.Vector3());
        instance.position.set(-center.x, -fittedBox.min.y, -center.z);
    }

    private enableShadows(instance: THREE.Object3D): void {
        instance.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((material) => {
                const typed = material as THREE.MeshStandardMaterial | undefined;
                if (!typed) return;
                if (typed.map) {
                    typed.map.colorSpace = THREE.SRGBColorSpace;
                    typed.map.needsUpdate = true;
                }
                typed.needsUpdate = true;
            });
        });
    }
}
