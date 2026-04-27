import { fal } from "@fal-ai/client";
import { FAL_API_KEY } from "../secrets";
import { logDebug } from "../utils/DebugLog";

const NANO_BANANA_PRO_MODEL = "fal-ai/nano-banana-pro";
const NANO_BANANA_PRO_EDIT_MODEL = "fal-ai/nano-banana-pro/edit";

export enum NanoBananaError {
    APIError = "api-error",
    InvalidResponse = "invalid-response",
}

export class NanoBananaClientError extends Error {
    constructor(public readonly type: NanoBananaError, message: string) {
        super(message);
        this.name = "NanoBananaClientError";
    }
}

type FalImage = {
    url?: string;
};

type FalImageResponse = {
    images?: FalImage[];
    description?: string;
};

type FalImageResult = {
    data?: FalImageResponse;
} & FalImageResponse;

let falConfigured = false;

function ensureFalConfigured(): void {
    if (falConfigured) return;

    fal.config({
        credentials: FAL_API_KEY,
        suppressLocalCredentialsWarning: true,
    });
    falConfigured = true;
}

function getPayload(result: FalImageResult): FalImageResponse {
    return result.data ?? result;
}

function getImageUrl(result: FalImageResult): string | null {
    return getPayload(result).images?.[0]?.url ?? null;
}

async function fetchAsDataUrl(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new NanoBananaClientError(NanoBananaError.APIError, `Failed to fetch generated image with HTTP ${response.status}.`);
    }

    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(reader.error ?? new Error("Failed to read generated image."));
        reader.readAsDataURL(blob);
    });
}

async function uploadDataUrl(dataUrl: string): Promise<string> {
    ensureFalConfigured();
    const response = await fetch(dataUrl);
    if (!response.ok) {
        throw new NanoBananaClientError(NanoBananaError.APIError, `Failed to prepare image upload with HTTP ${response.status}.`);
    }

    const blob = await response.blob();
    return await fal.storage.upload(blob, {
        lifecycle: {
            expiresIn: "1d",
        },
    });
}

function handleQueueUpdate(status: { status?: string }, onProgress?: (status: string) => void): void {
    const next = status.status;
    if (!next) return;

    if (next === "IN_QUEUE") onProgress?.("Waiting for Nano Banana...");
    else if (next === "IN_PROGRESS") onProgress?.("Painting...");
}

async function runNanoBanana(
    endpoint: string,
    input: Record<string, unknown>,
    onProgress?: (status: string) => void,
    output: "url" | "dataUrl" = "url"
): Promise<string> {
    ensureFalConfigured();
    logDebug("nano_banana.request", {
        endpoint,
        mode: output,
    });

    try {
        const result = await fal.subscribe(endpoint, {
            input,
            logs: true,
            onQueueUpdate: (status) => handleQueueUpdate(status, onProgress),
        });

        const imageUrl = getImageUrl(result as FalImageResult);
        if (!imageUrl) {
            logDebug("nano_banana.invalid_response", { endpoint });
            throw new NanoBananaClientError(NanoBananaError.InvalidResponse, "Nano Banana finished, but no image was returned.");
        }

        logDebug("nano_banana.success", {
            endpoint,
            output,
        });

        return output === "dataUrl"
            ? await fetchAsDataUrl(imageUrl)
            : imageUrl;
    }
    catch (error) {
        if (error instanceof NanoBananaClientError) throw error;
        throw new NanoBananaClientError(
            NanoBananaError.APIError,
            error instanceof Error ? error.message : "Nano Banana image generation failed."
        );
    }
}

export async function generateReferenceImage(
    prompt: string,
    onProgress?: (status: string) => void
): Promise<string> {
    onProgress?.("Painting reference...");

    return await runNanoBanana(
        NANO_BANANA_PRO_MODEL,
        {
        prompt,
        aspect_ratio: "1:1",
        resolution: "1K",
        output_format: "png",
        num_images: 1,
        limit_generations: true,
        safety_tolerance: "4",
        },
        onProgress,
        "url"
    );
}

export async function generateBackdropPanorama(
    prompt: string,
    onProgress?: (status: string) => void
): Promise<string> {
    onProgress?.("Painting backdrop...");

    return await runNanoBanana(
        NANO_BANANA_PRO_MODEL,
        {
        prompt: `Create a polished Barbie-only storybook backdrop as a wide panoramic environment image.

Scene idea: ${prompt}

Rules:
- the result must feel unmistakably Barbie
- create a Barbie room, Barbie set, Barbie play environment, Barbie dreamhouse space, or Barbie fantasy location
- use Barbie-coded materials, decor, color language, silhouettes, and styling
- glamorous, playful, polished, toy-like, girlhood-forward visual direction
- think dreamhouse, vanity room, fashion studio, music room, beach club, pink boutique, sparkle bedroom, runway backstage, pastel garden party
- environment only
- no people
- no dolls
- no characters
- no close foreground subject
- no text
- no logo
- no split panels
- no realistic gritty architecture
- no masculine industrial style
- no horror, sci-fi war, dark fantasy, or generic realism
- keep it child-safe, playful, glossy, and toy-like
- make it readable behind AR toys
- prefer a wide panoramic composition with strong left-right environmental coverage
- rich background details are fine, but keep the center area visually open for a doll scene

Return only the image.`,
        aspect_ratio: "16:9",
        resolution: "2K",
        output_format: "png",
        num_images: 1,
        limit_generations: true,
        safety_tolerance: "4",
        },
        onProgress,
        "url"
    );
}

export async function polishCaptureImage(
    imageDataUrl: string,
    characterPrompt: string,
    worldPrompt: string,
    onProgress?: (status: string) => void
): Promise<string> {
    onProgress?.("Cinematic composite...");
    const uploadedImageUrl = await uploadDataUrl(imageDataUrl);

    return await runNanoBanana(
        NANO_BANANA_PRO_EDIT_MODEL,
        {
        prompt: `This is a user-generated AR screenshot for a Barbie story app.
Turn it into one cohesive, cinematic final image while preserving the same scene and composition.

Core goal:
- make the character, props, and background feel like they belong in one polished animated movie frame
- unify the lighting, color, depth, and shadows across the whole shot
- keep the same camera view, same scene layout, and same storytelling beat

Hard constraints:
- preserve the exact composition and crop
- preserve the exact pose and silhouette of the character
- preserve the exact environment and prop placement
- preserve the overall identity of the scene based on: ${characterPrompt}
- preserve the world context based on: ${worldPrompt || "a whimsical Barbie storybook scene"}
- do not add or remove objects, people, text, borders, or decorations
- do not turn it into a different outfit, different prop set, or different room

What to improve:
- blend the AR elements and background into a single cohesive image
- make lighting feel cinematic, soft, glossy, and movie-like
- improve shadow logic so objects feel grounded
- improve color harmony and depth
- reduce harsh compositing artifacts and mismatched edges
- give the image a polished animated-feature finish
- keep it child-safe, Barbie-like, premium, and magical

Important:
- this should still clearly be the same scene
- do not radically restyle it
- do not flatten it into a generic filter
- do not make it gritty, realistic, dark, or dramatic in a non-Barbie way

Return one polished cinematic composite of the same shot.`,
        image_urls: [uploadedImageUrl],
        aspect_ratio: "auto",
        resolution: "2K",
        output_format: "png",
        num_images: 1,
        limit_generations: true,
        safety_tolerance: "4",
        },
        onProgress,
        "dataUrl"
    );
}
