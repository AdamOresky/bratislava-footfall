import type { DayCounts, Months, Sensor, SensorSummary, Status, TypicalWeek } from "../Models/Models";
import HttpRepository from "./HttpRepository";

// Every function returns null on error; the component shows the message.
export function SensorService() {

    async function getStatus(): Promise<Status | null> {
        try {
            return (await HttpRepository.getStatus()).data;
        }
        catch {
            return null;
        }
    }

    async function getSensors(): Promise<SensorSummary[] | null> {
        try {
            return (await HttpRepository.getSensors()).data;
        }
        catch {
            return null;
        }
    }

    async function getSensor(sensorId: number): Promise<Sensor | null> {
        try {
            return (await HttpRepository.getSensor(sensorId)).data;
        }
        catch {
            return null;
        }
    }

    async function getDayCounts(sensorId: number, date: string): Promise<DayCounts | null> {
        try {
            return (await HttpRepository.getDayCounts(sensorId, date)).data;
        }
        catch {
            return null;
        }
    }

    async function getTypicalWeek(sensorId: number): Promise<TypicalWeek | null> {
        try {
            return (await HttpRepository.getTypicalWeek(sensorId)).data;
        }
        catch {
            return null;
        }
    }

    async function getMonths(sensorId: number): Promise<Months | null> {
        try {
            return (await HttpRepository.getMonths(sensorId)).data;
        }
        catch {
            return null;
        }
    }

    return { getStatus, getSensors,getSensor, getDayCounts, getTypicalWeek, getMonths }
}
