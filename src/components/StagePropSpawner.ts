import { Behaviour } from "@needle-tools/engine";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import type { PresetStageProp } from "../presets/PresetStageProps";
import { SceneRig } from "./SceneRig";

const TARGET_STAGE_SIZE = 1.4;
const DEFAULT_STAGE_OFFSET = new THREE.Vector3(0, 0, -0.22);
const playsetBaseColorUrl = "/preset-worlds/barbie-playset/textures/play_Base_color.png";
const playsetNormalUrl = "/preset-worlds/barbie-playset/textures/play_Normal_OpenGL.png";
const playsetRoughnessUrl = "/preset-worlds/barbie-playset/textures/play_Roughness.png";
const houseBaseColorUrl = "/preset-worlds/barbie-house/textures/TexturesCom_Pavement_MedievalFloor8_5x5_51.png";

export class StagePropSpawner extends Behaviour {
    static instance: StagePropSpawner | null = null;

    private readonly fbxLoader = new FBXLoader();
    private readonly textureLoader = new THREE.TextureLoader();
    spawnedStageProp: THREE.Object3D | null = null;

    awake(): void {
        StagePropSpawner.instance = this;
    }

    onDestroy(): void {
        if (StagePropSpawner.instance === this) {
            StagePropSpawner.instance = null;
        }
        this.clear();
    }

    async spawnAt(stageProp: PresetStageProp, position: THREE.Vector3): Promise<void> {
        this.clear();

        const rig = SceneRig.instance;
        if (!rig) throw new Error("Scene rig is not ready.");

        if (!rig.hasContent()) {
            rig.placeAt(position);
        }

        const object = await this.fbxLoader.loadAsync(stageProp.modelUrl);
        object.name = stageProp.title;
        object.position.set(0, 0, 0);
        object.rotation.set(0, stageProp.initialYRotation ?? 0, 0);

        await this.applyMaterialFallbacks(object, stageProp);

        object.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;

            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((material) => {
                if (!material) return;
                const typedMaterial = material as THREE.MeshStandardMaterial;
                if (typedMaterial.map) {
                    typedMaterial.map.colorSpace = THREE.SRGBColorSpace;
                    typedMaterial.map.needsUpdate = true;
                }
                typedMaterial.needsUpdate = true;
            });
        });

        object.position.copy(stageProp.spawnOffset ?? DEFAULT_STAGE_OFFSET);
        this.fitIntoRig(object, stageProp.targetSize ?? TARGET_STAGE_SIZE);
        rig.clearSlot("stage");
        rig.addItem("stage", object, position, 0);
        this.spawnedStageProp = object;
    }

    clear(): void {
        if (!this.spawnedStageProp) return;
        this.spawnedStageProp.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.geometry?.dispose();
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((material) => material?.dispose());
        });
        this.spawnedStageProp.removeFromParent();
        this.spawnedStageProp = null;
        SceneRig.instance?.clearSlot("stage");
    }

    private fitIntoRig(instance: THREE.Object3D, targetSize = TARGET_STAGE_SIZE): void {
        const initialBox = new THREE.Box3().setFromObject(instance);
        if (initialBox.isEmpty()) return;

        const initialSize = initialBox.getSize(new THREE.Vector3());
        const largestDimension = Math.max(initialSize.x, initialSize.y, initialSize.z);
        if (largestDimension > 0) {
            const scale = targetSize / largestDimension;
            instance.scale.multiplyScalar(scale);
        }

        instance.updateMatrixWorld(true);
        const fittedBox = new THREE.Box3().setFromObject(instance);
        const center = fittedBox.getCenter(new THREE.Vector3());
        instance.position.set(-center.x, -fittedBox.min.y, -center.z);
    }

    private async applyMaterialFallbacks(instance: THREE.Object3D, stageProp: PresetStageProp): Promise<void> {
        const fallbackTextures = await this.loadFallbackTextures(stageProp);

        instance.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;

            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((material) => {
                if (!(material instanceof THREE.MeshStandardMaterial)) return;

                if (!material.map && fallbackTextures.map) {
                    material.map = fallbackTextures.map;
                }
                if (!material.normalMap && fallbackTextures.normalMap) {
                    material.normalMap = fallbackTextures.normalMap;
                }
                if (!material.roughnessMap && fallbackTextures.roughnessMap) {
                    material.roughnessMap = fallbackTextures.roughnessMap;
                }

                if (!material.map) {
                    material.color = new THREE.Color(stageProp.id === "dream-house" ? "#ffd7ea" : "#f5d7e4");
                }
                material.roughness = material.roughnessMap ? material.roughness : 0.92;
                material.metalness = 0.02;
            });
        });
    }

    private async loadFallbackTextures(stageProp: PresetStageProp): Promise<{
        map: THREE.Texture | null;
        normalMap: THREE.Texture | null;
        roughnessMap: THREE.Texture | null;
    }> {
        if (stageProp.id === "playset-park") {
            const [map, normalMap, roughnessMap] = await Promise.all([
                this.textureLoader.loadAsync(playsetBaseColorUrl),
                this.textureLoader.loadAsync(playsetNormalUrl),
                this.textureLoader.loadAsync(playsetRoughnessUrl),
            ]);

            map.colorSpace = THREE.SRGBColorSpace;
            return { map, normalMap, roughnessMap };
        }

        if (stageProp.id === "dream-house") {
            const map = await this.textureLoader.loadAsync(houseBaseColorUrl);
            map.colorSpace = THREE.SRGBColorSpace;
            map.wrapS = THREE.RepeatWrapping;
            map.wrapT = THREE.RepeatWrapping;
            map.repeat.set(2, 2);
            return { map, normalMap: null, roughnessMap: null };
        }

        return { map: null, normalMap: null, roughnessMap: null };
    }
}
