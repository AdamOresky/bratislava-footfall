import axios, { type AxiosError } from 'axios';
import config from '../config.json';

// One shared Axios instance for the whole app
const axiosInstance = axios.create({
    baseURL: import.meta.env.DEV ? config.localUrl : config.serverUrl,
});

axiosInstance.interceptors.response.use(
    response => response,
    (error: AxiosError) => {
        console.error('API Error:', error.response ?? error);
        return Promise.reject(error);
    }
);

export default axiosInstance;
