import { fal } from "@fal-ai/client";
import { FAL_API_KEY } from "../secrets";

const RODIN_MODEL = "fal-ai/hyper3d/rodin/v2";

export enum RodinError {
    Timeout = "timeout",
    APIError = "api-error",
    InvalidResponse = "invalid-response",
}

export class RodinClientError extends Error {
    constructor(public readonly type: RodinError, message: string) {
        super(message);
        this.name = "RodinClientError";
    }
}

type QueueLog = {
    message?: string;
};

type QueueStatusResponse = {
    status?: string;
    logs?: QueueLog[];
};

type RodinResultPayload = {
    model_mesh?: {
        url?: string;
    };
    glb?: {
        url?: string;
    };
    model_meshes?: Array<{ url?: string }>;
};

type RodinResult = {
    data?: RodinResultPayload;
} & RodinResultPayload;

let falConfigured = false;

function ensureFalConfigured(): void {
    if (falConfigured) return;

    fal.config({
        credentials: FAL_API_KEY,
        suppressLocalCredentialsWarning: true,
    });
    falConfigured = true;
}

function inferProgressMessage(status: QueueStatusResponse): string {
    const logs = status.logs?.map((log) => log.message?.toLowerCase() ?? "").join(" ") ?? "";
    if (logs.includes("texture")) return "Generating 3D model... (texturing)";
    if (logs.includes("mesh") || logs.includes("shape") || logs.includes("geometry") || status.status === "IN_QUEUE") {
        return "Generating 3D model... (sculpting)";
    }
    return "Generating 3D model...";
}

function getPayload(result: RodinResult): RodinResultPayload {
    return result.data ?? result;
}

function getGlbUrl(result: RodinResult): string | null {
    const payload = getPayload(result);
    return payload.model_mesh?.url
        ?? payload.glb?.url
        ?? payload.model_meshes?.[0]?.url
        ?? null;
}

async function runRodin(
    input: Record<string, unknown>,
    onProgress?: (status: string) => void
): Promise<string> {
    ensureFalConfigured();

    try {
        const result = await fal.subscribe(RODIN_MODEL, {
            input,
            logs: true,
            onQueueUpdate: (status) => onProgress?.(inferProgressMessage(status as QueueStatusResponse)),
        });

        const glbUrl = getGlbUrl(result as RodinResult);
        if (!glbUrl) {
            throw new RodinClientError(RodinError.InvalidResponse, "Rodin finished, but no GLB url was returned.");
        }

        return glbUrl;
    }
    catch (error) {
        if (error instanceof RodinClientError) throw error;
        throw new RodinClientError(
            RodinError.APIError,
            error instanceof Error ? error.message : "Rodin generation failed."
        );
    }
}

export async function generateCharacter(
    prompt: string,
    onProgress?: (status: string) => void
): Promise<string> {
    return await runRodin({
        prompt,
        geometry_file_format: "glb",
        material: "PBR",
        quality_mesh_option: "500K Triangle",
        preview_render: false,
    }, onProgress);
}

export async function generateCharacterFromImage(
    imageUrl: string,
    prompt: string,
    onProgress?: (status: string) => void
): Promise<string> {
    return await runRodin({
        prompt,
        input_image_urls: [imageUrl],
        geometry_file_format: "glb",
        material: "PBR",
        quality_mesh_option: "500K Triangle",
        preview_render: false,
    }, onProgress);
}
