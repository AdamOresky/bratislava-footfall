import type { AxiosResponse } from "axios";
import type { DayCounts, Sensor, SensorSummary } from "../Models/Models";
import axiosInstance from './BackendService';

class HttpRepository {
    private static axiosInstance = axiosInstance;

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
}

export default HttpRepository;
