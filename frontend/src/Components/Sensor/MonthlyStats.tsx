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

const MONTH_NAMES = ['január', 'február', 'marec', 'apríl', 'máj', 'jún', 'júl', 'august', 'september', 'október', 'november', 'december'];
const MONTH_SHORT = ['jan', 'feb', 'mar', 'apr', 'máj', 'jún', 'júl', 'aug', 'sep', 'okt', 'nov', 'dec'];

interface CalendarMonth {
    index: number,               // 0 = january
    label: string,
    avg_daily_count: number | null,
    active_days: number,
}

function byCalendarMonth(months: MonthStats[]): CalendarMonth[] {
    // Sum over all years, one slot per calendar month (0 = january)
    const totalCount = new Array(12).fill(0);
    const measuredDays = new Array(12).fill(0);

    for (const month of months) {
        const monthIndex = Number(month.month.slice(5)) - 1;
        totalCount[monthIndex] += (month.avg_daily_count ?? 0) * month.active_days;
        measuredDays[monthIndex] += month.active_days;
    }

    return MONTH_SHORT.map((label, index) => ({
        index,
        label,
        avg_daily_count: measuredDays[index] > 0 ? Math.round(totalCount[index] / measuredDays[index]) : null,
        active_days: measuredDays[index],
    }));
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
    const calendarRows = byCalendarMonth(months);

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

            <h5 className="mt-5 mb-2">Priemer podľa mesiaca v roku</h5>
            <p className="text-secondary small mb-3">
                Priemerný počet chodcov za deň v danom kalendárnom mesiaci, spolu za všetky roky
                (iba dni s meraním).
            </p>

            <ResponsiveContainer width="100%" height={280}>
                <BarChart data={calendarRows} barCategoryGap="15%" margin={{ top: 5, right: 16, bottom: 5, left: 5 }}>
                    <CartesianGrid vertical={false} stroke="#e4e4e7" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip content={<CalendarMonthTooltip />} />
                    <Bar dataKey="avg_daily_count" name="Priemer za deň" fill={COLOR_BAR} radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </>
    );
};

interface CalendarMonthTooltipProps {
    active?: boolean,
    payload?: { payload: CalendarMonth }[],
}

const CalendarMonthTooltip = ({ active, payload }: CalendarMonthTooltipProps) => {
    if (!active || !payload?.length) {
        return null;
    }
    const month = payload[0].payload;

    return (
        <div className="chart-tooltip">
            <div className="fw-medium">{MONTH_NAMES[month.index]}</div>
            {month.avg_daily_count === null
                ? <div className="text-secondary">⚠ Bez meraní</div>
                : (
                    <>
                        <div>Priemerne {Utils.formatNumber(month.avg_daily_count)} chodcov za deň</div>
                        <div className="text-secondary">
                            {Utils.formatNumber(month.active_days)} dní meraní
                        </div>
                    </>
                )}
        </div>
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
