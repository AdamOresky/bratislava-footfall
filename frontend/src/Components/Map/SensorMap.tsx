import { useEffect, useState } from 'react';
import { Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import { FailureMessage, type SensorSummary } from '../../Models/Models';
import { Constants } from '../../Models/Constants';
import { SensorService } from '../../Services/SensorService';
import { Utils } from '../../Services/Utils';

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
            setSensors(result);
        });
    }, []);

    return (
        <div className="map-page">
            {error && <Alert variant="danger" className="m-3">{error}</Alert>}

            <MapContainer center={Constants.mapCenter} zoom={Constants.mapZoom} className="map">
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {sensors.map(s => (
                    <CircleMarker key={s.sensor_id} center={[s.lat, s.lon]} radius={9} pathOptions={{ color: '#2a78d6', fillOpacity: 0.8 }}>
                        <Popup>
                            <div className="fw-medium mb-1">{s.name}</div>
                            <Link to={`/sensor/${s.sensor_id}`}>Zobraziť počty</Link>
                        </Popup>
                    </CircleMarker>
                ))}
            </MapContainer>
        </div>
    );
};

export default SensorMapComponent;
