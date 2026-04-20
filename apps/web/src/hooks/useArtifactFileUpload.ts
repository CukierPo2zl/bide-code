import { useCallback, useState } from "react";

import { resolvePrimaryEnvironmentHttpUrl } from "~/environments/primary/target";
import type { ArtifactFileAttachment } from "~/types/workflow";

const ALLOWED_EXTENSIONS = new Set([
  ".txt", ".md", ".json", ".yaml", ".yml", ".toml", ".xml", ".csv",
  ".js", ".ts", ".tsx", ".jsx", ".py", ".rs", ".go", ".java", ".c",
  ".cpp", ".h", ".hpp", ".rb", ".sh", ".sql", ".html", ".css", ".scss",
  ".svelte", ".vue", ".swift", ".kt", ".lua", ".log", ".conf",
]);

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : "";
}

export function useArtifactFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File): Promise<ArtifactFileAttachment | null> => {
    setError(null);

    const ext = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      setError(`Unsupported file type: ${ext || "(no extension)"}`);
      return null;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 2 MB.`);
      return null;
    }

    setUploading(true);
    try {
      const content = await file.text();

      const response = await fetch(
        resolvePrimaryEnvironmentHttpUrl("/api/workflow/artifact-upload"),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ fileName: file.name, content }),
          credentials: "include",
        },
      );

      if (!response.ok) {
        const text = await response.text();
        setError(text || `Upload failed (${response.status})`);
        return null;
      }

      const result = (await response.json()) as ArtifactFileAttachment;
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { upload, uploading, error, clearError };
}

export async function fetchArtifactContent(attachmentId: string): Promise<string | null> {
  try {
    const response = await fetch(
      resolvePrimaryEnvironmentHttpUrl(`/api/workflow/artifact-content/${attachmentId}`),
      { credentials: "include" },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { content: string };
    return data.content;
  } catch {
    return null;
  }
}
