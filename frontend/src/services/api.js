import axios from "axios";


const API_URL =
    import.meta.env.VITE_API_URL ||
    "http://localhost:3001/api";


const api =
    axios.create({

        baseURL:
            API_URL,

        timeout:
            60000,

        headers: {

            Accept:
                "application/json"

        }

    });


/*
    Analizar video
*/
export async function getVideoInfo(
    url
) {

    const response =
        await api.post(
            "/download/info",
            {
                url
            }
        );


    return response.data;

}


/*
    Crear descarga
*/
export async function createDownload(
    options
) {

    const response =
        await api.post(
            "/download",
            {

                url:
                    options.url,

                format:
                    options.format ||
                    "mp4",

                resolution:
                    options.resolution ||
                    "best",

                audioQuality:
                    options.audioQuality ||
                    "192"

            }
        );


    return response.data;

}


/*
    Estado
*/
export async function getDownloadStatus(
    id
) {

    const response =
        await api.get(
            `/download/${id}`
        );


    return response.data;

}


/*
    SSE
*/
export function getEventsUrl(
    id
) {

    return `${API_URL}/download/${id}/events`;

}


/*
    Archivo
*/
export function getFileUrl(
    id
) {

    return `${API_URL}/download/${id}/file`;

}


/*
    Cancelar
*/
export async function cancelDownload(
    id
) {

    const response =
        await api.post(
            `/download/${id}/cancel`
        );


    return response.data;

}


/*
    Health
*/
export async function getHealth() {

    const response =
        await api.get(
            "/health"
        );


    return response.data;

}