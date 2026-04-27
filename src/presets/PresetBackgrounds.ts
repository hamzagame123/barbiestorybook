const dreamhouseHdriUrl = new URL("../assets/worlds/barbie-dreamhouse-pano.jpg", import.meta.url).toString();
const dollhouseSalonHdriUrl = new URL("../assets/worlds/dollhouse-salon.jpg", import.meta.url).toString();
const dollhouseMusicRoomHdriUrl = new URL("../assets/worlds/dollhouse-music-room.jpg", import.meta.url).toString();
const dollhousePartyGardenHdriUrl = new URL("../assets/worlds/dollhouse-party-garden.jpg", import.meta.url).toString();

export type PresetBackgroundId = "dreamhouse" | "salon" | "music-room" | "party-garden";

export type PresetBackground = {
    id: PresetBackgroundId;
    label: string;
    title: string;
    panoUrl: string;
    previewUrl: string;
};

export const PRESET_BACKGROUNDS: PresetBackground[] = [
    {
        id: "dreamhouse",
        label: "DREAMHOUSE PANO",
        title: "Dreamhouse Pano",
        panoUrl: dreamhouseHdriUrl,
        previewUrl: dreamhouseHdriUrl,
    },
    {
        id: "salon",
        label: "DOLLHOUSE SALON",
        title: "Dollhouse Salon",
        panoUrl: dollhouseSalonHdriUrl,
        previewUrl: dollhouseSalonHdriUrl,
    },
    {
        id: "music-room",
        label: "MUSIC ROOM",
        title: "Music Room",
        panoUrl: dollhouseMusicRoomHdriUrl,
        previewUrl: dollhouseMusicRoomHdriUrl,
    },
    {
        id: "party-garden",
        label: "PARTY GARDEN",
        title: "Party Garden",
        panoUrl: dollhousePartyGardenHdriUrl,
        previewUrl: dollhousePartyGardenHdriUrl,
    },
];

export function getPresetBackground(id: PresetBackgroundId): PresetBackground | undefined {
    return PRESET_BACKGROUNDS.find((preset) => preset.id === id);
}
