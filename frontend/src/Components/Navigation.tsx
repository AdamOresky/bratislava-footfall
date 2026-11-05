import { Container, Navbar } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { Constants } from '../Models/Constants';

const NavigationComponent = () => {
    return (
        <Navbar bg="dark" data-bs-theme="dark">
            <Container fluid>
                <Navbar.Brand as={Link} to="/">{Constants.appName}</Navbar.Brand>
                <Navbar.Text>Pohyb chodcov zo sčítačov v Bratislave</Navbar.Text>
            </Container>
        </Navbar>
    );
};

export default NavigationComponent;
