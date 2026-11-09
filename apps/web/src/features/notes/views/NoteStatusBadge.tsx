import { Badge } from '@/shared/ui/Badge';
import { noteStatus } from '../model/note.model';

export function NoteStatusBadge({ status }: { status: string }) {
  const { label, tone } = noteStatus(status);
  return <Badge tone={tone}>{label}</Badge>;
}
