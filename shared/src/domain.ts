import { z } from 'zod';

/* ------------------------------------------------------------------ jalons */

export const MILESTONE_STATUSES = ['upcoming', 'in_progress', 'closed'] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  upcoming: 'À venir',
  in_progress: 'En cours',
  closed: 'Fermé',
};

/** Date seule, sans heure : « 2026-03-31 ». */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Date inexistante');

export const milestoneCreateSchema = z.object({
  title: z.string().trim().min(1, 'Le titre est obligatoire').max(200),
  description: z.string().trim().max(4000).default(''),
  targetDate: isoDate.nullable().default(null),
  status: z.enum(MILESTONE_STATUSES).default('upcoming'),
});

/**
 * Mise a jour partielle : chaque champ est facultatif et SANS valeur par defaut.
 * `.partial()` de zod garderait les `.default()`, et un champ absent reviendrait
 * a sa valeur par defaut — donc ecraserait ce qui est en base.
 */
export const milestoneUpdateSchema = z.object({
  title: z.string().trim().min(1, 'Le titre est obligatoire').max(200).optional(),
  description: z.string().trim().max(4000).optional(),
  targetDate: isoDate.nullable().optional(),
  status: z.enum(MILESTONE_STATUSES).optional(),
});

export type MilestoneCreateInput = z.infer<typeof milestoneCreateSchema>;
export type MilestoneUpdateInput = z.infer<typeof milestoneUpdateSchema>;

export const reorderSchema = z.object({
  /** Identifiants dans le nouvel ordre, du premier au dernier. */
  ids: z.array(z.string().min(1)).min(1),
});

export type ReorderInput = z.infer<typeof reorderSchema>;

export interface Criterion {
  id: string;
  milestoneId: string;
  label: string;
  checked: boolean;
  checkedAt: string | null;
  checkedBy: string | null;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  targetDate: string | null;
  status: MilestoneStatus;
  position: number;
  criteriaTotal: number;
  criteriaChecked: number;
  tasksOpen: number;
  late: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MilestoneDetail extends Milestone {
  criteria: Criterion[];
  tasks: Task[];
}

export const criterionCreateSchema = z.object({
  label: z.string().trim().min(1, 'Le critère ne peut pas être vide').max(500),
});

export const criterionUpdateSchema = z.object({
  label: z.string().trim().min(1).max(500).optional(),
  checked: z.boolean().optional(),
});

export type CriterionCreateInput = z.infer<typeof criterionCreateSchema>;
export type CriterionUpdateInput = z.infer<typeof criterionUpdateSchema>;

/* ------------------------------------------------------------------ tâches */

export const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  review: 'En revue',
  done: 'Terminé',
};

const externalUrl = z
  .string()
  .trim()
  .url('Lien invalide')
  .max(2000)
  .refine((value) => value.startsWith('http://') || value.startsWith('https://'), 'Lien http(s) attendu');

export const taskCreateSchema = z.object({
  milestoneId: z.string().min(1, 'Le jalon est obligatoire'),
  title: z.string().trim().min(1, 'Le titre est obligatoire').max(300),
  assigneeId: z.string().min(1).nullable().default(null),
  status: z.enum(TASK_STATUSES).default('todo'),
  externalUrl: externalUrl.nullable().default(null),
});

export const taskUpdateSchema = z.object({
  milestoneId: z.string().min(1, 'Le jalon est obligatoire').optional(),
  title: z.string().trim().min(1, 'Le titre est obligatoire').max(300).optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  externalUrl: externalUrl.nullable().optional(),
});

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;

/** Déplacement dans le kanban : colonne d'arrivée et ordre complet de la colonne. */
export const taskMoveSchema = z.object({
  status: z.enum(TASK_STATUSES),
  ids: z.array(z.string().min(1)).min(1),
});

export type TaskMoveInput = z.infer<typeof taskMoveSchema>;

