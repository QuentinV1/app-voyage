import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plane, Plus, Users, WifiOff } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { createTrip, useTrips } from '../lib/db';
import { daysUntil, formatShort } from '../lib/dates';
import { useOnlineStatus } from '../lib/offline';
import { CloudAuthHeaderButton } from '../components/CloudAuthModal';
import { Button, Card, Empty, Field, Sheet, Spinner, inputClass } from '../components/ui';

export default function TripList() {
  const { email, user } = useAuth();
  const { data: trips, loading, error } = useTrips(email);
  const isOnline = useOnlineStatus();
  const [open, setOpen] = useState(false);

  return (
    <div className="pt-safe mx-auto max-w-lg p-4">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm text-slate-500">
            {user ? `Bonjour ${user.displayName?.split(' ')[0] || email?.split('@')[0]}` : 'Mode local hors-compte'}
          </p>
          <h1 className="text-2xl font-bold">Nos voyages</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!isOnline && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
              <WifiOff className="h-3.5 w-3.5" />
              Hors-ligne
            </span>
          )}
          <CloudAuthHeaderButton variant="light" />
        </div>
      </header>

      {loading && <Spinner />}
      {error && <p className="mb-3 text-xs font-medium text-red-600">{error.message}</p>}

      {!loading && trips.length === 0 && (
        <Empty icon="" title="Aucun voyage pour l'instant">
          <Plane className="mx-auto mb-1 h-8 w-8 text-slate-300" />
          <p className="text-sm">Crée un voyage en local ou connecte-toi au Cloud pour synchroniser avec tes proches.</p>
        </Empty>
      )}

      <div className="space-y-3">
        {trips.map((t) => {
          const d = daysUntil(t.startDate);
          return (
            <Link key={t.id} to={`/trip/${t.id}`}>
              <Card className="mb-3 overflow-hidden">
                <div className="bg-gradient-to-r from-rose-600 to-pink-500 p-4 text-white">
                  <h2 className="text-xl font-semibold">{t.name}</h2>
                  <p className="text-sm opacity-90">
                    {formatShort(t.startDate)} → {formatShort(t.endDate)}
                  </p>
                </div>
                <div className="flex justify-between p-4 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-slate-400" />
                    {t.memberEmails.length} voyageur{t.memberEmails.length > 1 ? 's' : ''}
                  </span>
                  <span>{d > 0 ? `J-${d}` : d === 0 ? "C'est aujourd'hui !" : 'Terminé'}</span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      <Button className="mt-4 w-full" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Nouveau voyage
      </Button>

      <NewTripSheet open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function NewTripSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { email } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [members, setMembers] = useState('');
  const [busy, setBusy] = useState(false);

  const valid = name.trim() && start && end && end >= start;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const activeEmail = email || 'local@offline';
      const id = await createTrip({
        name: name.trim(),
        startDate: start,
        endDate: end,
        memberEmails: [activeEmail, ...members.split(/[\s,;]+/)],
        createdBy: activeEmail,
      });
      onClose();
      navigate(`/trip/${id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Nouveau voyage">
      <div className="space-y-4">
        <Field label="Nom">
          <input className={inputClass} placeholder="ex : Italie, Japon, Road trip…" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Départ">
            <input type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Retour">
            <input type="date" className={inputClass} value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <Field label="E-mails des voyageurs (séparés par des virgules)">
          <textarea
            className={inputClass}
            rows={3}
            placeholder="marie@gmail.com, paul@gmail.com"
            value={members}
            onChange={(e) => setMembers(e.target.value)}
          />
        </Field>
        <Button className="w-full" disabled={!valid || busy} onClick={submit}>
          {busy ? 'Création…' : 'Créer le voyage'}
        </Button>
      </div>
    </Sheet>
  );
}
