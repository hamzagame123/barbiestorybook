import { WORLDLABS_API_KEY } from "../secrets";

const WORLDLABS_BASE_URL = "https://api.worldlabs.ai/marble/v1";
const POLL_INTERVAL_MS = 5000;
const TIMEOUT_MS = 7 * 60_000;

export type MarbleWorldAssets = {
    caption: string;
    thumbnailUrl: string;
    panoUrl: string;
    colliderMeshUrl: string;
    marbleUrl: string;
    worldId: string;
};

export enum WorldLabsError {
    Timeout = "timeout",
    APIError = "api-error",
    InvalidResponse = "invalid-response",
}

export class WorldLabsClientError extends Error {
    constructor(public readonly type: WorldLabsError, message: string) {
        super(message);
        this.name = "WorldLabsClientError";
    }
}

type GenerateWorldResponse = {
    operation_id?: string;
};

type OperationResponse = {
    done?: boolean;
    error?: {
        message?: string;
    } | null;
    metadata?: {
        world_id?: string;
        progress?: number;
        message?: string;
        status_message?: string;
    } | null;
    response?: WorldResponse | { world?: WorldResponse } | null;
};

type WorldResponse = {
    world_id?: string;
    id?: string;
    world_marble_url?: string;
    assets?: {
        caption?: string;
        thumbnail_url?: string;
        imagery?: {
            pano_url?: string;
        };
        mesh?: {
            collider_mesh_url?: string;
        };
    };
};

function getHeaders(): HeadersInit {
    return {
        "Content-Type": "application/json",
        "WLT-Api-Key": WORLDLABS_API_KEY,
    };
}

async function readJson<T>(response: Response): Promise<T> {
    const body = await response.json().catch(() => null) as { detail?: string; message?: string } | null;
    if (!response.ok) {
        throw new WorldLabsClientError(
            WorldLabsError.APIError,
            body?.detail || body?.message || `World Labs request failed with HTTP ${response.status}.`
        );
    }
    return body as T;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizeWorld(world: WorldResponse | null | undefined): MarbleWorldAssets {
    const worldId = world?.world_id ?? world?.id;
    const colliderMeshUrl = world?.assets?.mesh?.collider_mesh_url;
    const panoUrl = world?.assets?.imagery?.pano_url;
    const marbleUrl = world?.world_marble_url;

    if (!worldId || !colliderMeshUrl || !panoUrl || !marbleUrl) {
        throw new WorldLabsClientError(WorldLabsError.InvalidResponse, "World Labs finished, but the world assets were incomplete.");
    }

    return {
        worldId,
        marbleUrl,
        colliderMeshUrl,
        panoUrl,
        caption: world?.assets?.caption ?? "",
        thumbnailUrl: world?.assets?.thumbnail_url ?? "",
    };
}

async function getWorld(worldId: string): Promise<MarbleWorldAssets> {
    const response = await fetch(`${WORLDLABS_BASE_URL}/worlds/${worldId}`, {
        method: "GET",
        headers: getHeaders(),
    });

    const world = await readJson<WorldResponse>(response);
    return normalizeWorld(world);
}

function getProgressMessage(operation: OperationResponse): string {
    const numericProgress = typeof operation.metadata?.progress === "number"
        ? Math.round(operation.metadata.progress * (operation.metadata.progress <= 1 ? 100 : 1))
        : null;
    if (numericProgress !== null && numericProgress > 0 && numericProgress < 100) {
        return `Building world... ${numericProgress}%`;
    }

    const metadataMessage = operation.metadata?.status_message ?? operation.metadata?.message;
    if (metadataMessage) {
        return `Building world... ${metadataMessage}`;
    }

    return "Building world...";
}

export async function generateWorld(
    prompt: string,
    onProgress?: (status: string) => void
): Promise<MarbleWorldAssets> {
    try {
        const submitResponse = await fetch(`${WORLDLABS_BASE_URL}/worlds:generate`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({
                display_name: "Barbie Storybook World",
                model: "Marble 0.1-mini",
                world_prompt: {
                    type: "text",
                    text_prompt: prompt,
                    disable_recaption: true,
                },
            }),
        });

        const submitData = await readJson<GenerateWorldResponse>(submitResponse);
        const operationId = submitData.operation_id;
        if (!operationId) {
            throw new WorldLabsClientError(WorldLabsError.InvalidResponse, "World Labs did not return an operation id.");
        }

        const startedAt = Date.now();
        while (Date.now() - startedAt < TIMEOUT_MS) {
            const operationResponse = await fetch(`${WORLDLABS_BASE_URL}/operations/${operationId}`, {
                method: "GET",
                headers: getHeaders(),
            });

            const operation = await readJson<OperationResponse>(operationResponse);
            onProgress?.(getProgressMessage(operation));

            if (operation.error?.message) {
                throw new WorldLabsClientError(WorldLabsError.APIError, operation.error.message);
            }

            if (operation.done) {
                const worldId =
                    operation.metadata?.world_id ??
                    operation.response?.world?.world_id ??
                    operation.response?.world?.id ??
                    operation.response?.world_id ??
                    operation.response?.id;

                if (worldId) {
                    return await getWorld(worldId);
                }

                const responseWorld = "world" in (operation.response ?? {})
                    ? (operation.response as { world?: WorldResponse }).world
                    : operation.response as WorldResponse | null | undefined;

                return normalizeWorld(responseWorld);
            }

            await sleep(POLL_INTERVAL_MS);
        }

        throw new WorldLabsClientError(WorldLabsError.Timeout, "World generation timed out after 7 minutes.");
    }
    catch (error) {
        if (error instanceof WorldLabsClientError) throw error;
        throw new WorldLabsClientError(
            WorldLabsError.APIError,
            error instanceof Error ? error.message : "World generation failed."
        );
    }
}
