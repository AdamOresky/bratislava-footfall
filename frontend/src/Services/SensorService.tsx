import type { DayCounts, Sensor, SensorSummary } from "../Models/Models";
import HttpRepository from "./HttpRepository";

// Every function returns null on error; the component shows the message.
export function SensorService() {

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

    return { getSensors, getSensor, getDayCounts }
}
