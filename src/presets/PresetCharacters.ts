const testBarbieGlbUrl = new URL("../assets/characters/test-barbie.glb", import.meta.url).toString();

export type PresetCharacterId = "test-barbie";

export type PresetCharacter = {
    id: PresetCharacterId;
    label: string;
    prompt: string;
    glbUrl: string;
};

export const PRESET_CHARACTERS: PresetCharacter[] = [
    {
        id: "test-barbie",
        label: "TEST BARBIE",
        prompt: "Test Barbie",
        glbUrl: testBarbieGlbUrl,
    },
];

export function getPresetCharacter(id: PresetCharacterId): PresetCharacter | undefined {
    return PRESET_CHARACTERS.find((preset) => preset.id === id);
}
