import type { AxiosResponse } from "axios";
import type { DayCounts, Months, Sensor, SensorSummary, Status, TypicalWeek } from "../Models/Models";
import axiosInstance from './BackendService';

class HttpRepository {
    private static axiosInstance = axiosInstance;

    static getStatus(): Promise<AxiosResponse<Status>> {
        return HttpRepository.axiosInstance.get<Status>("/status");
    }

    // region Sensor

    static getSensors(): Promise<AxiosResponse<SensorSummary[]>> {
        return HttpRepository.axiosInstance.get<SensorSummary[]>("/sensors");
    }

    static getSensor(sensorId: number): Promise<AxiosResponse<Sensor>> {
        return HttpRepository.axiosInstance.get<Sensor>(`/sensors/${sensorId}`);
    }

    // endregion

    // region Counts

    static getDayCounts(sensorId: number, date: string): Promise<AxiosResponse<DayCounts>> {
        return HttpRepository.axiosInstance.get<DayCounts>(`/sensors/${sensorId}/counts`, { params: { date } });
    }

    // endregion

    // region Statistics

    static getTypicalWeek(sensorId: number): Promise<AxiosResponse<TypicalWeek>> {
        return HttpRepository.axiosInstance.get<TypicalWeek>(`/sensors/${sensorId}/typical-week`);
    }

    static getMonths(sensorId: number): Promise<AxiosResponse<Months>> {
        return HttpRepository.axiosInstance.get<Months>(`/sensors/${sensorId}/months`);
    }

    // endregion
}

export default HttpRepository;
