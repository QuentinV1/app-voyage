import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { createTrip, useTrips } from '../lib/db';
import { daysUntil, formatShort } from '../lib/dates';
import { Button, Card, Empty, Field, Sheet, Spinner, inputClass } from '../components/ui';

export default function TripList() {
  const { email, user, logout } = useAuth();
  const { data: trips, loading, error } = useTrips(email);
  const [open, setOpen] = useState(false);

  return (
    <div className="pt-safe mx-auto max-w-lg p-4">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Bonjour {user?.displayName?.split(' ')[0]} 👋</p>
          <h1 className="text-2xl font-bold">Nos voyages</h1>
        </div>
        <button onClick={logout} className="text-sm text-slate-500">
          Déconnexion
        </button>
      </header>

      {loading && <Spinner />}
      {error && <p className="text-red-600">Erreur : {error.message}</p>}

      {!loading && trips.length === 0 && (
        <Empty icon="✈️" title="Aucun voyage pour l'instant">
          <p className="text-sm">Crée le voyage puis ajoute l'e-mail de tes proches pour le partager.</p>
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
                  <span>👥 {t.memberEmails.length} voyageurs</span>
                  <span>{d > 0 ? `J-${d}` : d === 0 ? "C'est aujourd'hui ! 🎉" : 'Terminé'}</span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      <Button className="mt-4 w-full" onClick={() => setOpen(true)}>
        + Nouveau voyage
      </Button>

      <NewTripSheet open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function NewTripSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { email } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('Japon 🇯🇵');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [members, setMembers] = useState('');
  const [busy, setBusy] = useState(false);

  const valid = name.trim() && start && end && end >= start;

  const submit = async () => {
    if (!email || !valid) return;
    setBusy(true);
    try {
      const id = await createTrip({
        name: name.trim(),
        startDate: start,
        endDate: end,
        memberEmails: [email, ...members.split(/[\s,;]+/)],
        createdBy: email,
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
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Départ">
            <input type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Retour">
            <input type="date" className={inputClass} value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <Field label="E-mails Google des voyageurs (séparés par des virgules)">
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
