import { CircleHelp } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';

const RULES = [
  {
    title: 'Un jalon ne se ferme pas tout seul',
    body: "Le passage d'un jalon à « Fermé » est refusé tant qu'un critère d'acceptation n'est pas coché. Le serveur renvoie la liste de ce qui manque, la fiche l'affiche.",
  },
  {
    title: 'Une tâche appartient toujours à un jalon',
    body: 'Le champ jalon est obligatoire à la création. Le kanban se filtre par jalon et par assigné, et le déplacement entre colonnes change le statut.',
  },
  {
    title: 'Le journal est écrit par le serveur',
    body: "Chaque mutation laisse une trace horodatée avec son auteur. Le journal est en lecture seule : rien ne s'y écrit à la main, rien ne s'y efface.",
  },
  {
    title: 'La synthèse hebdo est calculée, le compte rendu est écrit',
    body: "Le haut de la page Hebdo est déduit du journal de la semaine. Les trois champs du bas (fermé, en cours, bloqué) restent à votre main.",
  },
  {
    title: 'Le coffre ne fait pas confiance aux extensions',
    body: "Le type d'un fichier est vérifié sur son contenu. Il est stocké hors du dépôt sous un nom généré, et ne se télécharge qu'avec une session valide.",
  },
  {
    title: 'Sauvegarde',
    body: 'npm run backup produit une archive horodatée contenant la base et les documents. La commande de restauration est dans le README.',
  },
];

export function Help(): JSX.Element {
  return (
    <>
      <PageHeader title="Aide" />

      <Card>
        <CardHeader
          icon={CircleHelp}
          title="Ce qu'il faut savoir"
          meta={<span className="text-sub text-muted">quorex-internal, version 0.1</span>}
        />
        <ul className="border-t border-card-line">
          {RULES.map((rule) => (
            <li key={rule.title} className="border-b border-card-line px-8 py-6 last:border-b-0">
              <h2 className="text-body font-medium text-ink">{rule.title}</h2>
              <p className="mt-2 text-sub text-muted">{rule.body}</p>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
