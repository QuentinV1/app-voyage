import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Check,
  Cloud,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  FileJson,
  FileSpreadsheet,
  FileText,
  HardDriveDownload,
  LayoutGrid,
  LogOut,
  Share2,
  Smartphone,
  Upload,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { listShareableAppUsers, type WhitelistEntry } from '../lib/accessControl';
import { normalizeEmails, updateTrip } from '../lib/db';
import {
  buildWanderlogText,
  exportTripCsv,
  exportTripExcel,
  exportWanderlogHtml,
  exportWanderlogJson,
  exportWanderlogTextFile,
} from '../lib/export';
import { loadTripSnapshot, saveTripSnapshot } from '../lib/offline';
import { useTripCtx } from '../lib/tripContext';
import { Button, Card, Field, Sheet, inputClass } from '../components/ui';

export default function More() {
  const { trip, places, days, journal, memberProfiles, dayIndex, isOnline } = useTripCtx();
  const { user, email, logout, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const [newMember, setNewMember] = useState('');
  const [start, setStart] = useState(trip.startDate);
  const [end, setEnd] = useState(trip.endDate);
  const [shareCopied, setShareCopied] = useState(false);
  const [offlineSavedAt, setOfflineSavedAt] = useState<number | null>(() => loadTripSnapshot(trip.id)?.savedAt ?? null);
  const [showOtherApps, setShowOtherApps] = useState(false);
  const [showWanderlogExport, setShowWanderlogExport] = useState(false);
  const [wanderlogCopied, setWanderlogCopied] = useState(false);
  const [appWhitelist, setAppWhitelist] = useState<WhitelistEntry[]>([]);

  useEffect(() => {
    if (!email) return;
    listShareableAppUsers(db, 'app-voyage').then(setAppWhitelist).catch(() => {});
  }, [email]);

  useEffect(() => {
    if (!showOtherApps) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowOtherApps(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showOtherApps]);

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

  const wanderlogText = showWanderlogExport ? buildWanderlogText(trip, places, days, dayIndex) : '';

  const copyWanderlogText = async () => {
    try {
      await navigator.clipboard.writeText(wanderlogText);
      setWanderlogCopied(true);
      setTimeout(() => setWanderlogCopied(false), 2500);
    } catch {
      prompt('Copie ce texte pour Wanderlog :', wanderlogText);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <Users className="h-4 w-4 shrink-0 text-brand" />
            Voyageurs & Partage ({trip.memberEmails.length})
          </h2>
          <Button variant="secondary" className="shrink-0 px-3 py-1.5 text-xs" onClick={shareTripLink}>
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

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className={inputClass}
            type="email"
            placeholder="email@exemple.com"
            value={newMember}
            onChange={(e) => setNewMember(e.target.value)}
          />
          <Button className="shrink-0" onClick={addMember}>
            Ajouter
          </Button>
        </div>
        {appWhitelist.filter((u) => !trip.memberEmails.includes(u.email)).length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Membres autorisés sur l&apos;app (ajout en 1 clic)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {appWhitelist
                .filter((u) => !trip.memberEmails.includes(u.email))
                .map((u) => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => updateTrip(trip.id, { memberEmails: [...trip.memberEmails, u.email] })}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                    title={u.email}
                  >
                    <span>+ {u.displayName || u.email}</span>
                  </button>
                ))}
            </div>
          </div>
        )}
        <p className="text-xs text-slate-500">
          Chaque membre ajouté voit et modifie le planning, les idées et le carnet en temps réel avec son compte (Google ou e-mail).
        </p>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold">
            {isOnline ? <Wifi className="h-4 w-4 shrink-0 text-emerald-600" /> : <WifiOff className="h-4 w-4 shrink-0 text-amber-600" />}
            Mode hors-ligne terrain
          </h2>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            {isOnline ? 'En ligne' : 'Hors-ligne'}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Le cache local Firestore et le snapshot terrain conservent ton planning, tes adresses, tes coordonnées GPS et ton carnet sans connexion.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          onClick={() => setShowWanderlogExport(true)}
        >
          <Upload className="h-4 w-4 text-rose-500" />
          Exporter vers Wanderlog (texte, HTML, JSON)
        </button>
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
          className="flex w-full items-center gap-3 p-4 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
          onClick={openAuthModal}
        >
          <Cloud className="h-4 w-4 shrink-0 text-brand" />
          <span className="min-w-0 flex-1 truncate">
            {user ? `Compte Cloud (${email})` : 'Se connecter au Cloud & synchroniser'}
          </span>
        </button>
        <button
          className="flex w-full items-center gap-3 p-4 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
          onClick={() => setShowOtherApps(true)}
        >
          <LayoutGrid className="h-4 w-4 text-brand" />
          Mes autres applications
        </button>
        {user && (
          <button
            className="flex w-full items-center gap-3 p-4 text-left text-sm font-medium text-red-600 hover:bg-red-50/60"
            onClick={() => {
              if (confirm('Se déconnecter du compte Cloud ?')) logout();
            }}
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </button>
        )}
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

      {showOtherApps && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-xs sm:p-4"
          onClick={() => setShowOtherApps(false)}
        >
          <div
            className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <LayoutGrid className="h-4 w-4 text-brand" />
                Mes autres applications
              </h2>
              <button
                type="button"
                onClick={() => setShowOtherApps(false)}
                aria-label="Fermer"
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-5">
              <p className="text-xs text-slate-500">
                Retrouvez toutes les autres applications hébergées sur GitHub Pages.
              </p>
              <div className="grid gap-2">
                {[
                  { name: "L'Affinoir", desc: "Charcuterie, salaisons & cave d'affinage", url: 'https://quentinv1.github.io/app-charcuterie/' },
                  { name: 'Pêche France', desc: 'Réglementation, mailles, cartes & carnet de prises', url: 'https://quentinv1.github.io/app-peche/' },
                  { name: 'Budget Prévisionnel', desc: 'Budget du foyer, provisions & projections', url: 'https://quentinv1.github.io/budget-previsionnel/' },
                  { name: 'Cave à vin', desc: 'Stock de bouteilles, apogée & dégustations', url: 'https://quentinv1.github.io/cave-a-vin/' },
                  { name: 'Checklist Valise', desc: 'Bagages, calculateur de poids & règles IATA', url: 'https://quentinv1.github.io/checklist-valise/' },
                  { name: 'Livre de recettes', desc: 'Recettes, planning semaine & liste de courses', url: 'https://quentinv1.github.io/livre-recettes/' },
                  { name: 'Suivi Chasse', desc: 'Carnet de sorties, carte & album trophées', url: 'https://quentinv1.github.io/suivi-chasse/' },
                  { name: 'Travaux Maison', desc: 'Plan 2D/3D, courses, tâches & entretien', url: 'https://quentinv1.github.io/travaux-maison/' },
                ].map((app) => (
                  <a
                    key={app.url}
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 transition hover:border-slate-300 hover:bg-slate-100"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800">{app.name}</div>
                      <div className="truncate text-xs text-slate-500">{app.desc}</div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand">
                      Ouvrir <ExternalLink className="h-3.5 w-3.5" />
                    </span>
                  </a>
                ))}
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-100 px-5 py-3">
              <Button variant="secondary" onClick={() => setShowOtherApps(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      <Sheet
        open={showWanderlogExport}
        onClose={() => setShowWanderlogExport(false)}
        title="Exporter vers Wanderlog"
      >
        <div className="space-y-4">
          <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">Comment importer dans Wanderlog :</p>
            <p>
              Wanderlog ne propose pas d'import direct de fichier CSV/JSON, mais tu peux envoyer ton voyage facilement :
            </p>
            <ul className="list-disc space-y-1 pl-4">
              <li>
                <b>Option 1 (rapide) :</b> copie le texte ci-dessous et colle-le dans Wanderlog via{' '}
                <i>« Import from anywhere »</i> ou l'assistant IA.
              </li>
              <li>
                <b>Option 2 (extension Chrome Wanderlog) :</b> télécharge la <b>page HTML</b>, ouvre-la dans Chrome, puis
                clique sur l'extension Wanderlog pour ajouter les lieux.
              </li>
            </ul>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                Aperçu ({places.length} lieu{places.length > 1 ? 'x' : ''})
              </span>
              <Button
                variant="primary"
                className="px-3 py-1.5 text-xs"
                disabled={places.length === 0}
                onClick={copyWanderlogText}
              >
                {wanderlogCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {wanderlogCopied ? 'Copié !' : 'Copier le texte'}
              </Button>
            </div>
            <textarea
              readOnly
              rows={8}
              value={wanderlogText}
              className={`${inputClass} font-mono text-xs leading-relaxed text-slate-700`}
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button
              variant="secondary"
              className="text-xs"
              disabled={places.length === 0}
              onClick={() => exportWanderlogTextFile(trip, places, days, dayIndex)}
            >
              <FileText className="h-4 w-4 text-slate-600" />
              Fichier .txt
            </Button>
            <Button
              variant="secondary"
              className="text-xs"
              disabled={places.length === 0}
              onClick={() => exportWanderlogHtml(trip, places, days, dayIndex)}
            >
              <FileCode2 className="h-4 w-4 text-rose-500" />
              Page HTML
            </Button>
            <Button
              variant="secondary"
              className="text-xs"
              disabled={places.length === 0}
              onClick={() => exportWanderlogJson(trip, places, days, dayIndex)}
            >
              <FileJson className="h-4 w-4 text-sky-600" />
              JSON structuré
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
