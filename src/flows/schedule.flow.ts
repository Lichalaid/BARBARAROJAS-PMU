import { addKeyword, EVENTS } from "@builderbot/bot";
import AIClass from "../services/ai";
import { getHistoryParse, handleHistory } from "../utils/handleHistory";
import { generateTimer } from "../utils/generateTimer";
import { getCurrentCalendar } from "../services/calendar";
import { getFullCurrentDate } from "src/utils/currentDate";
import { flowConfirm } from "./confirm.flow";
import {
    addMinutes,
    parse,
    format,
    getHours,
    getDay,
    addDays, setHours, setMinutes, setSeconds, isAfter, isBefore as dateFnsIsBefore,
    isBefore
} from "date-fns";

const DURATION_MEET = parseInt(process.env.DURATION_MEET ?? "60", 10);
const MINIMUM_NOTICE = 120; // Minimum notice time in minutes

interface CalendarEntry {
    name: string;
    fromDate: Date;
    toDate: Date;
}

const PROMPT_FILTER_DATE = `
### Contexto
Eres un asistente de inteligencia artificial. Tu propósito es determinar la fecha y hora que el cliente quiere, en el formato yyyy/MM/dd HH:mm:ss.

### Fecha y Hora Actual:
{CURRENT_DAY}

### Registro de Conversación:
{HISTORY}

Asistente: "{respuesta en formato (yyyy/MM/dd HH:mm:ss)}"
`;

const generatePromptFilter = (history: string): string => {
    const nowDate = getFullCurrentDate();
    return PROMPT_FILTER_DATE.replace("{HISTORY}", history).replace(
        "{CURRENT_DAY}",
        nowDate
    );
};

// Horarios personalizados por día
const customSchedule = {
    monday: { earliestHour: 12, latestHour: 16 },
    tuesday: { earliestHour: 10, latestHour: 14 },
    wednesday: { earliestHour: 12, latestHour: 18 },
    thursday: { earliestHour: 10, latestHour: 14 },
    friday: { earliestHour: 13, latestHour: 17 },
};

const flowSchedule = addKeyword(EVENTS.ACTION)
    .addAction(async (ctx, { extensions, state, flowDynamic, endFlow }) => {
        const ai = extensions.ai as AIClass;
        const history = getHistoryParse(state);

        // Obtener y tipar correctamente la lista de horarios ocupados
        const calendarList: string[] = await getCurrentCalendar();
        const parsedList: CalendarEntry[] = calendarList.map((entry) => {
            const [name, rawDate] = entry.split(",");
            const fromDate = parse(rawDate.trim(), "yyyy/MM/dd HH:mm:ss", new Date());
            return {
                name,
                fromDate,
                toDate: addMinutes(fromDate, DURATION_MEET),
            };
        });

        // Generar el prompt para determinar la fecha deseada
        const promptFilter = generatePromptFilter(history);
        const { date }: { date: string } = await ai.desiredDateFn([
            { role: "system", content: promptFilter },
        ]);

        let desiredDate = parse(date, "yyyy/MM/dd HH:mm:ss", new Date());

        // Validar si el horario solicitado ya está ocupado
        const isDateOccupied = parsedList.some(
            ({ fromDate, toDate }) =>
                desiredDate < toDate && addMinutes(desiredDate, DURATION_MEET) > fromDate
        );

        if (isDateOccupied) {
            // Si el horario solicitado está ocupado, buscar el siguiente disponible
            let nextAvailableDate = new Date(desiredDate);
            let foundAvailable = false;

            // Intentar encontrar el próximo horario disponible
            while (!foundAvailable) {
                nextAvailableDate = addMinutes(nextAvailableDate, DURATION_MEET);
                const isNextDateOccupied = parsedList.some(
                    ({ fromDate, toDate }) =>
                        nextAvailableDate < toDate && addMinutes(nextAvailableDate, DURATION_MEET) > fromDate
                );
                
                const minutesUntilNextDate = (nextAvailableDate.getTime() - new Date().getTime()) / 60000;

                if (!isNextDateOccupied && minutesUntilNextDate >= MINIMUM_NOTICE) {
                    foundAvailable = true;
                }
            }

            const dayOfWeek = getDay(nextAvailableDate);
            const currentDaySchedule = Object.values(customSchedule)[dayOfWeek - 1] || { earliestHour: 9, latestHour: 16 };

            // Aseguramos que el horario esté dentro del rango permitido
            if (nextAvailableDate) {
                const startOfDay = setHours(setMinutes(setSeconds(nextAvailableDate, 0), 0), currentDaySchedule.earliestHour); // Hora inicio personalizada
                const endOfDay = setHours(setMinutes(setSeconds(nextAvailableDate, 0), 0), currentDaySchedule.latestHour); // Hora fin personalizada
            
                if (isBefore(nextAvailableDate, startOfDay)) {
                    nextAvailableDate = startOfDay;
                } else if (isAfter(nextAvailableDate, endOfDay)) {
                    const nextDay = addDays(nextAvailableDate, 1);
                    const nextDaySchedule = Object.values(customSchedule)[(dayOfWeek % 7)];
                    nextAvailableDate = setHours(setMinutes(setSeconds(nextDay, 0), 0), nextDaySchedule.earliestHour);
                }
            }

            const formattedDate = format(nextAvailableDate, "yyyy/MM/dd HH:mm:ss");
            const msg = `El horario más cercano disponible es: ${formattedDate}. ¿Confirmo tu reserva en este horario?`;
            await flowDynamic(msg);
            await handleHistory({ content: msg, role: "assistant" }, state);
            await state.update({ desiredDate: nextAvailableDate });
            return endFlow();
        }

        const desiredHour = getHours(desiredDate);
        const dayOfWeek = getDay(desiredDate);
        const currentDaySchedule = Object.values(customSchedule)[dayOfWeek - 1] || { earliestHour: 9, latestHour: 16 };

        if (desiredHour < currentDaySchedule.earliestHour || desiredHour > currentDaySchedule.latestHour) {
            const msg =
                "Lo siento, esa hora está fuera del horario laboral. ¿Alguna otra fecha y hora?";
            await flowDynamic(msg);
            await handleHistory({ content: msg, role: "assistant" }, state);
            return endFlow();
        }

        if (dayOfWeek === 0 || dayOfWeek === 6) {
            const msg =
                "Lo siento, no trabajamos los fines de semana. Por favor, indícame otra fecha y hora.";
            await flowDynamic(msg);
            await handleHistory({ content: msg, role: "assistant" }, state);
            return endFlow();
        }

        const formattedDate = format(desiredDate, "yyyy/MM/dd HH:mm:ss");
        const msg = `¡Perfecto! El horario ${formattedDate} está disponible. ¿Confirmo tu reserva? `;
        await flowDynamic(msg);
        await handleHistory({ content: msg, role: "assistant" }, state);

        await state.update({ desiredDate });
    })
    .addAction({ capture: true }, async ({ body }, { gotoFlow, flowDynamic, state }) => {
        if (body.trim().toLowerCase().includes("si")) {
            return gotoFlow(flowConfirm);
        }
        await flowDynamic("¿Alguna otra fecha y hora?");
        await state.update({ desiredDate: null });
    });

export { flowSchedule };
