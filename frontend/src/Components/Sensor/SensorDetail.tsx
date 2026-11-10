import { useEffect, useState } from 'react';
import { Alert, Card, Col, Container, Row, Spinner, Tab, Tabs } from 'react-bootstrap';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { FailureMessage, type DayCounts, type Sensor } from '../../Models/Models';
import { SensorService } from '../../Services/SensorService';
import { Utils } from '../../Services/Utils';
import HourlyChartComponent from './HourlyChart';
import DayPickerComponent from './DayPicker';
import TypicalWeekComponent from './TypicalWeek';
import MonthlyStatsComponent from './MonthlyStats';

const SensorDetailComponent = () => {
    const { sensorId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { getSensor, getDayCounts } = SensorService();

    const [sensor, setSensor] = useState<Sensor | null>(null);
    const [dayCounts, setDayCounts] = useState<DayCounts | null>(null);
    const [error, setError] = useState<string | null>(null);

    const id = Number(sensorId);
    const date = searchParams.get("date");
    const view = searchParams.get("view") ?? "day";   // tab: day | week | months

    // Change one URL parameter and keep the others (?date= and ?view= live side by side)
    const setParam = (key: string, value: string, replace = false) => {
        setSearchParams(params => {
            params.set(key, value);
            return params;
        }, { replace });
    };

    // Sensor info; without ?date= show the day before the last one
    // (the last day is usually incomplete, the export ends in the middle of it)
    useEffect(() => {
        getSensor(id).then(result => {
            if (result === null) {
                setError(FailureMessage.dataNotLoaded);
                return;
            }
            setSensor(result);
            Utils.setDocumentTitle(result.name);

            if (!date) {
                setParam("date", Utils.defaultDay(result.first_seen, result.last_seen), true);
            }
        });
    }, [id]);

    // Counts for the selected day
    useEffect(() => {
        if (!date) {
            return;
        }
        setDayCounts(null);
        getDayCounts(id, date).then(result => {
            if (result === null) {
                setError(FailureMessage.dataNotLoaded);
                return;
            }
            setDayCounts(result);
        });
    }, [id, date]);

    if (error) {
        return (
            <Container className="py-4">
                <Alert variant="danger">{error}</Alert>
                <Link to="/">← Späť na mapu</Link>
            </Container>
        );
    }

    if (sensor === null) {
        return <Container className="py-4"><Spinner animation="border" /></Container>;
    }

    const dirFrom = sensor.dir_from || "druhý smer";

    const dayView = (
        <>
            {date && (
                <div className="mb-4">
                    <div className="form-label">Deň</div>
                    <DayPickerComponent
                        value={date}
                        min={Utils.toLocalDate(sensor.first_seen)}
                        max={Utils.toLocalDate(sensor.last_seen)}
                        onChange={newDate => setParam("date", newDate)}
                    />
                </div>
            )}

            {dayCounts === null && <Spinner animation="border" />}

            {dayCounts !== null && !dayCounts.was_active && (
                <Alert variant="secondary">
                    Sčítač v tento deň nemeral (žiadne záznamy alebo samé nuly).
                </Alert>
            )}

            {dayCounts !== null && dayCounts.was_active && dayCounts.counts_total && (
                <>
                    {dayCounts.missing_hours.length > 0 && (
                        <Alert variant="warning">
                            Chýbajú dáta pre {dayCounts.missing_hours.length} z {dayCounts.hours_in_day} hodín.
                        </Alert>
                    )}

                    {/* Three in a row also on a phone (compact cards, see .total-card) */}
                    <Row className="mb-4 g-2 g-sm-3">
                        <Col xs={4}><TotalCard label={`→ ${sensor.dir_to}`} value={dayCounts.counts_total.count_to} /></Col>
                        <Col xs={4}><TotalCard label={`→ ${dirFrom}`} value={dayCounts.counts_total.count_from} /></Col>
                        <Col xs={4}><TotalCard label="Spolu" value={dayCounts.counts_total.count} /></Col>
                    </Row>

                    <HourlyChartComponent
                        counts={dayCounts.counts_by_hour}
                        missingHours={dayCounts.missing_hours}
                        dirTo={sensor.dir_to}
                        dirFrom={dirFrom}
                    />
                </>
            )}
        </>
    );

    return (
        <Container className="py-4">
            <Link to="/">← Späť na mapu</Link>
            <h1 className="h3 mt-3 mb-1">{sensor.name}</h1>
            <p className="text-secondary">
                Dáta od {Utils.formatDate(sensor.first_seen)} do {Utils.formatDate(sensor.last_seen)}
            </p>

            {/* mountOnEnter: a tab loads its data only when opened */}
            <Tabs activeKey={view} onSelect={key => key && setParam("view", key)} className="mb-4" mountOnEnter>
                <Tab eventKey="day" title="Deň">{dayView}</Tab>
                <Tab eventKey="week" title="Typický týždeň"><TypicalWeekComponent sensorId={id} dirTo={sensor.dir_to} dirFrom={dirFrom} /></Tab>
                <Tab eventKey="months" title="Mesiace"><MonthlyStatsComponent sensorId={id} /></Tab>
            </Tabs>
        </Container>
    );
};

const TotalCard = ({ label, value }: { label: string, value: number }) => (
    <Card body className="total-card h-100">
        <div className="text-secondary small total-card__label">{label}</div>
        <div className="fw-semibold total-card__value">{Utils.formatNumber(value)}</div>
    </Card>
);

export default SensorDetailComponent;
