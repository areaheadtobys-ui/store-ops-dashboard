import { useWidgets, WIDGET_LABELS } from '../context/WidgetsContext.jsx';

const ORDER = ['totals', 'by_store', 'by_month', 'trend', 'yoy_sales', 'yoy_drivers', 'performance'];

export default function SettingsPage() {
  const { widgets, loaded, setVisible } = useWidgets();

  return (
    <div className="card">
      <h2>Dashboard sections</h2>
      <p className="text-muted">Show or hide sections and tabs for this dataset. Turn off anything you don't need this month — you can always turn it back on.</p>
      {!loaded ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <table>
          <tbody>
            {ORDER.map((key) => {
              const w = widgets.find((x) => x.widget_key === key);
              const checked = w ? !!w.visible : true;
              return (
                <tr key={key}>
                  <td style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setVisible(key, e.target.checked)}
                      style={{ width: 18, height: 18 }}
                    />
                  </td>
                  <td>{WIDGET_LABELS[key]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
