import { useEffect, useRef, useState } from 'react';
import { useArea } from '../context/AreaContext.jsx';
import { api } from '../lib/api.js';

const FIELD_OPTIONS_CACHE = { current: null };

export default function UploadPage() {
  const { areaId, selectedArea } = useArea();
  const fileInputRef = useRef(null);

  const [fields, setFields] = useState(FIELD_OPTIONS_CACHE.current || []);
  const [preview, setPreview] = useState(null); // { uploadToken, headers, sampleRows, suggestedMapping, mappingRemembered, filename }
  const [mapping, setMapping] = useState({});
  const [driverLabels, setDriverLabels] = useState({}); // header -> label text for driver columns
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);

  const isCompanyView = areaId === 'all';

  useEffect(() => {
    if (!FIELD_OPTIONS_CACHE.current) {
      api.get('/imports/fields').then((res) => {
        FIELD_OPTIONS_CACHE.current = res.fields;
        setFields(res.fields);
      });
    }
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId]);

  function loadHistory() {
    api.get(`/imports?areaId=${areaId}`).then(setHistory).catch(() => {});
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setSummary(null);
    setPreview(null);
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('areaId', areaId);
      formData.append('file', file);
      const res = await api.upload('/imports/preview', formData);
      setPreview(res);
      setMapping(res.suggestedMapping);
      const labels = {};
      for (const [header, m] of Object.entries(res.suggestedMapping)) {
        if (m.field === 'driver') labels[header] = m.driverLabel || header;
      }
      setDriverLabels(labels);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function updateMapping(header, field) {
    setMapping((prev) => ({
      ...prev,
      [header]: field === 'driver'
        ? { field: 'driver', driverKey: slugify(driverLabels[header] || header), driverLabel: driverLabels[header] || header }
        : { field },
    }));
  }

  function updateDriverLabel(header, label) {
    setDriverLabels((prev) => ({ ...prev, [header]: label }));
    setMapping((prev) => ({
      ...prev,
      [header]: { field: 'driver', driverKey: slugify(label || header), driverLabel: label || header },
    }));
  }

  async function deleteImport(importRow) {
    if (!confirm(`Remove the data from "${importRow.filename}" (uploaded ${importRow.uploaded_at})? This only removes rows that haven't since been corrected by a later upload.`)) return;
    try {
      const res = await api.del(`/imports/${importRow.id}`);
      loadHistory();
      alert(`Removed ${res.rowsRemoved} row${res.rowsRemoved === 1 ? '' : 's'}.`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmImport() {
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/imports/confirm', { uploadToken: preview.uploadToken, mapping });
      setSummary(res);
      setPreview(null);
      loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (isCompanyView) {
    return (
      <div className="card">
        <h2>Import monthly sales data</h2>
        <p className="text-muted">Select a single Area above (Central, North, or South) to import data into it. Imports are per-Area.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <h2>Import monthly sales data</h2>
        <p>Upload your Excel file for <strong>{selectedArea?.area_name || 'this Area'}</strong>. Importing a month replaces any data already recorded for that store that month — including entries made on the Daily Entry page — with the totals from this file, so it never double-counts.</p>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} disabled={busy} />
      </div>

      {error && <div className="banner error">{error}</div>}

      {summary && <ImportSummary summary={summary} onDismiss={() => setSummary(null)} />}

      {preview && (
        <MappingStep
          preview={preview}
          fields={fields}
          mapping={mapping}
          driverLabels={driverLabels}
          onFieldChange={updateMapping}
          onDriverLabelChange={updateDriverLabel}
          onCancel={() => setPreview(null)}
          onConfirm={confirmImport}
          busy={busy}
        />
      )}

      <div className="card">
        <h3>Recent imports</h3>
        {history.length === 0 ? (
          <p className="text-muted">No imports yet for this Area.</p>
        ) : (
          <>
            <p className="text-muted">Uploaded the wrong file? Remove it below — this deletes the rows it added, unless a later upload already corrected them.</p>
            <table>
              <thead>
                <tr><th>File</th><th>Uploaded</th><th>Added</th><th>Updated</th><th>Failed</th><th></th></tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{h.filename}</td>
                    <td>{h.uploaded_at}</td>
                    <td>{h.rows_added}</td>
                    <td>{h.rows_updated}</td>
                    <td>{h.rows_failed > 0 ? <span className="pill bad">{h.rows_failed}</span> : 0}</td>
                    <td><button className="btn danger" onClick={() => deleteImport(h)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

function MappingStep({ preview, fields, mapping, driverLabels, onFieldChange, onDriverLabelChange, onCancel, onConfirm, busy }) {
  return (
    <div className="card">
      <div className="flex-between">
        <h3>Map your columns</h3>
        {preview.mappingRemembered && <span className="pill good">Using remembered mapping</span>}
      </div>
      <p className="text-muted">{preview.filename} &middot; {preview.rowCount} rows detected &middot; showing first 5 as a preview.</p>

      <table className="mapping-table">
        <thead>
          <tr>
            <th>Your column</th>
            <th>Sample value</th>
            <th>Maps to</th>
            <th>Driver label</th>
          </tr>
        </thead>
        <tbody>
          {preview.headers.map((header) => {
            const current = mapping[header] || { field: 'ignore' };
            const sample = preview.sampleRows[0]?.[header];
            return (
              <tr key={header}>
                <td>{header}</td>
                <td className="text-muted">{formatSample(sample)}</td>
                <td>
                  <select value={current.field} onChange={(e) => onFieldChange(header, e.target.value)}>
                    {fields.filter((f) => !f.repeatable || f.field === 'driver' || f.field === 'ignore').map((f) => (
                      <option key={f.field} value={f.field}>{f.label}</option>
                    ))}
                  </select>
                </td>
                <td>
                  {current.field === 'driver' && (
                    <input
                      type="text"
                      value={driverLabels[header] ?? header}
                      onChange={(e) => onDriverLabelChange(header, e.target.value)}
                      placeholder="e.g. Footfall"
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
        <button className="btn" onClick={onConfirm} disabled={busy}>{busy ? 'Importing…' : 'Import data'}</button>
        <button className="btn secondary" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </div>
  );
}

function ImportSummary({ summary, onDismiss }) {
  return (
    <div className="card">
      <div className="flex-between">
        <h3>Import complete</h3>
        <button className="btn secondary" onClick={onDismiss}>Dismiss</button>
      </div>
      <div className="stat-grid">
        <div className="stat-tile">
          <div className="label">Rows added</div>
          <div className="value">{summary.rowsAdded}</div>
        </div>
        <div className="stat-tile">
          <div className="label">Rows updated</div>
          <div className="value">{summary.rowsUpdated}</div>
        </div>
        <div className="stat-tile">
          <div className="label">Rows failed</div>
          <div className="value">{summary.rowsFailed}</div>
        </div>
        <div className="stat-tile">
          <div className="label">New stores created</div>
          <div className="value">{summary.storesCreated}</div>
        </div>
      </div>
      {summary.failures.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4>Rows that failed to import</h4>
          <table>
            <thead><tr><th>Spreadsheet row</th><th>Reason</th></tr></thead>
            <tbody>
              {summary.failures.map((f, i) => (
                <tr key={i}><td>{f.row}</td><td>{f.reason}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatSample(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
}

function slugify(label) {
  return String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'driver';
}
