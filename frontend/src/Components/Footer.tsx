import { Constants } from '../Models/Constants';

/** Author and data source credit, required by the CC BY 4.0 licence of the data. */
const FooterComponent = () => (
    <footer className="app-footer">
        <span>
            © {new Date().getFullYear()} {Constants.author}, <a href={Constants.repositoryUrl} target="_blank" rel="noreferrer">zdrojový kód</a>
        </span>
        <span>
            Dáta: <a href={Constants.dataSourceUrl} target="_blank" rel="noreferrer">{Constants.dataSourceName}</a>,
            licencia <a href={Constants.dataLicenseUrl} target="_blank" rel="noreferrer">CC BY 4.0</a>, upravené
        </span>
    </footer>
);

export default FooterComponent;
