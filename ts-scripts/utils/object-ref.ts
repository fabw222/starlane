import { normalizeSuiObjectId } from "@mysten/sui/utils";

export interface ResolvedObjectRef {
  objectId: string;
  version: string;
  digest: string;
}

export function extractObjectRef(
  objectId: string,
  response: {
    data?: {
      version?: string | number | null;
      digest?: string | null;
    } | null;
  }
): ResolvedObjectRef {
  const normalizedObjectId = normalizeSuiObjectId(objectId);
  const version = response.data?.version;
  const digest = response.data?.digest;

  if (
    version == null ||
    (typeof version === "number" && version <= 0) ||
    (typeof version === "string" && (!version.trim() || version === "0")) ||
    !digest
  ) {
    throw new Error(`Unable to resolve object ref for ${normalizedObjectId}`);
  }

  return {
    objectId: normalizedObjectId,
    version: String(version),
    digest
  };
}
