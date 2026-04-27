const glamVanitySunsetUrl = new URL("../assets/worlds/glam-vanity-sunset.jpg", import.meta.url).toString();
const dreamhouseLobbyUrl = new URL("../assets/worlds/dreamhouse-lobby.jpg", import.meta.url).toString();
const rooftopPoolLoungeUrl = new URL("../assets/worlds/rooftop-pool-lounge.jpg", import.meta.url).toString();
const palaceGrandHallUrl = new URL("../assets/worlds/palace-grand-hall.jpg", import.meta.url).toString();
const beachResortPoolUrl = new URL("../assets/worlds/beach-resort-pool.jpg", import.meta.url).toString();

export type PresetBackgroundId = "glam-vanity" | "dreamhouse-lobby" | "rooftop-pool" | "palace-hall" | "beach-resort";

export type PresetBackground = {
    id: PresetBackgroundId;
    label: string;
    title: string;
    panoUrl: string;
    previewUrl: string;
};

export const PRESET_BACKGROUNDS: PresetBackground[] = [
    {
        id: "glam-vanity",
        label: "GLAM VANITY",
        title: "Glam Vanity Sunset",
        panoUrl: glamVanitySunsetUrl,
        previewUrl: glamVanitySunsetUrl,
    },
    {
        id: "dreamhouse-lobby",
        label: "DREAMHOUSE LOBBY",
        title: "Dreamhouse Lobby",
        panoUrl: dreamhouseLobbyUrl,
        previewUrl: dreamhouseLobbyUrl,
    },
    {
        id: "rooftop-pool",
        label: "ROOFTOP POOL",
        title: "Rooftop Pool Lounge",
        panoUrl: rooftopPoolLoungeUrl,
        previewUrl: rooftopPoolLoungeUrl,
    },
    {
        id: "palace-hall",
        label: "PALACE HALL",
        title: "Palace Grand Hall",
        panoUrl: palaceGrandHallUrl,
        previewUrl: palaceGrandHallUrl,
    },
    {
        id: "beach-resort",
        label: "BEACH RESORT",
        title: "Beach Resort Pool",
        panoUrl: beachResortPoolUrl,
        previewUrl: beachResortPoolUrl,
    },
];

export function getPresetBackground(id: PresetBackgroundId): PresetBackground | undefined {
    return PRESET_BACKGROUNDS.find((preset) => preset.id === id);
}
