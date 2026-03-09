declare module "@mkkellogg/gaussian-splats-3d" {
    import * as THREE from "three";

    export const SceneFormat: {
        readonly Ply: number;
        readonly Spz: number;
    };

    export const RenderMode: {
        readonly OnChange: number;
    };

    export const SceneRevealMode: {
        readonly Instant: number;
    };

    export const LogLevel: {
        readonly None: number;
    };

    export class DropInViewer extends THREE.Group {
        viewer?: {
            getSplatMesh?: () => THREE.Object3D | null;
        };

        constructor(options?: Record<string, unknown>);
        addSplatScene(path: string, options?: Record<string, unknown>): Promise<unknown>;
        dispose(): Promise<void>;
    }
}
