import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleMarker, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import type { FitBoundsOptions, Map as LeafletMap, Point } from 'leaflet';
import type { SensorSummary } from '../../Models/Models';
import { Utils } from '../../Services/Utils';

export const COLOR_ACTIVE = '#2a78d6';
export const COLOR_INACTIVE = '#52525b';   // outline of a sensor without data
const COLOR_FOCUS = '#eb6834';             // ring of the sensor hovered in the list
const FOCUS_ZOOM = 16;
export const MIN_RADIUS = 5;
export const MAX_RADIUS = 24;

// Room around the sensors on first load; more at the bottom, where the legend is
const FIT_PADDING: FitBoundsOptions = { paddingTopLeft: [40, 40], paddingBottomRight: [40, 180] };

interface SensorGroup {
    sensors: SensorSummary[],     // biggest first; the group sits on the first one
    point: Point,                 // screen position of the first sensor
    radius: number,
}

/** Circle area grows with the count (radius ~ square root), so a 4x busier place looks 4x bigger. */
function markerRadius(avgDailyCount: number | null, maxCount: number): number {
    if (avgDailyCount === null || maxCount === 0) {
        return MIN_RADIUS;
    }
    return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.sqrt(avgDailyCount / maxCount);
}

/**
 * Sensors whose circles overlap on screen at the current zoom go into one group.
 * Expects sensors sorted biggest first: each sensor joins the first group it touches.
 */
function groupOverlapping(sensors: SensorSummary[], map: LeafletMap, maxCount: number): SensorGroup[] {
    const groups: SensorGroup[] = [];

    for (const sensor of sensors) {
        const point = map.latLngToLayerPoint([sensor.lat, sensor.lon]);
        const radius = markerRadius(sensor.avg_daily_count, maxCount);
        const touching = groups.find(g => g.point.distanceTo(point) < g.radius + radius);

        if (touching) {
            touching.sensors.push(sensor);
        } else {
            groups.push({ sensors: [sensor], point, radius });
        }
    }
    return groups;
}

interface SensorMarkersProps {
    sensors: SensorSummary[],
    maxCount: number,
    focusedId: number | null,
}

const SensorMarkersComponent = ({ sensors, maxCount, focusedId }: SensorMarkersProps) => {
    const map = useMap();
    const [zoom, setZoom] = useState(map.getZoom());
    useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

    // Once the sensors arrive, zoom the map so all of them are visible (only the first time)
    const hasFitted = useRef(false);
    useEffect(() => {
        if (hasFitted.current || sensors.length === 0) {
            return;
        }
        map.fitBounds(sensors.map(s => [s.lat, s.lon]), FIT_PADDING);
        hasFitted.current = true;
    }, [sensors]);

    // Sensor hovered in the list: fly there (never zoom out if already closer)
    useEffect(() => {
        const focused = sensors.find(s => s.sensor_id === focusedId);
        if (focused) {
            map.flyTo([focused.lat, focused.lon], Math.max(map.getZoom(), FOCUS_ZOOM), { duration: 0.8 });
        }
    }, [focusedId]);

    const isFocused = (group: SensorGroup) => group.sensors.some(s => s.sensor_id === focusedId);

    // Focused group drawn last, so it sits on top of its neighbours
    const groups = groupOverlapping(sensors, map, maxCount)
        .sort((a, b) => Number(isFocused(a)) - Number(isFocused(b)));

    return (
        <>
            {groups.map(group => {
                const first = group.sensors[0];
                const isActive = group.sensors.some(s => s.avg_daily_count !== null);
                const style = isActive
                    ? { color: '#ffffff', weight: 2, fillColor: COLOR_ACTIVE, fillOpacity: 0.85 }
                    // No data: white circle with a dark outline, stands out on the gray map
                    : { color: COLOR_INACTIVE, weight: 2.5, fillColor: '#ffffff', fillOpacity: 1 };

                return (
                    <CircleMarker
                        key={`${zoom}-${first.sensor_id}`}
                        center={[first.lat, first.lon]}
                        radius={isFocused(group) ? group.radius + 4 : group.radius}
                        pathOptions={isFocused(group) ? { ...style, color: COLOR_FOCUS, weight: 4 } : style}
                    >
                        {group.sensors.length > 1 && (
                            <Tooltip
                                permanent
                                direction="center"
                                className={isActive ? 'map-group-count' : 'map-group-count map-group-count--inactive'}
                            >
                                {group.sensors.length}
                            </Tooltip>
                        )}
                        <Popup>
                            {group.sensors.map(s => (
                                <div key={s.sensor_id} className="map-popup-sensor">
                                    <div className="fw-medium">{s.name}</div>
                                    <div className="text-secondary small">
                                        {s.avg_daily_count === null
                                            ? 'Za posledný rok bez meraní'
                                            : `Priemerne ${Utils.formatNumber(s.avg_daily_count)} chodcov za deň`}
                                    </div>
                                    <Link to={`/sensor/${s.sensor_id}`}>Zobraziť počty</Link>
                                </div>
                            ))}
                        </Popup>
                    </CircleMarker>
                );
            })}
        </>
    );
};

export default SensorMarkersComponent;
