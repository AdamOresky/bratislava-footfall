import { useEffect, useRef, useState } from 'react';
import { Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import type { SensorSummary } from '../../Models/Models';
import { Utils } from '../../Services/Utils';
import { COLOR_ACTIVE, COLOR_INACTIVE } from './SensorMarkers';

/** "Starý Most" -> "stary most", so a search works with or without diacritics. */
function normalize(text: string): string {
    return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

// Hover (or keyboard focus) must last this long before the map moves, so a quick pass over the list does nothing
const FOCUS_DELAY_MS = 1000;

interface SensorListProps {
    sensors: SensorSummary[],
    onFocusChange: (sensorId: number | null) => void,   // sensor to zoom to and highlight on the map
}

/** Searchable list of all sensors, for people who don't know where a place is on the map. */
const SensorListComponent = ({ sensors, onFocusChange }: SensorListProps) => {
    const [search, setSearch] = useState('');

    const focusTimer = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(focusTimer.current), []);   // no late zoom after leaving the page

    const startFocus = (sensorId: number) => {
        window.clearTimeout(focusTimer.current);
        focusTimer.current = window.setTimeout(() => onFocusChange(sensorId), FOCUS_DELAY_MS);
    };

    const stopFocus = () => {
        window.clearTimeout(focusTimer.current);
        onFocusChange(null);
    };

    const query = normalize(search.trim());
    const visible = [...sensors]
        .sort((a, b) => a.sensor_id - b.sensor_id)
        .filter(s => normalize(s.name).includes(query));
    const maxCount = Math.max(1, ...sensors.map(s => s.avg_daily_count ?? 0));

    return (
        <>
            <div className="sensor-list__search">
                <Form.Control
                    type="search"
                    size="sm"
                    placeholder="Hľadať, napr. Starý most"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    aria-label="Hľadať sčítač podľa názvu"
                />
                <div className="sensor-list__count">
                    {visible.length === sensors.length ? `${sensors.length} sčítačov` : `${visible.length} z ${sensors.length}`}
                </div>
            </div>

            {visible.map(s => (
                <Link
                    key={s.sensor_id}
                    to={`/sensor/${s.sensor_id}`}
                    className="sensor-row"
                    onMouseEnter={() => startFocus(s.sensor_id)}
                    onMouseLeave={stopFocus}
                    onFocus={() => startFocus(s.sensor_id)}
                    onBlur={stopFocus}
                >
                    <div className="sensor-row__top">
                        <span className="sensor-row__name">{s.name}</span>
                        <span className="sensor-row__value">
                            {s.avg_daily_count === null ? '–' : Utils.formatNumber(s.avg_daily_count)}
                        </span>
                    </div>
                    {/* Bar = average per day relative to the busiest sensor */}
                    <div className="sensor-row__bar">
                        <span
                            style={{
                                width: s.avg_daily_count === null ? '100%' : `${(s.avg_daily_count / maxCount) * 100}%`,
                                background: s.avg_daily_count === null ? COLOR_INACTIVE : COLOR_ACTIVE,
                                opacity: s.avg_daily_count === null ? 0.25 : 1,
                            }}
                        />
                    </div>
                </Link>
            ))}

            {visible.length === 0 ? <div className="text-secondary small px-1">Žiadny sčítač s týmto názvom.</div> :
            <div className="sensor-list__note">Číslo = priemerný počet chodcov za deň, posledných 12 mesiacov</div>}
        </>
    );
};

export default SensorListComponent;
