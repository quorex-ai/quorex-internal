/** Libelles lisibles des champs et des valeurs du journal, partages par le journal et l'hebdo. */
export const FIELD_LABELS: Record<string, string> = {
  created: 'créé',
  deleted: 'supprimé',
  title: 'titre',
  description: 'description',
  target_date: 'date cible',
  status: 'statut',
  label: 'libellé',
  checked: 'coché',
  milestone_id: 'jalon',
  assignee_id: 'assigné',
  external_url: 'lien externe',
};

export const VALUE_LABELS: Record<string, string> = {
  upcoming: 'à venir',
  in_progress: 'en cours',
  closed: 'fermé',
  todo: 'à faire',
  review: 'en revue',
  done: 'terminé',
  '0': 'non',
  '1': 'oui',
};

export function readableValue(value: string | null): string {
  if (value === null || value === '') return '—';
  return VALUE_LABELS[value] ?? value;
}

/** « statut : à venir → en cours », a partir des deux valeurs brutes. */
export function readableChange(oldValue: string | null, newValue: string | null): string {
  return `${readableValue(oldValue)} → ${readableValue(newValue)}`;
}
