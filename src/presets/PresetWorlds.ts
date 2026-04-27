import type { MarbleWorldAssets } from "../api/WorldLabsClient";

const dreamhousePanoUrl = new URL("../assets/worlds/barbie-dreamhouse-pano.jpg", import.meta.url).toString();

export type PresetWorldId = "dreamhouse";

export type PresetWorld = {
    id: PresetWorldId;
    label: string;
    world: MarbleWorldAssets;
};

export const PRESET_WORLDS: PresetWorld[] = [
    {
        id: "dreamhouse",
        label: "DREAMHOUSE PANO",
        world: {
            worldId: "preset-dreamhouse",
            marbleUrl: "preset://dreamhouse",
            caption: "Dreamhouse Pano",
            panoUrl: dreamhousePanoUrl,
            panoMode: "skybox",
        },
    },
];

export function getPresetWorld(id: PresetWorldId): PresetWorld | undefined {
    return PRESET_WORLDS.find((preset) => preset.id === id);
}
