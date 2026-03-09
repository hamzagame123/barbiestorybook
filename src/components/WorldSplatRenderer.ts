import { Behaviour } from "@needle-tools/engine";
import { SplatFileType, SplatMesh } from "@sparkjsdev/spark";
import { loadSpz, serializePly } from "spz-js";
import * as THREE from "three";
import type { MarbleWorldAssets } from "../api/WorldLabsClient";

const MOBILE_DPR_CAP = 1.25;

export type LoadedWorldSplat = {
    object: THREE.Object3D;
    bounds?: THREE.Box3;
    fit?: boolean;
    cleanup: () => Promise<void>;
    renderer: "spark" | "gaussian";
};

type GaussianModule = typeof import("@mkkellogg/gaussian-splats-3d");

export class WorldSplatRenderer extends Behaviour {
    static instance: WorldSplatRenderer | null = null;

    private previousDevicePixelRatio: number | "auto" | "manual" | null = null;

    awake(): void {
        WorldSplatRenderer.instance = this;
    }

    onDestroy(): void {
        if (WorldSplatRenderer.instance === this) {
            WorldSplatRenderer.instance = null;
        }
        void this.restorePerformanceProfile();
    }

    async createWorld(world: MarbleWorldAssets): Promise<LoadedWorldSplat> {
        if (!world.spzUrl) {
            throw new Error("World Labs did not provide a supported SPZ asset.");
        }

        this.applyPerformanceProfile();

        try {
            return await this.loadWithSpark(world);
        }
        catch (sparkError) {
            console.warn("[WorldSplatRenderer] Spark failed, trying gaussian-splats-3d.", sparkError);
        }

        try {
            return await this.loadWithGaussian(world, false);
        }
        catch (gaussianError) {
            console.warn("[WorldSplatRenderer] Direct gaussian-splats-3d load failed, trying SPZ to PLY conversion.", gaussianError);
        }

        try {
            return await this.loadWithGaussian(world, true);
        }
        catch (conversionError) {
            await this.restorePerformanceProfile();
            throw new Error(
                conversionError instanceof Error
                    ? conversionError.message
                    : "Failed to render the generated gaussian splat."
            );
        }
    }

    private async loadWithSpark(world: MarbleWorldAssets): Promise<LoadedWorldSplat> {
        const mesh = new SplatMesh({
            url: world.spzUrl,
            fileType: SplatFileType.SPZ,
            fileName: `${world.worldId}.spz`,
        });
        await mesh.initialized;

        mesh.name = `World Labs Splat (${world.spzVariant ?? "unknown"})`;
        mesh.frustumCulled = false;

        const bounds = mesh.getBoundingBox();
        console.info(`[WorldSplatRenderer] Rendering world ${world.worldId} with Spark (${world.spzVariant ?? "unknown"}).`);

        return {
            object: mesh,
            bounds: bounds.isEmpty() ? undefined : bounds,
            fit: true,
            renderer: "spark",
            cleanup: async () => {
                mesh.removeFromParent();
                mesh.dispose();
                await this.restorePerformanceProfile();
            },
        };
    }

    private async loadWithGaussian(world: MarbleWorldAssets, convertSpz: boolean): Promise<LoadedWorldSplat> {
        const GaussianSplats3D = await import("@mkkellogg/gaussian-splats-3d") as GaussianModule;
        const blobUrl = convertSpz ? await this.createPlyBlobUrl(world.spzUrl) : null;
        const path = blobUrl ?? world.spzUrl!;
        const format = convertSpz
            ? GaussianSplats3D.SceneFormat.Ply
            : GaussianSplats3D.SceneFormat.Spz;

        const viewer = new GaussianSplats3D.DropInViewer({
            gpuAcceleratedSort: false,
            sharedMemoryForWorkers: false,
            integerBasedSort: !this.isMobileDevice(),
            halfPrecisionCovariancesOnGPU: true,
            ignoreDevicePixelRatio: false,
            renderMode: GaussianSplats3D.RenderMode.OnChange,
            sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant,
            logLevel: GaussianSplats3D.LogLevel.None,
            sphericalHarmonicsDegree: 0,
            enableOptionalEffects: false,
            antialiased: false,
        });

        try {
            await viewer.addSplatScene(path, {
                format,
                showLoadingUI: false,
                progressiveLoad: false,
            });
        }
        catch (error) {
            if (blobUrl) URL.revokeObjectURL(blobUrl);
            await viewer.dispose().catch(() => undefined);
            throw error;
        }

        viewer.name = convertSpz
            ? "World Labs Splat (PLY fallback)"
            : "World Labs Splat (gaussian-splats-3d)";

        const bounds = this.getGaussianBounds(viewer);
        console.info(
            `[WorldSplatRenderer] Rendering world ${world.worldId} with gaussian-splats-3d${convertSpz ? " (PLY fallback)" : ""}.`
        );

        return {
            object: viewer,
            bounds,
            fit: true,
            renderer: "gaussian",
            cleanup: async () => {
                viewer.removeFromParent();
                await viewer.dispose().catch(() => undefined);
                if (blobUrl) URL.revokeObjectURL(blobUrl);
                await this.restorePerformanceProfile();
            },
        };
    }

    private async createPlyBlobUrl(spzUrl: string): Promise<string> {
        const response = await fetch(spzUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch SPZ asset with HTTP ${response.status}.`);
        }

        const gaussianSet = await loadSpz(await response.arrayBuffer());
        const plyBytes = serializePly(gaussianSet);
        return URL.createObjectURL(new Blob([plyBytes], { type: "application/octet-stream" }));
    }

    private getGaussianBounds(viewer: THREE.Object3D & { viewer?: { getSplatMesh?: () => THREE.Object3D | null } }): THREE.Box3 | undefined {
        const splatMesh = viewer.viewer?.getSplatMesh?.();
        if (splatMesh) {
            const splatBounds = new THREE.Box3().setFromObject(splatMesh);
            if (!splatBounds.isEmpty()) {
                return splatBounds;
            }
        }

        const objectBounds = new THREE.Box3().setFromObject(viewer);
        return objectBounds.isEmpty() ? undefined : objectBounds;
    }

    private applyPerformanceProfile(): void {
        if (this.previousDevicePixelRatio !== null) return;

        this.previousDevicePixelRatio = this.context.devicePixelRatio;
        if (this.isMobileDevice()) {
            this.context.devicePixelRatio = Math.min(MOBILE_DPR_CAP, window.devicePixelRatio || 1);
        }
    }

    private async restorePerformanceProfile(): Promise<void> {
        if (this.previousDevicePixelRatio === null) return;

        this.context.devicePixelRatio = this.previousDevicePixelRatio;
        this.previousDevicePixelRatio = null;
    }

    private isMobileDevice(): boolean {
        return /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent) || window.matchMedia("(pointer: coarse)").matches;
    }
}
