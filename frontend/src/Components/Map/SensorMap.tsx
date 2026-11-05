import { useEffect, useState } from 'react';
import { Alert } from 'react-bootstrap';
import { MapContainer, TileLayer } from 'react-leaflet';
import { FailureMessage, type SensorSummary } from '../../Models/Models';
import { Constants } from '../../Models/Constants';
import { SensorService } from '../../Services/SensorService';
import { Utils } from '../../Services/Utils';
import SensorMarkersComponent, { COLOR_ACTIVE, COLOR_INACTIVE } from './SensorMarkers';

const SensorMapComponent = () => {
    useEffect(() => {
        Utils.setDocumentTitle('Mapa');
    }, []);

    const { getSensors } = SensorService();
    const [sensors, setSensors] = useState<SensorSummary[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getSensors().then(result => {
            if (result === null) {
                setError(FailureMessage.dataNotLoaded);
                return;
            }
            // Biggest first: overlapping sensors are grouped under the busiest one
            setSensors([...result].sort((a, b) => (b.avg_daily_count ?? 0) - (a.avg_daily_count ?? 0)));
        });
    }, []);

    const maxCount = Math.max(0, ...sensors.map(s => s.avg_daily_count ?? 0));

    return (
        <div className="map-page">
            {error && <Alert variant="danger" className="m-3">{error}</Alert>}

            <MapContainer center={Constants.mapCenter} zoom={Constants.mapZoom} className="map">
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <SensorMarkersComponent sensors={sensors} maxCount={maxCount} />
            </MapContainer>

            <div className="map-legend">
                <div className="map-legend__title">Legenda</div>
                <div className="small">Veľkosť krúžku = priemerný počet chodcov za deň</div>
                <div className="text-secondary small mb-2">posledných 12 mesiacov, iba dni s meraním</div>
                <div className="map-legend__row small">
                    <span className="map-legend__dot" style={{ background: COLOR_ACTIVE }} />
                    s meraním
                </div>
                <div className="map-legend__row small">
                    <span className="map-legend__dot" style={{ background: COLOR_INACTIVE }} />
                    bez meraní
                </div>
                <div className="map-legend__row small">
                    <span className="map-legend__dot map-legend__dot--group" style={{ background: COLOR_ACTIVE }}>2</span>
                    viac sčítačov na jednom mieste
                </div>
            </div>
        </div>
    );
};

export default SensorMapComponent;
