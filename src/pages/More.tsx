import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { normalizeEmails, updateTrip } from '../lib/db';
import { CATEGORIES } from '../lib/categories';
import { useTripCtx } from '../lib/tripContext';
import { Button, Card, Field, inputClass } from '../components/ui';

export default function More() {
  const { trip, places, days, dayIndex } = useTripCtx();
  const { email, logout } = useAuth();
  const navigate = useNavigate();
  const [newMember, setNewMember] = useState('');
  const [start, setStart] = useState(trip.startDate);
  const [end, setEnd] = useState(trip.endDate);

  const addMember = async () => {
    const emails = normalizeEmails(newMember.split(/[\s,;]+/));
    if (!emails.length) return;
    await updateTrip(trip.id, { memberEmails: [...trip.memberEmails, ...emails] });
    setNewMember('');
  };

  const removeMember = async (m: string) => {
    if (m === email && !confirm('Te retirer toi-même ? Tu perdras l\'accès au voyage.')) return;
    await updateTrip(trip.id, { memberEmails: trip.memberEmails.filter((x) => x !== m) });
    if (m === email) navigate('/');
  };

  const exportCsv = () => {
    const rows = [['Jour', 'Date', 'Ville du jour', 'Heure', 'Lieu', 'Catégorie', 'Adresse', 'Notes', 'Lien Google Maps']];
    const sorted = [...places].sort(
      (a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.order - b.order,
    );
    for (const p of sorted) {
      const i = dayIndex(p.date);
      rows.push([
        i >= 0 ? String(i + 1) : 'Idée',
        p.date ?? '',
        p.date ? days[p.date]?.city ?? '' : '',
        p.time ?? '',
        p.name,
        CATEGORIES[p.category]?.label ?? '',
        p.address ?? '',
        p.notes ?? '',
        p.googleMapsUri ?? '',
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }); // BOM => accents OK dans Excel
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${trip.name.replace(/[^\w-]+/g, '_')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4 p-4">
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">👥 Voyageurs ({trip.memberEmails.length})</h2>
        <ul className="space-y-1">
          {trip.memberEmails.map((m) => (
            <li key={m} className="flex items-center justify-between text-sm">
              <span className="truncate">
                {m} {m === email && <span className="text-slate-400">(toi)</span>}
              </span>
              <button className="px-2 text-slate-400" onClick={() => removeMember(m)} aria-label={`Retirer ${m}`}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            className={inputClass}
            type="email"
            placeholder="email@gmail.com"
            value={newMember}
            onChange={(e) => setNewMember(e.target.value)}
          />
          <Button onClick={addMember}>Ajouter</Button>
        </div>
        <p className="text-xs text-slate-500">
          Partage ensuite le lien de l'app : la personne se connecte avec ce compte Google et voit le voyage.
        </p>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">📅 Dates du voyage</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Départ">
            <input type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Retour">
            <input type="date" className={inputClass} value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        {(start !== trip.startDate || end !== trip.endDate) && (
          <Button className="w-full" disabled={!start || !end || end < start} onClick={() => updateTrip(trip.id, { startDate: start, endDate: end })}>
            Enregistrer les dates
          </Button>
        )}
      </Card>

      <Card className="divide-y divide-slate-100">
        <Link to="../import" className="block p-4">
          📥 Importer un planning (Wanderlog, PDF, texte…)
        </Link>
        <button className="block w-full p-4 text-left" onClick={exportCsv}>
          📤 Exporter en Excel (CSV)
        </button>
        <button className="block w-full p-4 text-left text-red-600" onClick={logout}>
          🚪 Se déconnecter
        </button>
      </Card>

      <Card className="space-y-1 p-4 text-sm text-slate-600">
        <h2 className="font-semibold text-slate-800">📲 Installer l'app sur le téléphone</h2>
        <p>
          <b>iPhone</b> : ouvrir le lien dans Safari → bouton Partager → « Sur l'écran d'accueil ».
        </p>
        <p>
          <b>Android</b> : ouvrir le lien dans Chrome → menu ⋮ → « Installer l'application ».
        </p>
      </Card>
    </div>
  );
}
