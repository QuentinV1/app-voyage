import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  HardDriveDownload,
  LogOut,
  Share2,
  Smartphone,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { normalizeEmails, updateTrip } from '../lib/db';
import { exportTripCsv, exportTripExcel } from '../lib/export';
import { loadTripSnapshot, saveTripSnapshot } from '../lib/offline';
import { useTripCtx } from '../lib/tripContext';
import { Button, Card, Field, inputClass } from '../components/ui';

export default function More() {
  const { trip, places, days, journal, memberProfiles, dayIndex, isOnline } = useTripCtx();
  const { email, logout } = useAuth();
  const navigate = useNavigate();
  const [newMember, setNewMember] = useState('');
  const [start, setStart] = useState(trip.startDate);
  const [end, setEnd] = useState(trip.endDate);
  const [shareCopied, setShareCopied] = useState(false);
  const [offlineSavedAt, setOfflineSavedAt] = useState<number | null>(() => loadTripSnapshot(trip.id)?.savedAt ?? null);

  const addMember = async () => {
    const emails = normalizeEmails(newMember.split(/[\s,;]+/));
    if (!emails.length) return;
    await updateTrip(trip.id, { memberEmails: [...trip.memberEmails, ...emails] });
    setNewMember('');
  };

  const removeMember = async (m: string) => {
    if (trip.memberEmails.length <= 1) {
      alert('Le voyage doit conserver au moins un membre.');
      return;
    }
    if (m === email && !confirm("Te retirer toi-même ? Tu perdras l'accès au voyage.")) return;
    await updateTrip(trip.id, { memberEmails: trip.memberEmails.filter((x) => x !== m) });
    if (m === email) navigate('/');
  };

  const shareTripLink = async () => {
    const url = window.location.origin;
    const text = `Rejoins notre voyage « ${trip.name} » sur l'app ! Connecte-toi avec ton e-mail autorisé : ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: trip.name, text, url });
        return;
      } catch {
        // Annulé ou indisponible -> fallback presse-papiers
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      prompt('Copie ce lien pour le partager :', url);
    }
  };

  const prepareOffline = () => {
    const savedAt = saveTripSnapshot(trip.id, { trip, places, days, journal });
    if (savedAt) setOfflineSavedAt(savedAt);
  };

  return (
    <div className="space-y-4 p-4">
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <Users className="h-4 w-4 text-brand" />
            Voyageurs & Partage ({trip.memberEmails.length})
          </h2>
          <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={shareTripLink}>
            {shareCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Share2 className="h-3.5 w-3.5" />}
            {shareCopied ? 'Lien copié' : 'Partager'}
          </Button>
        </div>

        <ul className="space-y-1.5">
          {trip.memberEmails.map((m) => {
            const prof = memberProfiles[m];
            const isSelf = m === email;
            const isCreator = m === trip.createdBy?.toLowerCase();
            return (
              <li key={m} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">
                    {prof?.displayName || m}
                    {isSelf && <span className="ml-1.5 text-xs font-normal text-brand">(toi)</span>}
                    {isCreator && <span className="ml-1.5 text-xs font-normal text-slate-400">· créateur</span>}
                  </p>
                  {prof?.displayName && <p className="truncate text-xs text-slate-500">{m}</p>}
                </div>
                <button
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  onClick={() => removeMember(m)}
                  aria-label={`Retirer ${m}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex gap-2">
          <input
            className={inputClass}
            type="email"
            placeholder="email@exemple.com"
            value={newMember}
            onChange={(e) => setNewMember(e.target.value)}
          />
          <Button onClick={addMember}>Ajouter</Button>
        </div>
        <p className="text-xs text-slate-500">
          Chaque membre ajouté voit et modifie le planning, les idées et le carnet en temps réel avec son compte (Google ou e-mail).
        </p>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            {isOnline ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-amber-600" />}
            Mode hors-ligne terrain
          </h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            {isOnline ? 'En ligne' : 'Hors-ligne'}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Le cache local Firestore et le snapshot terrain conservent ton planning, tes adresses, tes coordonnées GPS et ton carnet sans connexion.
        </p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {offlineSavedAt
              ? `Dernière sauvegarde : ${new Date(offlineSavedAt).toLocaleString('fr-FR')}`
              : 'Aucune sauvegarde manuelle'}
          </span>
          <Button variant="secondary" className="shrink-0 px-3 py-1.5 text-xs" onClick={prepareOffline}>
            <HardDriveDownload className="h-3.5 w-3.5" />
            Mettre à jour
          </Button>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Calendar className="h-4 w-4 text-brand" />
          Dates du voyage
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Départ">
            <input type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Retour">
            <input type="date" className={inputClass} value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        {(start !== trip.startDate || end !== trip.endDate) && (
          <Button
            className="w-full"
            disabled={!start || !end || end < start}
            onClick={() => updateTrip(trip.id, { startDate: start, endDate: end })}
          >
            Enregistrer les dates
          </Button>
        )}
      </Card>

      <Card className="divide-y divide-slate-100">
        <Link to="../import" className="flex items-center gap-3 p-4 text-sm font-medium text-slate-800 hover:bg-slate-50">
          <Download className="h-4 w-4 text-brand" />
          Importer un planning (Wanderlog, PDF, texte…)
        </Link>
        <button
          className="flex w-full items-center gap-3 p-4 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
          onClick={() => exportTripExcel(trip, places, days, journal, dayIndex)}
        >
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          Exporter en Excel (.xlsx — Planning, Idées & Carnet)
        </button>
        <button
          className="flex w-full items-center gap-3 p-4 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
          onClick={() => exportTripCsv(trip, places, days, dayIndex)}
        >
          <FileText className="h-4 w-4 text-sky-600" />
          Exporter le planning en CSV
        </button>
        <button
          className="flex w-full items-center gap-3 p-4 text-left text-sm font-medium text-red-600 hover:bg-red-50/60"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </button>
      </Card>

      <Card className="space-y-1.5 p-4 text-sm text-slate-600">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800">
          <Smartphone className="h-4 w-4 text-brand" />
          Installer l'app sur le téléphone
        </h2>
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
