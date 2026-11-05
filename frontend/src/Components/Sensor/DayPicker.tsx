import DatePicker, { registerLocale } from 'react-datepicker';
import { addDays, format, parseISO } from 'date-fns';
import { sk } from 'date-fns/locale';
import { Button, InputGroup } from 'react-bootstrap';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('sk', sk);

// What the URL (?date=) and the API use
const DATE_FORMAT = 'yyyy-MM-dd';

interface DayPickerProps {
    value: string,                     // "YYYY-MM-DD"
    min: string,
    max: string,
    onChange: (date: string) => void,
}

/** Calendar with ‹ › buttons to step one day back / forward. */
const DayPickerComponent = ({ value, min, max, onChange }: DayPickerProps) => {
    const selected = parseISO(value);

    const change = (date: Date | null) => {
        if (date) {
            onChange(format(date, DATE_FORMAT));
        }
    };

    return (
        <InputGroup className="day-picker">
            <Button
                variant="outline-secondary"
                disabled={value <= min}
                onClick={() => change(addDays(selected, -1))}
                aria-label="Predchádzajúci deň"
            >
                ‹
            </Button>

            <DatePicker
                selected={selected}
                onChange={change}
                minDate={parseISO(min)}
                maxDate={parseISO(max)}
                locale="sk"
                dateFormat="EEEE d. MMMM yyyy"
                className="form-control"
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
            />

            <Button
                variant="outline-secondary"
                disabled={value >= max}
                onClick={() => change(addDays(selected, 1))}
                aria-label="Nasledujúci deň"
            >
                ›
            </Button>
        </InputGroup>
    );
};

export default DayPickerComponent;
