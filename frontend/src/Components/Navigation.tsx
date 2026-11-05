import { useContext } from 'react';
import { Button, Container, Navbar } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import { Constants } from '../Models/Constants';
import { SensorListContext } from '../Contexts';

const NavigationComponent = () => {
    const { isListOpen, setIsListOpen } = useContext(SensorListContext);
    const isMapPage = useLocation().pathname === '/';

    return (
        <Navbar bg="dark" data-bs-theme="dark">
            <Container fluid>
                <Navbar.Brand as={Link} to="/">{Constants.appName}</Navbar.Brand>
                <div className="d-flex align-items-center gap-3">
                    <Navbar.Text className="d-none d-lg-block">Pohyb chodcov zo sčítačov v Bratislave</Navbar.Text>
                    {/* The sensor list belongs to the map page only */}
                    {isMapPage && (
                        <Button
                            variant={isListOpen ? 'light' : 'outline-light'}
                            size="sm"
                            onClick={() => setIsListOpen(!isListOpen)}
                            aria-expanded={isListOpen}
                        >
                            ☰ Zoznam sčítačov
                        </Button>
                    )}
                </div>
            </Container>
        </Navbar>
    );
};

export default NavigationComponent;
