import { useState, type ReactElement } from 'react';
import { Route, Routes, Outlet } from 'react-router-dom';

import NavigationComponent from './Components/Navigation';
import SensorMapComponent from './Components/Map/SensorMap';
import SensorDetailComponent from './Components/Sensor/SensorDetail';
import NotFoundComponent from './Components/ErrorPages/NotFound';
import { SensorListContext } from './Contexts';

const MainLayout = () => (
    <div className="main-layout">
        <NavigationComponent/>
        <Outlet/>
    </div>
);

function App() {
    const [isListOpen, setIsListOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches);
    const routes: { path: string, element: ReactElement }[] = [
        { path: "/", element: <SensorMapComponent /> },
        { path: "/sensor/:sensorId", element: <SensorDetailComponent /> },
    ];

    return (
        <SensorListContext.Provider value={{ isListOpen, setIsListOpen }}>
            <Routes>
                <Route element={<MainLayout />}>
                    {routes.map((r) => (
                        <Route key={r.path} path={r.path} element={r.element} />
                    ))}
                    <Route path="/*" element={<NotFoundComponent />} />
                </Route>
            </Routes>
        </SensorListContext.Provider>
    );
}

export default App;
