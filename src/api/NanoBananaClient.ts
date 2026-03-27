import { GOOGLE_API_KEY } from "../secrets";
import { logDebug } from "../utils/DebugLog";

const NANO_BANANA_PRO_MODEL = "gemini-3-pro-image-preview";
const NANO_BANANA_FALLBACK_MODEL = "gemini-3.1-flash-image-preview";
const NANO_BANANA_PRO_URL = `https://generativelanguage.googleapis.com/v1beta/models/${NANO_BANANA_PRO_MODEL}:generateContent?key=${GOOGLE_API_KEY}`;
const NANO_BANANA_FALLBACK_URL = `https://generativelanguage.googleapis.com/v1beta/models/${NANO_BANANA_FALLBACK_MODEL}:generateContent?key=${GOOGLE_API_KEY}`;

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

type InlineData = {
    mimeType?: string;
    mime_type?: string;
    data?: string;
};

type GeminiImagePart = {
    text?: string;
    inlineData?: InlineData;
    inline_data?: InlineData;
};

type GeminiImageResponse = {
    candidates?: Array<{
        content?: {
            parts?: GeminiImagePart[];
        };
    }>;
    error?: {
        message?: string;
    };
};

function getHeaders(): HeadersInit {
    return {
        "Content-Type": "application/json",
    };
}

async function readJson<T>(response: Response): Promise<T> {
    const body = await response.json().catch(() => null) as GeminiImageResponse | null;
    if (!response.ok) {
        const message = body?.error?.message || `Nano Banana request failed with HTTP ${response.status}.`;
        throw new NanoBananaClientError(NanoBananaError.APIError, message);
    }
    return body as T;
}

function isRetryableImageError(error: unknown): boolean {
    return error instanceof NanoBananaClientError
        && (error.message.includes("HTTP 429")
            || error.message.includes("HTTP 500")
            || error.message.includes("HTTP 502")
            || error.message.includes("HTTP 503")
            || error.message.includes("HTTP 504"));
}

async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => window.setTimeout(resolve, ms));
}

function imagePartToDataUrl(part: GeminiImagePart | undefined): string | null {
    const inline = part?.inlineData ?? part?.inline_data;
    const mimeType = inline?.mimeType ?? inline?.mime_type;
    const data = inline?.data;
    if (!mimeType || !data) return null;
    return `data:${mimeType};base64,${data}`;
}

async function requestNanoBanana(parts: Array<Record<string, unknown>>, modelUrl: string): Promise<string> {
    const model = modelUrl.includes(NANO_BANANA_PRO_MODEL) ? NANO_BANANA_PRO_MODEL : NANO_BANANA_FALLBACK_MODEL;
    logDebug("nano_banana.request", { model });
    const response = await fetch(modelUrl, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
            contents: [{
                parts,
            }],
            generationConfig: {
                responseModalities: ["TEXT", "IMAGE"],
                temperature: 0.1,
            },
        }),
    });

    const data = await readJson<GeminiImageResponse>(response);
    const imagePart = data.candidates?.[0]?.content?.parts?.find((part) => !!imagePartToDataUrl(part));
    const dataUrl = imagePartToDataUrl(imagePart);
    if (!dataUrl) {
        logDebug("nano_banana.invalid_response", { model });
        throw new NanoBananaClientError(NanoBananaError.InvalidResponse, "Nano Banana finished, but no image was returned.");
    }

    logDebug("nano_banana.success", {
        model,
        mimeType: dataUrl.startsWith("data:image/png") ? "image/png" : "image/jpeg",
    });

    return dataUrl;
}

async function requestNanoBananaWithRetry(parts: Array<Record<string, unknown>>): Promise<string> {
    const attempts = [
        { url: NANO_BANANA_PRO_URL, delays: [0, 400, 1100] },
        { url: NANO_BANANA_FALLBACK_URL, delays: [0, 250] },
    ];

    let lastError: unknown = null;

    for (const attempt of attempts) {
        for (let i = 0; i < attempt.delays.length; i++) {
            const delay = attempt.delays[i];
            if (delay > 0) await sleep(delay);

            try {
                return await requestNanoBanana(parts, attempt.url);
            }
            catch (error) {
                lastError = error;
                logDebug("nano_banana.retryable_error", {
                    model: attempt.url.includes(NANO_BANANA_PRO_MODEL) ? NANO_BANANA_PRO_MODEL : NANO_BANANA_FALLBACK_MODEL,
                    message: error instanceof Error ? error.message : String(error),
                });
                if (!isRetryableImageError(error) || i === attempt.delays.length - 1) break;
            }
        }
    }

    if (lastError instanceof Error) throw lastError;
    throw new NanoBananaClientError(NanoBananaError.APIError, "Nano Banana image generation failed.");
}

export async function generateReferenceImage(
    prompt: string,
    onProgress?: (status: string) => void
): Promise<string> {
    try {
        onProgress?.("Painting reference...");
        return await requestNanoBananaWithRetry([{ text: prompt }]);
    }
    catch (error) {
        if (error instanceof NanoBananaClientError) throw error;
        throw new NanoBananaClientError(
            NanoBananaError.APIError,
            error instanceof Error ? error.message : "Nano Banana image generation failed."
        );
    }
}

export async function polishCaptureImage(
    imageDataUrl: string,
    characterPrompt: string,
    worldPrompt: string,
    onProgress?: (status: string) => void
): Promise<string> {
    try {
        onProgress?.("Cinematic polish...");
        return await requestNanoBananaWithRetry([
            {
                inlineData: {
                    mimeType: imageDataUrl.startsWith("data:image/png") ? "image/png" : "image/jpeg",
                    data: imageDataUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ""),
                },
            },
            {
                text: `This is a user-generated AR screenshot for a Barbie story app.
You are doing a restrained cleanup pass only.

Hard rules:
- Preserve the exact composition, crop, camera angle, pose, proportions, and silhouette.
- Preserve the exact environment and prop layout.
- Preserve the exact color scheme and overall lighting direction.
- Preserve the Barbie identity from this capture and the prompt: ${characterPrompt}.
- Preserve the world/background context from: ${worldPrompt || "a whimsical Barbie storybook scene"}.
- Do not redesign, restyle, beautify, re-illustrate, or reimagine the image.
- Do not change the face, eyes, nose, mouth, hairstyle, body shape, dress shape, hands, or background geometry.
- Do not add or remove objects, accessories, sparkles, borders, text, or people.

Allowed edits only:
- clean render blemishes
- soften harsh artifacts
- slightly improve edge quality
- slightly improve lighting coherence
- lightly enhance clarity while keeping the image recognizably the same shot

Return the same image, just subtly cleaner.`,
            },
        ]);
    }
    catch (error) {
        if (error instanceof NanoBananaClientError) throw error;
        throw new NanoBananaClientError(
            NanoBananaError.APIError,
            error instanceof Error ? error.message : "Nano Banana image editing failed."
        );
    }
}
