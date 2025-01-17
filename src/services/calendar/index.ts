import { MAKE_ADD_TO_CALENDAR, MAKE_GET_FROM_CALENDAR } from 'src/config';
import { format, parse } from 'date-fns';

/**
 * Obtener el calendario actual desde la API
 * @returns Lista de turnos en formato procesado
 */
const getCurrentCalendar = async (): Promise<string[]> => {
    try {
        // Consultar la API para obtener los datos del calendario
        const response = await fetch(MAKE_GET_FROM_CALENDAR);

        // Verificar que la respuesta sea exitosa
        if (!response.ok) {
            console.error("Error en la respuesta de la API", response.statusText);
            return [];
        }

        // Parsear la respuesta como texto crudo para inspección
        const rawResponse = await response.text();
        console.log("Datos crudos de la API:", rawResponse);

        // Intentar parsear la respuesta JSON
        const json: { date: string; name: string; email: string | null }[] = JSON.parse(rawResponse);

        console.log("Respuesta de la API como JSON:", json);

        // Procesar los datos y formatear las fechas correctamente
        const list = json
            .filter(({ date, name }) => {
                if (!date || !name) {
                    console.warn("Entrada inválida en la API:", { date, name });
                    return false;
                }
                return true;
            })
            .map(({ date, name }) => {
                try {
                    const formattedDate = format(parse(date, 'yyyy/MM/dd HH:mm:ss', new Date()), 'yyyy/MM/dd HH:mm:ss');
                    return `${name}, ${formattedDate}`;
                } catch (err) {
                    console.error("Error al procesar fecha:", err, date);
                    return null;
                }
            })
            .filter(Boolean); // Filtrar entradas nulas

        if (list.length === 0) {
            console.warn("El calendario está vacío. Asegúrate de que la API devuelva datos válidos.");
        }

        console.log("Calendario procesado:", list);
        return list;
    } catch (err) {
        console.error("Error al obtener los datos del calendario:", err);
        return [];
    }
};

/**
 * Agregar un turno al calendario
 * @param payload Datos del turno
 * @returns Respuesta de la API
 */
const appToCalendar = async (payload: { name: string; email: string; startDate: string; phone: string }) => {
    try {
        // Formatear la fecha correctamente
        const formattedStartDate = format(parse(payload.startDate, 'yyyy/MM/dd HH:mm:ss', new Date()), 'yyyy/MM/dd HH:mm:ss');

        // Crear el payload con la fecha formateada
        const formattedPayload = {
            ...payload,
            startDate: formattedStartDate,
        };

        // Realizar la solicitud POST a la API para agregar el turno
        const response = await fetch(MAKE_ADD_TO_CALENDAR, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formattedPayload),
        });

        if (!response.ok) {
            console.error("Error al agregar el turno en la API:", response.statusText);
        }

        return response;
    } catch (err) {
        console.error("Error al agregar el turno:", err);
    }
};

/**
 * Función principal para procesar los turnos
 */
const processTurnos = async () => {
    const calendarList = await getCurrentCalendar();
    console.log("Calendario actual procesado:", calendarList);

    // Aquí podrías agregar lógica adicional para manejar los turnos
};

// Ejecutar la función principal
processTurnos();

export { getCurrentCalendar, appToCalendar };
