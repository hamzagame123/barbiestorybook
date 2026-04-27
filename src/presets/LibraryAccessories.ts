const toyGuitarPreviewUrl = new URL("../assets/library/accessories/toy-guitar.jpg", import.meta.url).toString();
const birthdayCakePreviewUrl = new URL("../assets/library/accessories/birthday-cake-imported.jpg", import.meta.url).toString();
const toyPuppyPreviewUrl = new URL("../assets/library/accessories/toy-puppy-imported.jpg", import.meta.url).toString();
const handbagPreviewUrl = new URL("../assets/library/accessories/handbag-imported.jpg", import.meta.url).toString();
const crownPreviewUrl = new URL("../assets/library/accessories/crown.jpg", import.meta.url).toString();
const tawnyHorsePreviewUrl = new URL("../assets/library/accessories/tawny-horse.jpg", import.meta.url).toString();
const barbieBoxPreviewUrl = new URL("../assets/library/accessories/barbie-box.jpg", import.meta.url).toString();
const popstarStagePreviewUrl = new URL("../assets/library/accessories/popstar-stage.gif", import.meta.url).toString();
const firstAidKitPreviewUrl = new URL("../assets/library/accessories/first-aid-kit.gif", import.meta.url).toString();
const dressMannequinPreviewUrl = new URL("../assets/library/accessories/dress-mannequin.gif", import.meta.url).toString();
const hospitalBedPreviewUrl = new URL("../assets/library/accessories/hospital-bed.gif", import.meta.url).toString();
const heartMonitorScreenPreviewUrl = new URL("../assets/library/accessories/heart-monitor-screen.gif", import.meta.url).toString();
const spotlightPreviewUrl = new URL("../assets/library/accessories/spotlight.gif", import.meta.url).toString();

const toyGuitarGlbUrl = new URL("../assets/accessories/toy-guitar.glb", import.meta.url).toString();
const birthdayCakeGlbUrl = new URL("../assets/accessories/birthday-cake.glb", import.meta.url).toString();
const toyPuppyGlbUrl = new URL("../assets/accessories/toy-puppy.glb", import.meta.url).toString();
const handbagGlbUrl = new URL("../assets/accessories/handbag.glb", import.meta.url).toString();
const crownGlbUrl = new URL("../assets/accessories/crown.glb", import.meta.url).toString();
const tawnyHorseGlbUrl = new URL("../assets/accessories/tawny-horse.glb", import.meta.url).toString();
const barbieBoxGlbUrl = new URL("../assets/accessories/barbie-box.glb", import.meta.url).toString();
const popstarStageGlbUrl = new URL("../assets/accessories/popstar-stage.glb", import.meta.url).toString();
const firstAidKitGlbUrl = new URL("../assets/accessories/first-aid-kit.glb", import.meta.url).toString();
const dressMannequinGlbUrl = new URL("../assets/accessories/dress-mannequin.glb", import.meta.url).toString();
const hospitalBedGlbUrl = new URL("../assets/accessories/hospital-bed.glb", import.meta.url).toString();
const heartMonitorScreenGlbUrl = new URL("../assets/accessories/heart-monitor-screen.glb", import.meta.url).toString();
const spotlightGlbUrl = new URL("../assets/accessories/spotlight.glb", import.meta.url).toString();

export type LibraryAccessoryId =
    | "toy-guitar"
    | "birthday-cake"
    | "toy-puppy"
    | "handbag"
    | "crown"
    | "tawny-horse"
    | "barbie-box"
    | "popstar-stage"
    | "first-aid-kit"
    | "dress-mannequin"
    | "hospital-bed"
    | "heart-monitor-screen"
    | "spotlight";

export type LibraryAccessory = {
    id: LibraryAccessoryId;
    label: string;
    title: string;
    previewUrl: string;
    note: string;
    glbUrl: string;
    targetSize: number;
    initialYRotation?: number;
    sourceModelUrl: string;
};

