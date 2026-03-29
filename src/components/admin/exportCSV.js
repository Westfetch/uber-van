import api from '../../lib/api.js';

export async function exportCSV(type, token, filters = {}) {
  const params = new URLSearchParams({ action: 'export', type });
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.search) params.set('search', filters.search);

  const res = await api(`/api/admin?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
