export { NoteDetailDrawer } from './views/NoteDetailDrawer';
export { NoteStatusBadge } from './views/NoteStatusBadge';
export { notesRepo } from './data/notes.repo';
export {
  isSettled,
  loanToValue,
  matchesNoteQuery,
  monthlyPayment,
  nextInstallment,
  noteProgress,
  noteStatus,
  paymentFromInstallment,
  placeLabel,
  rateChanges
} from './model/note.model';
export type {
  ActivityEntry,
  InstallmentStatus,
  Note,
  NoteProperty,
  NoteStatus,
  PaymentRecord,
  RateChange,
  ScheduleItem
} from './model/note.model';
