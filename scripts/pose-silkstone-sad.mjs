#!/usr/bin/env node

import { NodeIO } from "@gltf-transform/core";
import * as THREE from "three";

const INPUT = "C:/Users/HAMZA/BarbieStorybook/downloads/sketchfab/drothari/02-strong-silkstone-barbie-doll-rigged.glb";
const OUTPUT = "C:/Users/HAMZA/BarbieStorybook/downloads/sketchfab/drothari/silkstone-sad.glb";

const io = new NodeIO();

function toQuat(x, y, z) {
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, "XYZ"));
    return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
}

function findNode(document, namePart) {
    return document.getRoot().listNodes().find((node) => node.getName().includes(namePart)) ?? null;
}

function setRotation(document, namePart, x, y, z) {
    const node = findNode(document, namePart);
    if (!node) return false;
    node.setRotation(toQuat(x, y, z));
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

    setRotation(document, "Pelvis", 0.02, -0.08, -0.02);
    setRotation(document, "Midriff", 0.16, 0, 0);
    setRotation(document, "Bust", -0.08, 0, 0);
    setRotation(document, "Head", 0.28, -0.18, -0.1);

    setRotation(document, "Bicep.L", 0.22, 0.08, -0.3);
    setRotation(document, "Elbow.L", -0.28, 0, -0.08);
    setRotation(document, "Forearm.L", -0.22, 0.12, -0.18);
    setRotation(document, "Hand.L", 0.08, 0.02, -0.12);

    setRotation(document, "Bicep.R", 0.26, -0.12, 0.34);
    setRotation(document, "Elbow.R", -0.35, 0, 0.1);
    setRotation(document, "Forearm.R", -0.26, -0.16, 0.2);
    setRotation(document, "Hand.R", 0.04, -0.06, 0.14);

    setRotation(document, "Thigh.L", 0.01, 0, -0.04);
    setRotation(document, "Thigh.R", -0.02, 0.04, 0.08);
    setRotation(document, "Knee.L", 0.02, 0, 0.02);
    setRotation(document, "Knee.R", 0.08, 0, -0.03);

    setTranslation(document, "Sketchfab_model", 0, -0.02, 0);

    await io.write(OUTPUT, document);
    console.log(JSON.stringify({ input: INPUT, output: OUTPUT }, null, 2));
}

main().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
});
