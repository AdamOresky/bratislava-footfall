import type { ReactElement } from 'react';
import { Route, Routes, Outlet } from 'react-router-dom';

import NavigationComponent from './Components/Navigation';
import SensorMapComponent from './Components/Map/SensorMap';
import SensorDetailComponent from './Components/Sensor/SensorDetail';
import NotFoundComponent from './Components/ErrorPages/NotFound';

const MainLayout = () => (
    <div className="main-layout">
        <NavigationComponent/>
        <Outlet/>
    </div>
);

function App() {
    const routes: { path: string, element: ReactElement }[] = [
        { path: "/", element: <SensorMapComponent /> },
        { path: "/sensor/:sensorId", element: <SensorDetailComponent /> },
    ];

    return (
        <Routes>
            <Route element={<MainLayout />}>
                {routes.map((r) => (
                    <Route key={r.path} path={r.path} element={r.element} />
                ))}
                <Route path="/*" element={<NotFoundComponent />} />
            </Route>
        </Routes>
    );
}

export default App;
