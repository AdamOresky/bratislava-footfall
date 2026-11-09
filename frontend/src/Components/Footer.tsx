import { useEffect, useState } from 'react';
import { Constants } from '../Models/Constants';
import { SensorService } from '../Services/SensorService';
import { Utils } from '../Services/Utils';

const FooterComponent = () => {
    const [lastUpdateAt, setLastUpdateAt] = useState<string | null>(null);

    useEffect(() => {
        SensorService().getStatus().then(status => setLastUpdateAt(status?.data_until ?? null));
    }, []);

    return (
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
                {lastUpdateAt && (
                    <>
                        {', '}
                        <span className="text-nowrap">dáta aktualizované {Utils.formatDate(lastUpdateAt)}</span>
                    </>
                )}
            </span>
        </footer>
    );
};

export default FooterComponent;
