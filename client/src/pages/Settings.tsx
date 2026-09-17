import { Monitor, Moon, Settings as SettingsIcon, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuth } from '../lib/auth';
import { useTheme, type ThemePreference } from '../lib/theme';

const CHOICES: { value: ThemePreference; label: string; icon: LucideIcon; hint: string }[] = [
  { value: 'light', label: 'Clair', icon: Sun, hint: 'Fond gris clair, cartes blanches.' },
  { value: 'dark', label: 'Sombre', icon: Moon, hint: 'Fond sombre, mêmes proportions.' },
  { value: 'system', label: 'Système', icon: Monitor, hint: 'Suit le réglage de la machine.' },
];

export function Settings(): JSX.Element {
  const { preference, setPreference } = useTheme();
  const { user, signOut } = useAuth();

  return (
    <>
      <PageHeader title="Paramètres" />

      <Card className="mb-6">
        <CardHeader icon={SettingsIcon} title="Apparence" />
        <div className="border-t border-card-line px-8 py-6">
          <p className="mb-5 text-body text-muted">
            Le choix est mémorisé dans ce navigateur, pour ce compte et cette machine.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {CHOICES.map((choice) => {
              const Icon = choice.icon;
              const active = preference === choice.value;
              return (
                <button
                  key={choice.value}
                  type="button"
                  onClick={() => setPreference(choice.value)}
                  aria-pressed={active}
                  className={[
                    'flex flex-col items-start gap-2 rounded-item border p-5 text-left transition-colors',
                    active ? 'border-brand bg-brand/10' : 'border-card-line bg-card hover:bg-hover',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-3 text-body font-medium text-ink">
                    <Icon size={20} strokeWidth={1.75} />
                    {choice.label}
                  </span>
                  <span className="text-sub text-muted">{choice.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader icon={SettingsIcon} title="Compte" />
        <div className="flex flex-wrap items-center gap-6 border-t border-card-line px-8 py-6">
          <div>
            <p className="text-body text-ink">{user?.displayName}</p>
            <p className="text-sub text-muted">login : {user?.login}</p>
          </div>
          <Button className="ml-auto" onClick={() => void signOut()}>
            Se déconnecter
          </Button>
        </div>
        <p className="border-t border-card-line px-8 py-6 text-sub text-muted">
          Les mots de passe se changent en ligne de commande, avec <code>npm run seed:users</code> : relancer le
          script sur un login existant remplace le mot de passe et révoque les sessions ouvertes.
        </p>
      </Card>
    </>
  );
}
