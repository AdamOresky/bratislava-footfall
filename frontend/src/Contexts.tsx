import { createContext } from "react";

export const SensorListContext = createContext({
    isListOpen: false,
    setIsListOpen: (_: boolean) => {},
});
