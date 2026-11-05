import { format, parseISO, subDays } from "date-fns";
import { Constants } from "../Models/Constants";

export class Utils {
    public static setDocumentTitle = (title: string) => {
        document.title = `${Constants.appName} | ${title}`;
    }

    /** "2025-03-30T00:00:00+01:00" -> "00:00" (Bratislava time). */
    public static formatHour(timestamp: string): string {
        return new Date(timestamp).toLocaleTimeString(Constants.locale, {
            timeZone: Constants.timeZone,
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    /** "2026-07-10T01:00:00+02:00" -> "2026-07-10" (calendar day in Bratislava). */
    public static toLocalDate(timestamp: string): string {
        // sv-SE formats dates as YYYY-MM-DD, the format <input type="date"> and the API use
        return new Date(timestamp).toLocaleDateString('sv-SE', { timeZone: Constants.timeZone });
    }

    /** Day before the last day with data ("YYYY-MM-DD"), but never before the first one. */
    public static defaultDay(firstSeen: string, lastSeen: string): string {
        const lastDay = Utils.toLocalDate(lastSeen);
        const dayBefore = format(subDays(parseISO(lastDay), 1), 'yyyy-MM-dd');
        const firstDay = Utils.toLocalDate(firstSeen);
        return dayBefore < firstDay ? firstDay : dayBefore;
    }

    /** "2026-07-10T01:00:00+02:00" -> "10. 7. 2026" */
    public static formatDate(timestamp: string): string {
        return new Date(timestamp).toLocaleDateString(Constants.locale, { timeZone: Constants.timeZone });
    }

    /** 12345 -> "12 345" */
    public static formatNumber(value: number): string {
        return value.toLocaleString(Constants.locale);
    }
}