export const LIBRARY_ACCESSORIES: LibraryAccessory[] = [
    {
        id: "toy-guitar",
        label: "GUITAR",
        title: "Toy Guitar",
        previewUrl: toyGuitarPreviewUrl,
        glbUrl: toyGuitarGlbUrl,
        targetSize: 0.42,
        note: "Music prop with a clean silhouette that reads well in AR.",
        sourceModelUrl: "https://sketchfab.com/3d-models/simple-guitar-66cc8c1e9e2d4cf9841fca489e9ff48c",
    },
    {
        id: "birthday-cake",
        label: "CAKE",
        title: "Birthday Cake",
        previewUrl: birthdayCakePreviewUrl,
        glbUrl: birthdayCakeGlbUrl,
        targetSize: 0.34,
        note: "Stylized party cake prop sized for tabletop scenes.",
        sourceModelUrl: "https://sketchfab.com/3d-models/birthday-cake-87f446798bb544c6b0dca2504b1f9d50",
    },
    {
        id: "toy-puppy",
        label: "PUPPY",
        title: "Toy Puppy",
        previewUrl: toyPuppyPreviewUrl,
        glbUrl: toyPuppyGlbUrl,
        targetSize: 0.3,
        initialYRotation: Math.PI * 0.2,
        note: "Small puppy sidekick prop for warm, playful story beats.",
        sourceModelUrl: "https://sketchfab.com/3d-models/puppy-furry-toy-fc3550ee5c714617bba6e8b2df1bdb1a",
    },
    {
        id: "handbag",
        label: "HANDBAG",
        title: "Simple Handbag",
        previewUrl: handbagPreviewUrl,
        glbUrl: handbagGlbUrl,
        targetSize: 0.28,
        initialYRotation: Math.PI * 0.15,
        note: "Simple handbag prop with a clean, readable shape.",
        sourceModelUrl: "https://sketchfab.com/3d-models/simple-handbag-mockup-asset-gameready-c79e728aab9042aea6865889a130ab5f",
    },
    {
        id: "crown",
        label: "CROWN",
        title: "Anneliese's Crown",
        previewUrl: crownPreviewUrl,
        glbUrl: crownGlbUrl,
        targetSize: 0.18,
        note: "Tiny royal crown prop for close-up story beats and dress-up scenes.",
        sourceModelUrl: "https://sketchfab.com/3d-models/annelieses-crown-bca4312eaeab4ff58f1c665158d8445e",
    },
    {
        id: "tawny-horse",
        label: "HORSE",
        title: "Tawny Horse",
        previewUrl: tawnyHorsePreviewUrl,
        glbUrl: tawnyHorseGlbUrl,
        targetSize: 0.56,
        initialYRotation: Math.PI * -0.18,
        note: "Dreamhouse pet horse prop that reads clearly on a tabletop scene.",
        sourceModelUrl: "https://sketchfab.com/3d-models/barbie--dreamhouse-party-pets-tawny-horse-2c5bd9d5ab6d41bd851c1a9d3284b8e2",
    },
    {
        id: "barbie-box",
        label: "BOX",
        title: "Barbie Movie Box",
        previewUrl: barbieBoxPreviewUrl,
        glbUrl: barbieBoxGlbUrl,
        targetSize: 0.7,
        note: "Low-poly Barbie photo box prop for cover shots and playful stage framing.",
        sourceModelUrl: "https://sketchfab.com/3d-models/barbie-the-movie-barbie-box-bec035eb61b04f4ab32c4e4d0760cc49",
    },
    {
        id: "popstar-stage",
        label: "STAGE",
        title: "Popstar Stage",
        previewUrl: popstarStagePreviewUrl,
        glbUrl: popstarStageGlbUrl,
        targetSize: 1.2,
        note: "Pink performance riser for concert, runway, and glam stage scenes.",
        sourceModelUrl: "User supplied local asset",
    },
    {
        id: "first-aid-kit",
        label: "AID KIT",
        title: "First Aid Kit",
        previewUrl: firstAidKitPreviewUrl,
        glbUrl: firstAidKitGlbUrl,
        targetSize: 0.24,
        initialYRotation: Math.PI * 0.12,
        note: "Cute medical prop for clinic, rescue, and care-themed Barbie scenes.",
        sourceModelUrl: "User supplied local asset",
    },
    {
        id: "dress-mannequin",
        label: "MANNEQUIN",
        title: "Dress Mannequin",
        previewUrl: dressMannequinPreviewUrl,
        glbUrl: dressMannequinGlbUrl,
        targetSize: 0.62,
        initialYRotation: Math.PI * 0.08,
        note: "Boutique mannequin prop for fashion studio, closet, and runway stories.",
        sourceModelUrl: "User supplied local asset",
    },
    {
        id: "hospital-bed",
        label: "BED",
        title: "Hospital Bed",
        previewUrl: hospitalBedPreviewUrl,
        glbUrl: hospitalBedGlbUrl,
        targetSize: 0.9,
        initialYRotation: Math.PI * -0.12,
        note: "Large medical set piece for Barbie hospital, rescue, and care scenes.",
        sourceModelUrl: "User supplied local asset",
    },
    {
        id: "heart-monitor-screen",
        label: "MONITOR",
        title: "Heart Monitor",
        previewUrl: heartMonitorScreenPreviewUrl,
        glbUrl: heartMonitorScreenGlbUrl,
        targetSize: 0.46,
        note: "Medical monitor prop that pairs with the hospital bed and clinic scenes.",
        sourceModelUrl: "User supplied local asset",
    },
    {
        id: "spotlight",
        label: "LIGHT",
        title: "Spotlight",
        previewUrl: spotlightPreviewUrl,
        glbUrl: spotlightGlbUrl,
        targetSize: 0.42,
        initialYRotation: Math.PI * 0.2,
        note: "Hot-pink spotlight prop for popstar stages, fashion shows, and performances.",
        sourceModelUrl: "User supplied local asset",
    },
];
