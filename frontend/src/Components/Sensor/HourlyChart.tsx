import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { HourlyCount } from '../../Models/Models';
import { Utils } from '../../Services/Utils';

// Two series, checked with the dataviz palette validator (colorblind-safe)
const COLOR_TO = '#2a78d6';
const COLOR_FROM = '#eb6834';
const COLOR_MISSING = '#f4f4f5';
const COLOR_WARNING = '#eda100';

interface ChartRow {
    hour: string,            // "08:00"
    timestamp: string,
    to: number | null,       // null = hour without a record
    from: number | null,
    missing: number | null,  // full chart height for a missing hour, else null
}

interface HourlyChartProps {
    counts: HourlyCount[],
    missingHours: string[],
    dirTo: string,
    dirFrom: string,
}

/** Whole day, hour by hour: recorded hours as bars, missing hours as a gray column with a warning icon. */
function buildRows(counts: HourlyCount[], missingHours: string[]): ChartRow[] {
    const fullHeight = Math.max(1, ...counts.map(c => c.count));

    const rows = [
        ...counts.map(c => ({ timestamp: c.timestamp, to: c.count_to, from: c.count_from, missing: null })),
        ...missingHours.map(t => ({ timestamp: t, to: null, from: null, missing: fullHeight })),
    ];

    return rows
        .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
        .map(r => ({ ...r, hour: Utils.formatHour(r.timestamp) }));
}

const HourlyChartComponent = ({ counts, missingHours, dirTo, dirFrom }: HourlyChartProps) => {
    const rows = buildRows(counts, missingHours);

    return (
        <ResponsiveContainer width="100%" height={320}>
            <BarChart data={rows} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke="#e4e4e7" />
                <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip content={<HourTooltip dirTo={dirTo} dirFrom={dirFrom} />} />
                <Legend />
                <Bar dataKey="to" name={`→ ${dirTo}`} stackId="day" fill={COLOR_TO} />
                <Bar dataKey="from" name={`→ ${dirFrom}`} stackId="day" fill={COLOR_FROM} radius={[4, 4, 0, 0]} />
                {missingHours.length > 0 && (
                    <Bar dataKey="missing" name="chýbajú dáta" stackId="day" fill={COLOR_MISSING} shape={MissingHourShape} />
                )}
            </BarChart>
        </ResponsiveContainer>
    );
};

/** Gray column with a warning triangle at the top. */
const MissingHourShape = (props: { x?: number, y?: number, width?: number, height?: number }) => {
    const { x = 0, y = 0, width = 0, height = 0 } = props;
    if (height <= 0) {
        return null;
    }
    const iconX = x + width / 2 - 7;
    const iconY = y + 4;

    return (
        <g>
            <rect x={x} y={y} width={width} height={height} rx={4} fill={COLOR_MISSING} stroke="#d4d4d8" strokeDasharray="3 3" />
            <g transform={`translate(${iconX}, ${iconY})`}>
                <path d="M7 0.5 L13.5 12.5 H0.5 Z" fill={COLOR_WARNING} />
                <rect x={6.25} y={4.5} width={1.5} height={4} fill="#ffffff" />
                <rect x={6.25} y={9.75} width={1.5} height={1.5} fill="#ffffff" />
            </g>
        </g>
    );
};

interface HourTooltipProps {
    dirTo: string,
    dirFrom: string,
    active?: boolean,
    payload?: { payload: ChartRow }[],
}

const HourTooltip = ({ dirTo, dirFrom, active, payload }: HourTooltipProps) => {
    if (!active || !payload?.length) {
        return null;
    }
    const row = payload[0].payload;

    return (
        <div className="chart-tooltip">
            <div className="fw-medium">{row.hour}</div>
            {row.to === null || row.from === null
                ? <div className="text-secondary">⚠ Chýbajú dáta</div>
                : (
                    <>
                        <div>→ {dirTo}: {Utils.formatNumber(row.to)}</div>
                        <div>→ {dirFrom}: {Utils.formatNumber(row.from)}</div>
                        <div className="fw-medium">Spolu: {Utils.formatNumber(row.to + row.from)}</div>
                    </>
                )}
        </div>
    );
};

export default HourlyChartComponent;
