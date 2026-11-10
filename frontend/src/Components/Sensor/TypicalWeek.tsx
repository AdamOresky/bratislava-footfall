import { Fragment, useEffect, useState } from 'react';
import { Alert, Nav, Spinner } from 'react-bootstrap';
import { FailureMessage, type TypicalWeek, type WeekHour } from '../../Models/Models';
import { SensorService } from '../../Services/SensorService';
import { Utils } from '../../Services/Utils';

const WEEKDAYS = ['Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota', 'Nedeľa'];
const WEEKDAYS_SHORT = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne'];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

// One hue, light -> dark: darker cell = more pedestrians
const RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
const COLOR_NO_DATA = '#f4f4f5';

function cellColor(value: number | undefined, max: number): string {
    if (value === undefined) {
        return COLOR_NO_DATA;
    }
    const step = Math.floor((value / Math.max(max, 1)) * RAMP.length);
    return RAMP[Math.min(step, RAMP.length - 1)];
}

const pad = (hour: number) => `${hour.toString().padStart(2, '0')}:00`;

// Which count the heatmap shows: both directions together, or one of them
type Direction = 'count' | 'count_to' | 'count_from';

interface TypicalWeekProps {
    sensorId: number,
    dirTo: string,
    dirFrom: string,
}

/** Heatmap: weekdays x hours, colored by the average count in that hour. */
const TypicalWeekComponent = ({ sensorId, dirTo, dirFrom }: TypicalWeekProps) => {
    const { getTypicalWeek } = SensorService();
    const [week, setWeek] = useState<TypicalWeek | null>(null);
    const [direction, setDirection] = useState<Direction>('count');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getTypicalWeek(sensorId).then(result => {
            if (result === null) {
                setError(FailureMessage.dataNotLoaded);
                return;
            }
            setWeek(result);
        });
    }, [sensorId]);

    if (error) {
        return <Alert variant="danger">{error}</Alert>;
    }
    if (week === null) {
        return <Spinner animation="border" />;
    }
    if (week.active_days === 0) {
        return <Alert variant="secondary">Sčítač za posledný rok nemeral.</Alert>;
    }

    // "weekday-hour" -> average count, for quick lookup while drawing the grid
    const byCell = new Map(week.hours.map(h => [`${h.weekday}-${h.hour}`, h[direction]]));
    const peak: WeekHour = week.hours.reduce((a, b) => (b[direction] > a[direction] ? b : a));
    const peakValue = peak[direction];
    const scaleMax = direction === 'count'
        ? peakValue
        : Math.max(...week.hours.map(h => Math.max(h.count_to, h.count_from)));

    const directions: { key: Direction, label: string }[] = [
        { key: 'count', label: 'Spolu' },
        { key: 'count_to', label: `➡️ ${dirTo}` },
        { key: 'count_from', label: `➡️ ${dirFrom}` },
    ];

    return (
        <>
            <p className="text-secondary small mb-2">
                Priemerný počet chodcov za hodinu, {Utils.formatDate(week.period_start)} – {Utils.formatDate(week.period_end)},
                z {Utils.formatNumber(week.active_days)} dní s meraním.
            </p>

            <Nav variant="pills" activeKey={direction} className="week-directions mb-3">
                {directions.map(({ key, label }) => (
                    <Nav.Item key={key}>
                        <Nav.Link
                            eventKey={key}
                            onMouseEnter={() => setDirection(key)}
                            onClick={() => setDirection(key)}
                        >
                            {label}
                        </Nav.Link>
                    </Nav.Item>
                ))}
            </Nav>

            <p className="mb-3">
                Najrušnejšie: <strong>{WEEKDAYS[peak.weekday].toLowerCase()} {pad(peak.hour)}</strong>,
                priemerne {Utils.formatNumber(peakValue)} chodcov za hodinu.
            </p>

            <div className="week-grid-scroll">
                <div className="week-grid">
                    <div />
                    {HOURS.map(hour => (
                        <div key={hour} className="week-grid__hour">{hour % 3 === 0 ? hour : ''}</div>
                    ))}

                    {WEEKDAYS_SHORT.map((label, weekday) => (
                        <Fragment key={weekday}>
                            <div className="week-grid__day">{label}</div>
                            {HOURS.map(hour => {
                                const value = byCell.get(`${weekday}-${hour}`);
                                return (
                                    <div
                                        key={hour}
                                        className="week-grid__cell"
                                        style={{ background: cellColor(value, scaleMax) }}
                                        title={`${WEEKDAYS[weekday]} ${pad(hour)}: ${
                                            value === undefined ? 'bez dát' : `priemerne ${Utils.formatNumber(value)} chodcov`
                                        }`}
                                    />
                                );
                            })}
                        </Fragment>
                    ))}
                </div>
            </div>

            <div className="week-legend small text-secondary">
                <span>0</span>
                {RAMP.map(color => <span key={color} className="week-legend__step" style={{ background: color }} />)}
                <span>{Utils.formatNumber(scaleMax)} chodcov / h</span>
            </div>
        </>
    );
};

export default TypicalWeekComponent;
