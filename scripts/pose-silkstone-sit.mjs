#!/usr/bin/env node

import { NodeIO } from "@gltf-transform/core";
import * as THREE from "three";

const INPUT = "C:/Users/HAMZA/BarbieStorybook/downloads/sketchfab/drothari/02-strong-silkstone-barbie-doll-rigged.glb";
const OUTPUT = "C:/Users/HAMZA/BarbieStorybook/downloads/sketchfab/drothari/silkstone-sit.glb";

const io = new NodeIO();

function toQuat(x, y, z) {
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, "XYZ"));
    return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
}

function findNode(document, namePart) {
    return document.getRoot().listNodes().find((node) => node.getName().includes(namePart)) ?? null;
}

function applyDeltaRotation(document, namePart, x, y, z) {
    const node = findNode(document, namePart);
    if (!node) return false;
    const [qx, qy, qz, qw] = node.getRotation();
    const current = new THREE.Quaternion(qx, qy, qz, qw);
    const delta = new THREE.Quaternion(...toQuat(x, y, z));
    current.multiply(delta);
    node.setRotation([current.x, current.y, current.z, current.w]);
    return true;
}

function setTranslation(document, namePart, x, y, z) {
    const node = findNode(document, namePart);
    if (!node) return false;
    node.setTranslation([x, y, z]);
    return true;
}

async function main() {
    const document = await io.read(INPUT);

    // Seated body posture with a neutral upright torso.
    applyDeltaRotation(document, "Pelvis", -0.26, 0, 0);
    applyDeltaRotation(document, "Midriff", 0.02, 0, 0);
    applyDeltaRotation(document, "Bust", -0.01, 0, 0);
    applyDeltaRotation(document, "Head", 0.02, -0.08, -0.02);

    // Hands resting loosely near the lap.
    applyDeltaRotation(document, "Bicep.L", 0.08, 0.02, -0.12);
    applyDeltaRotation(document, "Elbow.L", -0.24, 0, -0.02);
    applyDeltaRotation(document, "Forearm.L", -0.04, 0.02, -0.02);
    applyDeltaRotation(document, "Hand.L", 0.02, 0.01, -0.04);

    applyDeltaRotation(document, "Bicep.R", 0.08, -0.02, 0.12);
    applyDeltaRotation(document, "Elbow.R", -0.24, 0, 0.02);
    applyDeltaRotation(document, "Forearm.R", -0.04, -0.02, 0.02);
    applyDeltaRotation(document, "Hand.R", 0.02, -0.01, 0.04);

    // Fold both legs into a clean doll-like seated pose.
    applyDeltaRotation(document, "Thigh.L", 1.52, -0.03, 0.04);
    applyDeltaRotation(document, "Knee.L", -1.57, 0, 0.02);
    applyDeltaRotation(document, "Shin.L", -0.02, 0, -0.01);

    applyDeltaRotation(document, "Thigh.R", 1.52, 0.03, -0.04);
    applyDeltaRotation(document, "Knee.R", -1.57, 0, -0.02);
    applyDeltaRotation(document, "Shin.R", -0.02, 0, 0.01);

    // Lower the model slightly after folding the legs.
    setTranslation(document, "Sketchfab_model", 0, -0.12, 0);

    await io.write(OUTPUT, document);
    console.log(JSON.stringify({ input: INPUT, output: OUTPUT }, null, 2));
}

main().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
});
