/**
 * A byte count for display: bytes below 1 KB, then KB and MB with one decimal
 * (1024-based). Shared by the attachment lists and upload results of Jira and
 * Confluence, and by the download output.
 */
export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
