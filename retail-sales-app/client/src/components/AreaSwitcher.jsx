import { useArea } from '../context/AreaContext.jsx';

export default function AreaSwitcher() {
  const { areas, areaId, setAreaId, canSwitchArea, selectedArea } = useArea();

  if (!canSwitchArea) {
    // Area/Store Supervisors are locked to their assignment — show it as a
    // read-only label instead of a switcher they can't use.
    return <div className="dataset-toggle"><button className="active" disabled>{selectedArea?.area_name || '…'}</button></div>;
  }

  return (
    <div className="dataset-toggle">
      <button className={areaId === 'all' ? 'active' : ''} onClick={() => setAreaId('all')}>
        Company
      </button>
      {areas.map((a) => (
        <button key={a.id} className={String(areaId) === String(a.id) ? 'active' : ''} onClick={() => setAreaId(String(a.id))}>
          {a.area_name}
        </button>
      ))}
    </div>
  );
}
