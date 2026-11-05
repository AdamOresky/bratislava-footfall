import { useEffect, useState } from 'react';
import { Alert, Card, Col, Container, Row, Spinner } from 'react-bootstrap';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { FailureMessage, type DayCounts, type Sensor } from '../../Models/Models';
import { SensorService } from '../../Services/SensorService';
import { Utils } from '../../Services/Utils';
import HourlyChartComponent from './HourlyChart';
import DayPickerComponent from './DayPicker';

const SensorDetailComponent = () => {
    const { sensorId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { getSensor, getDayCounts } = SensorService();

    const [sensor, setSensor] = useState<Sensor | null>(null);
    const [dayCounts, setDayCounts] = useState<DayCounts | null>(null);
    const [error, setError] = useState<string | null>(null);

    const id = Number(sensorId);
    const date = searchParams.get("date");

    // Sensor info; without ?date= jump to the last day with data
    useEffect(() => {
        getSensor(id).then(result => {
            if (result === null) {
                setError(FailureMessage.dataNotLoaded);
                return;
            }
            setSensor(result);
            Utils.setDocumentTitle(result.name);

            if (!date) {
                setSearchParams({ date: Utils.toLocalDate(result.last_seen) }, { replace: true });
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

    return (
        <Container className="py-4">
            <Link to="/">← Späť na mapu</Link>
            <h1 className="h3 mt-3 mb-1">{sensor.name}</h1>
            <p className="text-secondary">
                Dáta od {Utils.formatDate(sensor.first_seen)} do {Utils.formatDate(sensor.last_seen)}
            </p>

            {date && (
                <div className="mb-4">
                    <div className="form-label">Deň</div>
                    <DayPickerComponent
                        value={date}
                        min={Utils.toLocalDate(sensor.first_seen)}
                        max={Utils.toLocalDate(sensor.last_seen)}
                        onChange={newDate => setSearchParams({ date: newDate })}
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

                    <Row className="mb-4 g-3">
                        <Col sm={4}><TotalCard label={`→ ${sensor.dir_to}`} value={dayCounts.counts_total.count_to} /></Col>
                        <Col sm={4}><TotalCard label={`→ ${dirFrom}`} value={dayCounts.counts_total.count_from} /></Col>
                        <Col sm={4}><TotalCard label="Spolu" value={dayCounts.counts_total.count} /></Col>
                    </Row>

                    <HourlyChartComponent counts={dayCounts.counts_by_hour} dirTo={sensor.dir_to} dirFrom={dirFrom} />
                </>
            )}
        </Container>
    );
};

const TotalCard = ({ label, value }: { label: string, value: number }) => (
    <Card body>
        <div className="text-secondary small">{label}</div>
        <div className="fs-3 fw-semibold">{Utils.formatNumber(value)}</div>
    </Card>
);

export default SensorDetailComponent;
