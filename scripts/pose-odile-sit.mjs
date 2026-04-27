#!/usr/bin/env node

import { NodeIO } from "@gltf-transform/core";
import * as THREE from "three";

const INPUT = "C:/Users/HAMZA/BarbieStorybook/downloads/sketchfab/drothari/01-best-barbie-doll-odile.glb";
const OUTPUT = "C:/Users/HAMZA/BarbieStorybook/downloads/sketchfab/drothari/odile-sit.glb";

const io = new NodeIO();

function toQuat(x, y, z) {
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, "XYZ"));
}

function findNode(document, exactName) {
    return document.getRoot().listNodes().find((node) => node.getName() === exactName) ?? null;
}

function applyDeltaRotation(document, exactName, x, y, z) {
    const node = findNode(document, exactName);
    if (!node) return false;
    const current = new THREE.Quaternion(...node.getRotation());
    const delta = toQuat(x, y, z);
    current.multiply(delta);
    node.setRotation([current.x, current.y, current.z, current.w]);
    return true;
}

function setTranslation(document, exactName, x, y, z) {
    const node = findNode(document, exactName);
    if (!node) return false;
    node.setTranslation([x, y, z]);
    return true;
}

async function main() {
    const document = await io.read(INPUT);

    // Settle the body backward slightly so the doll reads as seated.
    applyDeltaRotation(document, "Root_01", -0.28, 0, 0);
    applyDeltaRotation(document, "Torso_02", 0.16, 0, 0);
    applyDeltaRotation(document, "Head_06", 0.08, -0.12, -0.06);

    // Fold the arms in a relaxed lap pose.
    applyDeltaRotation(document, "Arm.L_03", 0.08, -0.12, -0.72);
    applyDeltaRotation(document, "Arm.R_04", 0.08, 0.12, 0.72);

    // Rotate both legs forward into a doll-like sitting pose.
    applyDeltaRotation(document, "Leg.L_096", -1.38, 0.04, -0.14);
    applyDeltaRotation(document, "Leg.R_099", -1.38, -0.04, 0.14);

    // Push the skirt panels forward/back slightly to reduce clipping.
    applyDeltaRotation(document, "Skirt_Front.L_097", -0.36, 0, 0);
    applyDeltaRotation(document, "Skirt_Front.R_0100", -0.36, 0, 0);
    applyDeltaRotation(document, "Skirt_Back.L_098", 0.18, 0, 0);
    applyDeltaRotation(document, "Skirt_Back.R_0101", 0.18, 0, 0);

    // Lower the whole model a touch after the leg rotation.
    setTranslation(document, "Sketchfab_model", 0, -0.05, 0);

    await io.write(OUTPUT, document);
    console.log(JSON.stringify({ input: INPUT, output: OUTPUT }, null, 2));
}

main().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
});
