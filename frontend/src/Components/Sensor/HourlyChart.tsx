import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { HourlyCount } from '../../Models/Models';
import { Utils } from '../../Services/Utils';

// Two series, checked with the dataviz palette validator (colorblind-safe)
const COLOR_TO = '#2a78d6';
const COLOR_FROM = '#eb6834';

interface HourlyChartProps {
    counts: HourlyCount[],
    dirTo: string,
    dirFrom: string,
}

const HourlyChartComponent = ({ counts, dirTo, dirFrom }: HourlyChartProps) => {
    const data = counts.map(c => ({
        hour: Utils.formatHour(c.timestamp),
        to: c.count_to,
        from: c.count_from,
    }));

    return (
        <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke="#e4e4e7" />
                <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="to" name={`→ ${dirTo}`} stackId="day" fill={COLOR_TO} />
                <Bar dataKey="from" name={`→ ${dirFrom}`} stackId="day" fill={COLOR_FROM} radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
};

export default HourlyChartComponent;
