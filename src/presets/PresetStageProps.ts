const playsetFbxUrl = "/preset-worlds/barbie-playset/source/final.fbx";
const houseFbxUrl = "/preset-worlds/barbie-house/source/BArb.fbx";

export type PresetStagePropId = "playset-park" | "dream-house";

export type PresetStageProp = {
    id: PresetStagePropId;
    label: string;
    title: string;
    modelUrl: string;
    modelFormat: "fbx";
    targetSize: number;
    initialYRotation?: number;
    spawnOffset?: {
        x: number;
        y: number;
        z: number;
    };
};

export const PRESET_STAGE_PROPS: PresetStageProp[] = [
    {
        id: "playset-park",
        label: "PARK PLAYSET",
        title: "Park Playset",
        modelUrl: playsetFbxUrl,
        modelFormat: "fbx",
        targetSize: 1.9,
        spawnOffset: { x: 0, y: 0, z: -0.16 },
    },
    {
        id: "dream-house",
        label: "DREAM HOUSE MODEL",
        title: "Dream House Model",
        modelUrl: houseFbxUrl,
        modelFormat: "fbx",
        targetSize: 1.75,
        initialYRotation: Math.PI,
        spawnOffset: { x: 0, y: 0, z: -0.34 },
    },
];

export function getPresetStageProp(id: PresetStagePropId): PresetStageProp | undefined {
    return PRESET_STAGE_PROPS.find((preset) => preset.id === id);
}
