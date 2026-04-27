import { addComponent, Behaviour, DragControls, DragMode, type PointerEventData } from "@needle-tools/engine";
import * as THREE from "three";

const MIN_ITEM_SCALE = 0.55;
const MAX_ITEM_SCALE = 2.8;

export type SceneSlot = "toy" | "stage";

export type SceneItem = {
    id: string;
    slot: SceneSlot;
    anchor: THREE.Group;
    object: THREE.Object3D;
};

type SelectionChangeDetail = {
    id: string | null;
    slot: SceneSlot | null;
};

class SceneItemSelectionHandle extends Behaviour {
    itemId = "";

    onPointerDown(_args: PointerEventData): void {
        if (!this.itemId) return;
        SceneRig.instance?.selectItem(this.itemId);
    }
}

export class SceneRig extends Behaviour {
    static instance: SceneRig | null = null;
    static events = new EventTarget();

    readonly root = new THREE.Group();
    readonly toyAnchor = new THREE.Group();
    readonly stageAnchor = new THREE.Group();

    private readonly items = new Map<string, SceneItem>();
    private readonly itemOrder: string[] = [];
    private selectedItemId: string | null = null;

    awake(): void {
        SceneRig.instance = this;
        this.root.name = "Barbie Scene Rig";
        this.toyAnchor.name = "Toy Items";
        this.stageAnchor.name = "Stage Items";
        this.root.add(this.stageAnchor, this.toyAnchor);
        this.context.scene.add(this.root);
    }

    onDestroy(): void {
        this.root.removeFromParent();
        if (SceneRig.instance === this) {
            SceneRig.instance = null;
        }
    }

    placeAt(position: THREE.Vector3): void {
        this.root.position.copy(position);
    }

    addItem(slot: SceneSlot, object: THREE.Object3D, worldPosition: THREE.Vector3, worldYRotation = 0): SceneItem {
        const id = crypto.randomUUID();
        const anchor = new THREE.Group();
        anchor.name = `${slot}-${id}`;
        anchor.add(object);
        anchor.position.copy(this.root.worldToLocal(worldPosition.clone()));
        anchor.rotation.set(0, worldYRotation, 0);
        anchor.scale.setScalar(1);
        this.getSlotContainer(slot).add(anchor);

        const drag = addComponent(anchor, DragControls);
        drag.dragMode = DragMode.XZPlane;
        drag.xrDragMode = DragMode.XZPlane;
        drag.keepRotation = false;
        drag.xrKeepRotation = false;
        drag.showGizmo = false;
        drag.setTargetObject(anchor);

        const selectionHandle = addComponent(anchor, SceneItemSelectionHandle);
        selectionHandle.itemId = id;

        const item: SceneItem = { id, slot, anchor, object };
        this.items.set(id, item);
        this.itemOrder.push(id);
        this.selectItem(id);
        return item;
    }

    clearSlot(slot: SceneSlot): void {
        const ids = this.itemOrder.filter((id) => this.items.get(id)?.slot === slot);
        ids.forEach((id) => this.clearItem(id));
    }

    clearItem(id: string): void {
        const item = this.items.get(id);
        if (!item) return;
        item.anchor.removeFromParent();
        this.items.delete(id);
        const index = this.itemOrder.indexOf(id);
        if (index >= 0) this.itemOrder.splice(index, 1);

        if (this.selectedItemId === id) {
            const fallbackId = this.itemOrder.at(-1) ?? null;
            this.selectItem(fallbackId);
        }
    }

    hasContent(): boolean {
        return this.items.size > 0;
    }

    hasSlotContent(slot: SceneSlot): boolean {
        return this.itemOrder.some((id) => this.items.get(id)?.slot === slot);
    }

    getSelectedSlot(): SceneSlot | null {
        return this.getSelectedItem()?.slot ?? null;
    }

    getSelectedItemId(): string | null {
        return this.selectedItemId;
    }

    getSelectedScale(): number {
        return this.getSelectedItem()?.anchor.scale.x ?? 1;
    }

    getSelectedWorldPosition(): THREE.Vector3 {
        return this.getSelectedItem()?.anchor.getWorldPosition(new THREE.Vector3()) ?? this.root.getWorldPosition(new THREE.Vector3());
    }

    getLatestWorldPosition(slot?: SceneSlot): THREE.Vector3 | null {
        for (let index = this.itemOrder.length - 1; index >= 0; index -= 1) {
            const item = this.items.get(this.itemOrder[index]);
            if (!item) continue;
            if (slot && item.slot !== slot) continue;
            return item.anchor.getWorldPosition(new THREE.Vector3());
        }
        return null;
    }

    getSelectableEntries(): Array<{ id: string; slot: SceneSlot; object: THREE.Object3D }> {
        return this.itemOrder
            .map((id) => this.items.get(id))
            .filter((item): item is SceneItem => !!item)
            .map((item) => ({ id: item.id, slot: item.slot, object: item.anchor }));
    }

    selectItem(id: string | null): void {
        const nextId = id && this.items.has(id) ? id : null;
        if (this.selectedItemId === nextId) return;
        this.selectedItemId = nextId;
        const selected = this.getSelectedItem();
        const detail: SelectionChangeDetail = {
            id: selected?.id ?? null,
            slot: selected?.slot ?? null,
        };
        SceneRig.events.dispatchEvent(new CustomEvent("selectionchange", { detail }));
    }

    placeSelectedAtWorld(worldPosition: THREE.Vector3): boolean {
        const item = this.getSelectedItem();
        if (!item) return false;
        item.anchor.position.copy(this.root.worldToLocal(worldPosition.clone()));
        return true;
    }

    rotateSelectedByRadians(deltaRadians: number): boolean {
        const item = this.getSelectedItem();
        if (!item) return false;
        item.anchor.rotation.y += deltaRadians;
        return true;
    }

    scaleSelectedByFactor(factor: number): boolean {
        const item = this.getSelectedItem();
        if (!item || !Number.isFinite(factor) || factor <= 0) return false;
        const nextScale = THREE.MathUtils.clamp(item.anchor.scale.x * factor, MIN_ITEM_SCALE, MAX_ITEM_SCALE);
        item.anchor.scale.setScalar(nextScale);
        return true;
    }

    private getSelectedItem(): SceneItem | null {
        return this.selectedItemId ? this.items.get(this.selectedItemId) ?? null : null;
    }

    private getSlotContainer(slot: SceneSlot): THREE.Group {
        return slot === "toy" ? this.toyAnchor : this.stageAnchor;
    }
}
