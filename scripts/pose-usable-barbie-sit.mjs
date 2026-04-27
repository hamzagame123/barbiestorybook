#!/usr/bin/env node

import { NodeIO } from "@gltf-transform/core";
import * as THREE from "three";

const INPUT = "C:/Users/HAMZA/BarbieStorybook/downloads/sketchfab/drothari/03-usable-barbie-doll-rigged.glb";
const OUTPUT = "C:/Users/HAMZA/BarbieStorybook/downloads/sketchfab/drothari/usable-barbie-sit.glb";

const io = new NodeIO();

function toQuat(x, y, z) {
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, "XYZ"));
    return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
}

function findNode(document, exactName) {
    return document.getRoot().listNodes().find((node) => node.getName() === exactName) ?? null;
}

function applyDeltaRotation(document, exactName, x, y, z) {
    const node = findNode(document, exactName);
    if (!node) return false;
    const [qx, qy, qz, qw] = node.getRotation();
    const current = new THREE.Quaternion(qx, qy, qz, qw);
    const delta = new THREE.Quaternion(...toQuat(x, y, z));
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

    applyDeltaRotation(document, "Root_03", -0.22, 0, 0);
    applyDeltaRotation(document, "Root_Spine_04", 0.10, 0, 0);
    applyDeltaRotation(document, "Midriff_05", 0.06, 0, 0);
    applyDeltaRotation(document, "Breasts_06", -0.04, 0, 0);
    applyDeltaRotation(document, "Head_012", 0.04, -0.08, -0.02);

    applyDeltaRotation(document, "Bicep.L_08", 0.18, 0.04, -0.28);
    applyDeltaRotation(document, "Elbow.L_09", -0.72, 0, -0.06);
    applyDeltaRotation(document, "Forearm.L_010", -0.16, 0.04, -0.08);
    applyDeltaRotation(document, "Hand.L_011", 0.04, 0.02, -0.06);

    applyDeltaRotation(document, "Bicep.R_051", 0.18, -0.04, 0.28);
    applyDeltaRotation(document, "Elbow.R_052", -0.72, 0, 0.06);
    applyDeltaRotation(document, "Forearm.R_053", -0.16, -0.04, 0.08);
    applyDeltaRotation(document, "Hand.R_054", 0.04, -0.02, 0.06);

    applyDeltaRotation(document, "Hip.L_055", 0.02, 0.04, 0.02);
    applyDeltaRotation(document, "Thigh.L_056", 1.48, -0.02, 0.06);
    applyDeltaRotation(document, "Knee.L_057", -1.57, 0, 0.02);
    applyDeltaRotation(document, "Shin.L_058", -0.04, 0, -0.02);
    applyDeltaRotation(document, "Foot.L_059", 0.04, 0, 0);

    applyDeltaRotation(document, "Hip.R_060", 0.02, -0.04, -0.02);
    applyDeltaRotation(document, "Thigh.R_061", 1.48, 0.02, -0.06);
    applyDeltaRotation(document, "Knee.R_062", -1.57, 0, -0.02);
    applyDeltaRotation(document, "Shin.R_063", -0.04, 0, 0.02);
    applyDeltaRotation(document, "Foot.R_064", 0.04, 0, 0);

    setTranslation(document, "Sketchfab_model", 0, -0.12, 0);

    await io.write(OUTPUT, document);
    console.log(JSON.stringify({ input: INPUT, output: OUTPUT }, null, 2));
}

main().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
});