export interface Task {
  id: string;
  milestoneId: string;
  milestoneTitle: string;
  title: string;
  assigneeId: string | null;
  assigneeName: string | null;
  status: TaskStatus;
  externalUrl: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

/* ----------------------------------------------------------------- journal */

export const JOURNAL_ENTITY_TYPES = ['milestone', 'task', 'criterion', 'document'] as const;
export type JournalEntityType = (typeof JOURNAL_ENTITY_TYPES)[number];

export const JOURNAL_ENTITY_LABELS: Record<JournalEntityType, string> = {
  milestone: 'Jalon',
  task: 'Tâche',
  criterion: 'Critère',
  document: 'Document',
};

export interface JournalEntry {
  id: string;
  entityType: JournalEntityType;
  entityId: string;
  entityLabel: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  actorId: string | null;
  actorName: string | null;
  at: string;
}

export interface JournalPage {
  entries: JournalEntry[];
  total: number;
  page: number;
  pageSize: number;
}

/* -------------------------------------------------------------------- hebdo */

export const weeklyReportSchema = z.object({
  closedText: z.string().max(8000).default(''),
  inProgressText: z.string().max(8000).default(''),
  blockedText: z.string().max(8000).default(''),
});

export type WeeklyReportInput = z.infer<typeof weeklyReportSchema>;

export interface WeeklySummaryItem {
  entityType: JournalEntityType;
  entityId: string;
  label: string;
  detail: string | null;
  at: string;
  actorName: string | null;
}

export interface WeeklyLateItem {
  id: string;
  title: string;
  targetDate: string;
  daysLate: number;
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  summary: {
    milestonesClosed: WeeklySummaryItem[];
    tasksDone: WeeklySummaryItem[];
    tasksStarted: WeeklySummaryItem[];
    datesChanged: WeeklySummaryItem[];
    late: WeeklyLateItem[];
  };
  report: {
    closedText: string;
    inProgressText: string;
    blockedText: string;
    authorName: string | null;
    updatedAt: string | null;
  } | null;
}

/* -------------------------------------------------------------------- liens */

export const linkCreateSchema = z.object({
  label: z.string().trim().min(1, 'Le libellé est obligatoire').max(200),
  url: z.union([externalUrl, z.literal('')]).default(''),
});

export const linkUpdateSchema = z.object({
  label: z.string().trim().min(1, 'Le libellé est obligatoire').max(200).optional(),
  url: z.union([externalUrl, z.literal('')]).optional(),
});

export type LinkCreateInput = z.infer<typeof linkCreateSchema>;
export type LinkUpdateInput = z.infer<typeof linkUpdateSchema>;

export interface Link {
  id: string;
  label: string;
  url: string;
  position: number;
}

/* ------------------------------------------------------------------- coffre */

export const DOCUMENT_TYPES = ['contract', 'quote', 'invoice', 'admin', 'other'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  contract: 'Contrat',
  quote: 'Devis',
  invoice: 'Facture',
  admin: 'Administratif',
  other: 'Autre',
};

/** 25 Mo, limite du brief. */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
] as const;

export type AllowedDocumentMimeType = (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number];

export const folderCreateSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est obligatoire').max(120),
  parentId: z.string().min(1).nullable().default(null),
});

export const folderUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  parentId: z.string().min(1).nullable().optional(),
});

export type FolderCreateInput = z.infer<typeof folderCreateSchema>;
export type FolderUpdateInput = z.infer<typeof folderUpdateSchema>;

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  position: number;
  /** Chemin lisible, « Contrats / 2026 ». */
  path: string;
  documentCount: number;
  subfolderCount: number;
}

export const documentMetadataSchema = z.object({
  title: z.string().trim().min(1, 'Le titre est obligatoire').max(300),
  type: z.enum(DOCUMENT_TYPES),
  parties: z.string().trim().max(500).default(''),
  docDate: isoDate.nullable().default(null),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  milestoneId: z.string().min(1).nullable().default(null),
  folderId: z.string().min(1).nullable().default(null),
});

export const documentUpdateSchema = z.object({
  title: z.string().trim().min(1, 'Le titre est obligatoire').max(300).optional(),
  type: z.enum(DOCUMENT_TYPES).optional(),
  parties: z.string().trim().max(500).optional(),
  docDate: isoDate.nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  milestoneId: z.string().min(1).nullable().optional(),
  folderId: z.string().min(1).nullable().optional(),
});

export type DocumentMetadataInput = z.infer<typeof documentMetadataSchema>;
export type DocumentUpdateInput = z.infer<typeof documentUpdateSchema>;

export interface DocumentSummary {
  id: string;
  title: string;
  type: DocumentType;
  parties: string;
  docDate: string | null;
  tags: string[];
  milestoneId: string | null;
  milestoneTitle: string | null;
  folderId: string | null;
  folderPath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  uploadedByName: string | null;
  createdAt: string;
}

/* ----------------------------------------------------------------- comptes */

export interface TeamMember {
  id: string;
  login: string;
  displayName: string;
}
