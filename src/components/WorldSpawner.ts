import { AssetReference, Behaviour, destroy } from "@needle-tools/engine";
import * as THREE from "three";
import type { MarbleWorldAssets } from "../api/WorldLabsClient";
import { SceneRig } from "./SceneRig";
import { WorldSplatRenderer, type LoadedWorldSplat } from "./WorldSplatRenderer";

const TARGET_WORLD_SIZE = 1.4;
const BACKDROP_BASE_HEIGHT = 0.82;

export enum WorldSpawnerErrorType {
    DisplayError = "display-error",
}

export class WorldSpawnerError extends Error {
    constructor(public readonly type: WorldSpawnerErrorType, message: string) {
        super(message);
        this.name = "WorldSpawnerError";
    }
}

export class WorldSpawner extends Behaviour {
    static instance: WorldSpawner | null = null;

    spawnedWorld: THREE.Object3D | null = null;
    private spawnedWorldCleanup: (() => Promise<void>) | null = null;
    private readonly textureLoader = new THREE.TextureLoader();

    awake(): void {
        WorldSpawner.instance = this;
    }

    onDestroy(): void {
        if (WorldSpawner.instance === this) {
            WorldSpawner.instance = null;
        }
        void this.clearScene();
        this.context.domElement.removeAttribute("environment-image");
    }

    async spawnAt(world: MarbleWorldAssets, position: THREE.Vector3): Promise<void> {
        await this.clearScene();

        const rig = SceneRig.instance;
        if (!rig) {
            throw new Error("Scene rig is not ready.");
        }

        rig.placeAt(position, false);

        const visual = await this.createVisual(world);
        if (!visual) {
            throw new WorldSpawnerError(WorldSpawnerErrorType.DisplayError, "World generation finished, but no visual assets were available.");
        }

        rig.root.add(visual.object);
        if (visual.fit !== false) {
            this.fitIntoRig(visual.object, visual.bounds);
        }
        this.spawnedWorld = visual.object;
        this.spawnedWorldCleanup = visual.cleanup;

        if (world.panoUrl) {
            this.context.domElement.setAttribute("environment-image", world.panoUrl);
        }
    }

    async clearScene(): Promise<void> {
        if (this.spawnedWorldCleanup) {
            await this.spawnedWorldCleanup().catch((error) => {
                console.warn("[WorldSpawner] Failed to clean up previous world.", error);
            });
            this.spawnedWorldCleanup = null;
        }
        else if (this.spawnedWorld) {
            destroy(this.spawnedWorld);
        }

        this.spawnedWorld = null;
        this.context.domElement.removeAttribute("environment-image");
    }

    private fitIntoRig(instance: THREE.Object3D, sourceBounds?: THREE.Box3): void {
        const initialBox = sourceBounds?.clone() ?? new THREE.Box3().setFromObject(instance);
        if (initialBox.isEmpty()) return;

        const initialSize = initialBox.getSize(new THREE.Vector3());
        const largestDimension = Math.max(initialSize.x, initialSize.y, initialSize.z);
        if (largestDimension > 0) {
            const scale = TARGET_WORLD_SIZE / largestDimension;
            instance.scale.multiplyScalar(scale);
        }

        instance.updateMatrix();
        const fittedBox = sourceBounds?.clone().applyMatrix4(instance.matrix) ?? new THREE.Box3().setFromObject(instance);
        const center = fittedBox.getCenter(new THREE.Vector3());
        instance.position.set(-center.x, -fittedBox.min.y, -center.z);
    }

    private async createVisual(world: MarbleWorldAssets): Promise<LoadedWorldSplat | null> {
        let splatError: unknown = null;

        if (world.spzUrl && WorldSplatRenderer.instance) {
            try {
                return await WorldSplatRenderer.instance.createWorld(world);
            }
            catch (error) {
                splatError = error;
                console.warn("[WorldSpawner] Failed to display SPZ world, falling back to other assets.", error);
            }
        }

        if (world.colliderMeshUrl) {
            const assetReference = AssetReference.getOrCreateFromUrl(world.colliderMeshUrl, this.context);
            await assetReference.preload();
            const instance = await assetReference.instantiate();
            if (!instance) {
                throw new WorldSpawnerError(WorldSpawnerErrorType.DisplayError, "Failed to load the generated world mesh.");
            }

            return {
                object: instance,
                cleanup: async () => {
                    destroy(instance);
                },
                fit: true,
                renderer: "gaussian",
            };
        }

        if (world.thumbnailUrl || world.panoUrl) {
            const backdrop = await this.createBackdrop(world);
            return {
                object: backdrop,
                cleanup: async () => {
                    destroy(backdrop);
                },
                fit: false,
                renderer: "gaussian",
            };
        }

        if (splatError) {
            throw new WorldSpawnerError(
                WorldSpawnerErrorType.DisplayError,
                splatError instanceof Error
                    ? splatError.message
                    : "World generation succeeded, but the gaussian splat could not be displayed."
            );
        }

        return null;
    }

    private async createBackdrop(world: MarbleWorldAssets): Promise<THREE.Object3D> {
        const group = new THREE.Group();
        group.name = "Barbie Marble Backdrop";

        const textureUrl = world.thumbnailUrl ?? world.panoUrl;
        const texture = textureUrl ? await this.textureLoader.loadAsync(textureUrl) : null;
        if (texture) {
            texture.colorSpace = THREE.SRGBColorSpace;
        }

        const aspect = texture?.image?.width && texture?.image?.height
            ? texture.image.width / texture.image.height
            : 4 / 3;
        const height = BACKDROP_BASE_HEIGHT;
        const width = Math.min(height * aspect, 1.28);

        const panel = new THREE.Mesh(
            new THREE.PlaneGeometry(width, height, 1, 1),
            new THREE.MeshBasicMaterial({
                map: texture ?? undefined,
                color: texture ? 0xffffff : new THREE.Color("#ffd6e8"),
                transparent: true,
                toneMapped: false,
                side: THREE.DoubleSide,
            })
        );
        panel.position.set(0, height * 0.56, -0.42);
        group.add(panel);

        const halo = new THREE.Mesh(
            new THREE.RingGeometry(0.3, 0.6, 48),
            new THREE.MeshBasicMaterial({
                color: new THREE.Color("#ffb7d3"),
                transparent: true,
                opacity: 0.18,
                depthWrite: false,
                toneMapped: false,
                side: THREE.DoubleSide,
            })
        );
        halo.rotation.x = -Math.PI / 2;
        halo.position.y = 0.01;
        group.add(halo);

        const floor = new THREE.Mesh(
            new THREE.CircleGeometry(0.34, 48),
            new THREE.MeshBasicMaterial({
                color: new THREE.Color("#fff1f7"),
                transparent: true,
                opacity: 0.82,
                depthWrite: false,
                toneMapped: false,
            })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0.012;
        group.add(floor);

        return group;
    }
}
