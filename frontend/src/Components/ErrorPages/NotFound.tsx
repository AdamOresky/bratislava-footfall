import { useEffect } from 'react';
import { Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { Utils } from '../../Services/Utils';

const NotFoundComponent = () => {
    useEffect(() => {
        Utils.setDocumentTitle('404');
    }, []);

    return (
        <Container className="py-5 text-center">
            <h1 className="display-4">404</h1>
            <p className="text-secondary">Stránka neexistuje.</p>
            <Link to="/">← Späť na mapu</Link>
        </Container>
    );
};

export default NotFoundComponent;
