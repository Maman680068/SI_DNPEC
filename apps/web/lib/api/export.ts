import { API_BASE_URL, authHeaders } from './client';

// Hors apiFetch : la réponse est un flux binaire, pas du JSON — même pattern
// que downloadAttachment (lib/api/tasks.ts) et downloadVersion (lib/api/documents.ts).
async function downloadFile(path: string, fileName: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Export impossible');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportTasksExcel(): Promise<void> {
  return downloadFile('/export/tasks.xlsx', `taches_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportDashboardPdf(): Promise<void> {
  return downloadFile('/export/dashboard.pdf', `tableau_de_bord_${new Date().toISOString().slice(0, 10)}.pdf`);
}
