import { useEffect, useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FailureMessage, type MonthStats } from '../../Models/Models';
import { SensorService } from '../../Services/SensorService';
import { Utils } from '../../Services/Utils';

const COLOR_BAR = '#2a78d6';

/** "2025-04" -> "4/2025" */
function shortMonth(month: string): string {
    const [year, monthNumber] = month.split('-');
    return `${Number(monthNumber)}/${year}`;
}

/** "2025-04" -> "apríl 2025" */
function longMonth(month: string): string {
    const [year, monthNumber] = month.split('-').map(Number);
    return new Date(year, monthNumber - 1, 1).toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' });
}

interface MonthlyStatsProps {
    sensorId: number,
}

/** Average daily count per month over the whole history; months without data stay empty. */
const MonthlyStatsComponent = ({ sensorId }: MonthlyStatsProps) => {
    const { getMonths } = SensorService();
    const [months, setMonths] = useState<MonthStats[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getMonths(sensorId).then(result => {
            if (result === null) {
                setError(FailureMessage.dataNotLoaded);
                return;
            }
            setMonths(result.months);
        });
    }, [sensorId]);

    if (error) {
        return <Alert variant="danger">{error}</Alert>;
    }
    if (months === null) {
        return <Spinner animation="border" />;
    }
    if (months.every(m => m.avg_daily_count === null)) {
        return <Alert variant="secondary">Sčítač za celé obdobie nemeral (žiadne záznamy alebo samé nuly).</Alert>;
    }

    const rows = months.map(m => ({ ...m, label: shortMonth(m.month) }));

    return (
        <>
            <p className="text-secondary small mb-3">
                Priemerný počet chodcov za deň v jednotlivých mesiacoch, počítané iba z dní s meraním.
                Prázdne miesto = mesiac bez meraní.
            </p>

            <ResponsiveContainer width="100%" height={320}>
                {/* Right margin: room for the last month label, otherwise cut off on a phone */}
                <BarChart data={rows} barCategoryGap={2} margin={{ top: 5, right: 16, bottom: 5, left: 5 }}>
                    <CartesianGrid vertical={false} stroke="#e4e4e7" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={16} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip content={<MonthTooltip />} />
                    <Bar dataKey="avg_daily_count" name="Priemer za deň" fill={COLOR_BAR} radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </>
    );
};

interface MonthTooltipProps {
    active?: boolean,
    payload?: { payload: MonthStats }[],
}

const MonthTooltip = ({ active, payload }: MonthTooltipProps) => {
    if (!active || !payload?.length) {
        return null;
    }
    const month = payload[0].payload;

    return (
        <div className="chart-tooltip">
            <div className="fw-medium">{longMonth(month.month)}</div>
            {month.avg_daily_count === null
                ? <div className="text-secondary">⚠ Bez meraní</div>
                : (
                    <>
                        <div>Priemerne {Utils.formatNumber(month.avg_daily_count)} chodcov za deň</div>
                        <div className="text-secondary">Merané {month.active_days} z {month.days_in_month} dní</div>
                    </>
                )}
        </div>
    );
};

export default MonthlyStatsComponent;
