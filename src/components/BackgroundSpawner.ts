import { Behaviour } from "@needle-tools/engine";
import * as THREE from "three";

export class BackgroundSpawner extends Behaviour {
    static instance: BackgroundSpawner | null = null;

    private readonly textureLoader = new THREE.TextureLoader();
    private skybox: THREE.Mesh | null = null;
    private texture: THREE.Texture | null = null;

    awake(): void {
        BackgroundSpawner.instance = this;
    }

    onDestroy(): void {
        if (BackgroundSpawner.instance === this) {
            BackgroundSpawner.instance = null;
        }
        this.clear();
    }

    async setBackground(panoUrl: string): Promise<void> {
        this.clear();

        const texture = await this.textureLoader.loadAsync(panoUrl);
        texture.colorSpace = THREE.SRGBColorSpace;

        const geometry = new THREE.SphereGeometry(8, 64, 32);
        geometry.scale(-1, 1, 1);

        const material = new THREE.MeshBasicMaterial({
            map: texture,
            toneMapped: false,
            depthWrite: false,
        });

        const skybox = new THREE.Mesh(geometry, material);
        skybox.name = "Barbie Scene Background";

        const cameraWorldPosition = this.context.mainCamera.getWorldPosition(new THREE.Vector3());
        skybox.position.copy(cameraWorldPosition);

        this.context.scene.add(skybox);
        this.skybox = skybox;
        this.texture = texture;

        this.context.domElement.setAttribute("environment-image", panoUrl);
        this.context.domElement.setAttribute("background-image", panoUrl);
    }

    clear(): void {
        if (this.skybox) {
            this.skybox.geometry.dispose();
            const material = this.skybox.material as THREE.Material;
            material.dispose();
            this.skybox.removeFromParent();
            this.skybox = null;
        }
        if (this.texture) {
            this.texture.dispose();
            this.texture = null;
        }
        this.context.domElement.removeAttribute("environment-image");
        this.context.domElement.removeAttribute("background-image");
    }
}
