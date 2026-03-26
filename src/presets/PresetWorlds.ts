import type { MarbleWorldAssets } from "../api/WorldLabsClient";

const dreamhousePanoUrl = new URL("../assets/worlds/barbie-dreamhouse-pano.jpg", import.meta.url).toString();
const playsetFbxUrl = "/preset-worlds/barbie-playset/source/final.fbx";
const houseFbxUrl = "/preset-worlds/barbie-house/source/BArb.fbx";

export type PresetWorldId = "dreamhouse" | "playset" | "house";

export type PresetWorld = {
    id: PresetWorldId;
    label: string;
    world: MarbleWorldAssets;
};

export const PRESET_WORLDS: PresetWorld[] = [
    {
        id: "dreamhouse",
        label: "DREAMHOUSE",
        world: {
            worldId: "preset-dreamhouse",
            marbleUrl: "preset://dreamhouse",
            caption: "Barbie Dreamhouse",
            panoUrl: dreamhousePanoUrl,
            panoMode: "skybox",
        },
    },
    {
        id: "playset",
        label: "PLAYSET PARK",
        world: {
            worldId: "preset-playset",
            marbleUrl: "preset://playset",
            caption: "Barbie Playset Park",
            modelUrl: playsetFbxUrl,
            modelFormat: "fbx",
            targetSize: 1.9,
        },
    },
    {
        id: "house",
        label: "DREAM HOUSE",
        world: {
            worldId: "preset-house",
            marbleUrl: "preset://house",
            caption: "Barbie House",
            modelUrl: houseFbxUrl,
            modelFormat: "fbx",
            targetSize: 1.55,
            initialYRotation: Math.PI,
        },
    },
];

export function getPresetWorld(id: PresetWorldId): PresetWorld | undefined {
    return PRESET_WORLDS.find((preset) => preset.id === id);
}
