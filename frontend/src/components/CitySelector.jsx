export default function CitySelector({ cities, selected, onChange }) {
  function toggle(value) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  if (cities.length === 0) {
    return <p className="muted">Chargement…</p>;
  }

  return (
    <div className="city-selector">
      {cities.map((city) => (
        <label key={city.value} className="checkbox-row">
          <input type="checkbox" checked={selected.includes(city.value)} onChange={() => toggle(city.value)} />
          {city.label}
        </label>
      ))}
    </div>
  );
}
