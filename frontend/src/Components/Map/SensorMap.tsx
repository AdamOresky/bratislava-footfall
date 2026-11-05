import { useContext, useEffect, useState } from 'react';
import { Alert } from 'react-bootstrap';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { FailureMessage, type SensorSummary } from '../../Models/Models';
import { Constants } from '../../Models/Constants';
import { SensorService } from '../../Services/SensorService';
import { Utils } from '../../Services/Utils';
import SensorMarkersComponent, { COLOR_ACTIVE, COLOR_INACTIVE } from './SensorMarkers';
import SensorListComponent from './SensorList';
import { SensorListContext } from '../../Contexts';

/** Leaflet only notices window resizes; this also catches the sensor list folding in and out. */
const MapResizeHandler = () => {
    const map = useMap();
    useEffect(() => {
        const observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(map.getContainer());
        return () => observer.disconnect();
    }, [map]);
    return null;
};

const SensorMapComponent = () => {
    useEffect(() => {
        Utils.setDocumentTitle('Mapa');
    }, []);

    const { getSensors } = SensorService();
    const [sensors, setSensors] = useState<SensorSummary[]>([]);
    const [error, setError] = useState<string | null>(null);
    const { isListOpen } = useContext(SensorListContext);   // toggled from the navbar
    const [focusedId, setFocusedId] = useState<number | null>(null);   // hovered in the list

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

            <div className="map-layout">
                <aside className="sensor-list" hidden={!isListOpen}>
                    <div className="sensor-list__header">
                        <span className="sensor-list__title">Sčítače</span>
                    </div>
                    <SensorListComponent sensors={sensors} onFocusChange={setFocusedId} />
                </aside>

                <div className="map-area">
                    <MapContainer center={Constants.mapCenter} zoom={Constants.mapZoom} className="map">
                        {/* OpenStreetMap, grayed out in index.css (.map .leaflet-tile-pane), so the data circles stand out */}
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <SensorMarkersComponent sensors={sensors} maxCount={maxCount} focusedId={focusedId} />
                        <MapResizeHandler />
                    </MapContainer>

                    <div className="map-legend">
                        <div className="map-legend__title">Legenda</div>
                        <div className="small map-legend__detail">Veľkosť krúžku = priemerný počet chodcov za deň</div>
                        <div className="text-secondary small mb-2 map-legend__detail">posledných 12 mesiacov, iba dni s meraním</div>
                        <div className="map-legend__row small">
                            <span className="map-legend__dot" style={{ background: COLOR_ACTIVE }} />
                            s meraním
                        </div>
                        <div className="map-legend__row small">
                            <span className="map-legend__dot map-legend__dot--inactive" style={{ borderColor: COLOR_INACTIVE }} />
                            bez meraní
                        </div>
                        <div className="map-legend__row small">
                            <span className="map-legend__dot map-legend__dot--group" style={{ background: COLOR_ACTIVE }}>2</span>
                            viac sčítačov na jednom mieste
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SensorMapComponent;
