import { Constants } from '../Models/Constants';

const FooterComponent = () => (
    <footer className="app-footer">
        <span>
            Autor: {Constants.author}, <a href={Constants.repositoryUrl} target="_blank" rel="noreferrer">zdrojový kód</a>{' '}
            (<a href={`${Constants.repositoryUrl}/blob/main/LICENSE`} target="_blank" rel="noreferrer">MIT</a>)
        </span>
        <span>
            <span className="text-nowrap">
                Dáta: <a href={Constants.dataSourceUrl} target="_blank" rel="noreferrer">{Constants.dataSourceName}</a>,
            </span>{' '}
            <span className="text-nowrap">
                licencia <a href={Constants.dataLicenseUrl} target="_blank" rel="noreferrer">CC BY 4.0</a>, upravené
            </span>
        </span>
    </footer>
);

export default FooterComponent;
