interface CloudinaryUploadResult {
    secureUrl: string;
    publicId: string;
    width: number | null;
    height: number | null;
    format: string | null;
}

function getRequiredEnv(name: "VITE_CLOUDINARY_CLOUD_NAME" | "VITE_CLOUDINARY_UPLOAD_PRESET"): string {
    const value = import.meta.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing Cloudinary env: ${name}`);
    }

    return value;
}

function getOptionalFolder(): string | null {
    const folder = import.meta.env.VITE_CLOUDINARY_FOLDER?.trim();
    return folder || null;
}

export async function uploadAvatarToCloudinary(file: File, uid: string): Promise<CloudinaryUploadResult> {
    const cloudName = getRequiredEnv("VITE_CLOUDINARY_CLOUD_NAME");
    const uploadPreset = getRequiredEnv("VITE_CLOUDINARY_UPLOAD_PRESET");
    const folder = getOptionalFolder();
    const formData = new FormData();

    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    formData.append("public_id", `${uid}-${Date.now()}`);
    formData.append("resource_type", "image");

    if (folder) {
        formData.append("folder", folder);
    }

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData,
    });

    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
        const errorMessage =
            typeof payload.error === "object" &&
            payload.error !== null &&
            "message" in payload.error &&
            typeof (payload.error as { message?: unknown }).message === "string"
                ? (payload.error as { message: string }).message
                : "Nao foi possivel enviar a imagem agora.";
        throw new Error(errorMessage);
    }

    const secureUrl = typeof payload.secure_url === "string" ? payload.secure_url.trim() : "";
    const publicId = typeof payload.public_id === "string" ? payload.public_id.trim() : "";

    if (!secureUrl || !publicId) {
        throw new Error("Cloudinary nao retornou os dados esperados da imagem.");
    }

    return {
        secureUrl,
        publicId,
        width: typeof payload.width === "number" ? payload.width : null,
        height: typeof payload.height === "number" ? payload.height : null,
        format: typeof payload.format === "string" ? payload.format : null,
    };
}
