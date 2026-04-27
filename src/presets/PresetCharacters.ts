const classicRiggedBarbieGlbUrl = new URL("../assets/characters/barbie-doll-rigged-sketchfab.glb", import.meta.url).toString();
const odileBarbieGlbUrl = new URL("../assets/characters/barbie-odile.glb", import.meta.url).toString();
const silkstoneBarbieGlbUrl = new URL("../assets/characters/barbie-silkstone.glb", import.meta.url).toString();
const deluxeStyleBarbieGlbUrl = new URL("../assets/characters/barbie-deluxe-style.glb", import.meta.url).toString();
const classicRiggedBarbiePreviewUrl = new URL("../assets/library/dolls/barbie-rigged.jpg", import.meta.url).toString();
const odileBarbiePreviewUrl = new URL("../assets/library/dolls/barbie-odile.jpg", import.meta.url).toString();
const silkstoneBarbiePreviewUrl = new URL("../assets/library/dolls/barbie-silkstone.jpg", import.meta.url).toString();
const deluxeStyleBarbiePreviewUrl = new URL("../assets/library/dolls/barbie-deluxe-style.jpg", import.meta.url).toString();

export type PresetCharacterId = "barbie-rigged" | "barbie-odile" | "barbie-silkstone" | "barbie-deluxe-style";

export type PresetCharacter = {
    id: PresetCharacterId;
    label: string;
    prompt: string;
    glbUrl: string;
    previewUrl: string;
    initialYRotation?: number;
};

export const PRESET_CHARACTERS: PresetCharacter[] = [
    {
        id: "barbie-rigged",
        label: "CLASSIC DOLL",
        prompt: "Classic Barbie Doll",
        glbUrl: classicRiggedBarbieGlbUrl,
        previewUrl: classicRiggedBarbiePreviewUrl,
        initialYRotation: Math.PI,
    },
    {
        id: "barbie-odile",
        label: "ODILE",
        prompt: "Barbie Odile",
        glbUrl: odileBarbieGlbUrl,
        previewUrl: odileBarbiePreviewUrl,
        initialYRotation: Math.PI,
    },
    {
        id: "barbie-silkstone",
        label: "SILKSTONE",
        prompt: "Silkstone Barbie",
        glbUrl: silkstoneBarbieGlbUrl,
        previewUrl: silkstoneBarbiePreviewUrl,
        initialYRotation: Math.PI,
    },
    {
        id: "barbie-deluxe-style",
        label: "DELUXE STYLE",
        prompt: "Barbie Deluxe Style",
        glbUrl: deluxeStyleBarbieGlbUrl,
        previewUrl: deluxeStyleBarbiePreviewUrl,
        initialYRotation: Math.PI,
    },
];

export function getPresetCharacter(id: PresetCharacterId): PresetCharacter | undefined {
    return PRESET_CHARACTERS.find((preset) => preset.id === id);
}
