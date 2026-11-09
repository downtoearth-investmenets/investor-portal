import { apiFetch } from '@/shared/lib/api-client';
import type { Note } from '../model/note.model';

export const notesRepo = {
  list: (params: { investorId?: string } = {}) => {
    const query = params.investorId ? `?investorId=${encodeURIComponent(params.investorId)}` : '';
    return apiFetch<Note[]>(`/loans${query}`);
  },
  get: (id: string) => apiFetch<Note>(`/loans/${encodeURIComponent(id)}`)
};
