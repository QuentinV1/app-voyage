import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { addPlace } from '../lib/db';
import { IDEA_COLOR } from '../lib/categories';
import { fromGooglePlace } from '../lib/places';
import { useTripCtx } from '../lib/tripContext';
import PlaceItem from '../components/PlaceItem';
import PlaceSearch from '../components/PlaceSearch';
import { Button, Empty, Sheet } from '../components/ui';

/** Lieux « à placer » : sans jour ou hors des dates du voyage */
export default function Ideas() {
  const { trip, places, dayIndex } = useTripCtx();
  const { email } = useAuth();
  const [adding, setAdding] = useState(false);
  const list = places.filter((p) => dayIndex(p.date) < 0);

  return (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="text-xl font-bold">💡 Idées à placer</h2>
        <p className="text-sm text-slate-500">Touchez un lieu pour l'attribuer à un jour.</p>
      </div>
      {list.length === 0 && <Empty icon="💡" title="Aucune idée en attente" />}
      <div className="space-y-2">
        {list.map((p, i) => (
          <PlaceItem key={p.id} place={p} index={i} list={list} color={IDEA_COLOR} />
        ))}
      </div>
      <Button className="w-full" onClick={() => setAdding(true)}>
        + Ajouter une idée
      </Button>
      <Sheet open={adding} onClose={() => setAdding(false)} title="Nouvelle idée">
        <PlaceSearch
          autoFocus
          onPick={async (gp) => {
            await addPlace(trip.id, fromGooglePlace(gp, { date: null, addedBy: email ?? undefined }), places);
            setAdding(false);
          }}
        />
      </Sheet>
    </div>
  );
}
