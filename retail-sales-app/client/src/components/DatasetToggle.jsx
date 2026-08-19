import { useDataset } from '../context/DatasetContext.jsx';

export default function DatasetToggle() {
  const { dataset, setDataset } = useDataset();
  return (
    <div className="dataset-toggle">
      <button className={dataset === 'company' ? 'active' : ''} onClick={() => setDataset('company')}>
        Company Owned Stores
      </button>
      <button className={dataset === 'franchise' ? 'active' : ''} onClick={() => setDataset('franchise')}>
        Franchise Stores
      </button>
    </div>
  );
}
