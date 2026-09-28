import {
    useEffect,
    useRef,
    useState
} from "react";

import {
    cancelDownload,
    createDownload,
    getEventsUrl,
    getFileUrl,
    getVideoInfo
} from "../services/api.js";


function Downloader() {

    const [url, setUrl] =
        useState("");

    const [video, setVideo] =
        useState(null);

    const [job, setJob] =
        useState(null);

    const [message, setMessage] =
        useState("");

    const [logs, setLogs] =
        useState([]);

    const [busy, setBusy] =
        useState(false);

    const [analyzing, setAnalyzing] =
        useState(false);

    const [format, setFormat] =
        useState("mp4");

    const [resolution, setResolution] =
        useState("best");

    const [audioQuality, setAudioQuality] =
        useState("192");


    /*
        ==================================================
        CONTROL DEL PROGRESO
        ==================================================

        yt-dlp puede enviar:

        100%
        1.6%
        15%
        30%
        ...

        Ese primer 100% NO significa necesariamente
        que terminó todo el trabajo.

        Puede significar que terminó una de las
        operaciones internas y comenzó otra.

        Por eso manejamos dos etapas:

        ETAPA 1
        0% -> 100%
        equivale a 0% -> 50%

        ETAPA 2
        0% -> 100%
        equivale a 50% -> 100%
    */

    const downloadPhase =
        useRef(0);

    const lastPercent =
        useRef(0);

    const progressStarted =
        useRef(false);


    /*
        ==================================================
        SSE
        ==================================================
    */

    useEffect(
        () => {

            if (!job?.id) {
                return;
            }


            const source =
                new EventSource(
                    getEventsUrl(
                        job.id
                    )
                );


            console.log(
                "SSE conectado:",
                job.id
            );


            source.onmessage =
                event => {

                    try {

                        const data =
                            JSON.parse(
                                event.data
                            );


                        console.log(
                            "SSE:",
                            data
                        );


                        /*
                            ==========================================
                            PROGRESO DIRECTO
                            ==========================================
                        */

                        if (
                            data.type ===
                            "progress"
                        ) {

                            const percent =
                                Number(
                                    data.percent
                                );


                            if (
                                Number.isFinite(
                                    percent
                                )
                            ) {

                                setJob(
                                    current => {

                                        if (
                                            !current
                                        ) {
                                            return current;
                                        }


                                        const previous =
                                            Number(
                                                current.progress ||
                                                0
                                            );


                                        /*
                                            Nunca dejamos que el
                                            progreso retroceda.
                                        */

                                        const safeProgress =
                                            Math.max(
                                                previous,
                                                Math.min(
                                                    99.9,
                                                    percent
                                                )
                                            );


                                        return {

                                            ...current,

                                            progress:
                                                safeProgress,

                                            total:
                                                data.total ??
                                                current.total,

                                            speed:
                                                data.speed ??
                                                current.speed,

                                            eta:
                                                data.eta ??
                                                current.eta,

                                            status:
                                                "downloading"

                                        };

                                    }
                                );

                            }

                        }


                        /*
                            ==========================================
                            LOG
                            ==========================================
                        */

                        if (
                            data.type ===
                            "log"
                        ) {

                            const logMessage =
                                String(
                                    data.message ||
                                    ""
                                );


                            /*
                                Guardar log técnico.
                            */

                            if (
                                logMessage
                            ) {

                                setLogs(
                                    current => [

                                        ...current.slice(
                                            -49
                                        ),

                                        logMessage

                                    ]
                                );

                            }


                            /*
                                ======================================
                                BUSCAR PROGRESO DE YT-DLP
                                ======================================

                                Ejemplo:

                                15.2%|       N/A|   3.67KiB/s|Unknown
                            */

                            const match =
                                logMessage.match(
                                    /^\s*(\d+(?:\.\d+)?)%\s*\|\s*([^|]*)\|\s*([^|]*)\|\s*(.*)\s*$/
                                );


                            if (
                                !match
                            ) {

                                return;

                            }


                            const currentPercent =
                                Number(
                                    match[1]
                                );


                            const total =
                                match[2]
                                    ?.trim() ||
                                null;


                            const speed =
                                match[3]
                                    ?.trim() ||
                                null;


                            const eta =
                                match[4]
                                    ?.trim() ||
                                null;


                            if (
                                !Number.isFinite(
                                    currentPercent
                                )
                            ) {

                                return;

                            }


                            /*
                                ======================================
                                INICIO DEL PROGRESO
                                ======================================
                            */

                            if (
                                !progressStarted.current
                            ) {

                                progressStarted.current =
                                    true;

                                downloadPhase.current =
                                    0;

                                lastPercent.current =
                                    0;

                            }


                            /*
                                ======================================
                                DETECTAR CAMBIO DE ETAPA
                                ======================================

                                Si yt-dlp llega a 100%, NO ponemos
                                inmediatamente la barra en 100%.

                                La dejamos aproximadamente en 50%.

                                Después, cuando llegan:

                                1.6%
                                15.2%
                                30%
                                ...

                                los interpretamos como la segunda
                                etapa.
                            */

                            if (
                                downloadPhase.current ===
                                0 &&
                                currentPercent >=
                                99
                            ) {

                                downloadPhase.current =
                                    1;

                            }


                            /*
                                ======================================
                                CALCULAR PROGRESO GENERAL
                                ======================================
                            */

                            let overallProgress;


                            if (
                                downloadPhase.current ===
                                0
                            ) {

                                /*
                                    Primera etapa:

                                    0 -> 100

                                    se convierte en:

                                    0 -> 50
                                */

                                overallProgress =
                                    currentPercent /
                                    2;

                            } else {

                                /*
                                    Segunda etapa:

                                    0 -> 100

                                    se convierte en:

                                    50 -> 100
                                */

                                overallProgress =
                                    50 +
                                    (
                                        currentPercent /
                                        2
                                    );

                            }


                            /*
                                ======================================
                                SEGURIDAD
                                ======================================
                            */

                            overallProgress =
                                Math.min(
                                    99.9,
                                    Math.max(
                                        0,
                                        overallProgress
                                    )
                                );


                            /*
                                Guardamos el último porcentaje
                                recibido para diagnóstico.
                            */

                            lastPercent.current =
                                currentPercent;


                            /*
                                ======================================
                                ACTUALIZAR UI
                                ======================================
                            */

                            setJob(
                                current => {

                                    if (
                                        !current
                                    ) {
                                        return current;
                                    }


                                    const previous =
                                        Number(
                                            current.progress ||
                                            0
                                        );


                                    /*
                                        La barra nunca retrocede.

                                        Ejemplo:

                                        57%
                                        55%
                                        61%

                                        Se mostrará:

                                        57%
                                        57%
                                        61%
                                    */

                                    const finalProgress =
                                        Math.max(
                                            previous,
                                            overallProgress
                                        );


                                    return {

                                        ...current,

                                        progress:
                                            finalProgress,

                                        total,

                                        speed,

                                        eta,

                                        status:
                                            "downloading"

                                    };

                                }
                            );

                        }


                        /*
                            ==========================================
                            INICIO
                            ==========================================
                        */

                        if (
                            data.type ===
                            "started"
                        ) {

                            setJob(
                                current => {

                                    if (
                                        !current
                                    ) {
                                        return current;
                                    }


                                    return {

                                        ...current,

                                        status:
                                            "downloading"

                                    };

                                }
                            );

                        }


                        /*
                            ==========================================
                            COLA
                            ==========================================
                        */

                        if (
                            data.type ===
                            "queued"
                        ) {

                            setJob(
                                current => {

                                    if (
                                        !current
                                    ) {
                                        return current;
                                    }


                                    return {

                                        ...current,

                                        status:
                                            "queued"

                                    };

                                }
                            );

                        }


                        /*
                            ==========================================
                            COMPLETADO
                            ==========================================
                        */

                        if (
                            data.type ===
                            "completed"
                        ) {

                            setJob(
                                current => {

                                    if (
                                        !current
                                    ) {
                                        return current;
                                    }


                                    return {

                                        ...current,

                                        status:
                                            "completed",

                                        progress:
                                            100,

                                        filename:
                                            data.filename

                                    };

                                }
                            );


                            setBusy(
                                false
                            );

                        }


                        /*
                            ==========================================
                            ERROR
                            ==========================================
                        */

                        if (
                            data.type ===
                            "error"
                        ) {

                            setJob(
                                current => {

                                    if (
                                        !current
                                    ) {
                                        return current;
                                    }


                                    return {

                                        ...current,

                                        status:
                                            "error",

                                        error:
                                            data.message

                                    };

                                }
                            );


                            setBusy(
                                false
                            );

                        }


                        /*
                            ==========================================
                            CANCELADO
                            ==========================================
                        */

                        if (
                            data.type ===
                            "cancelled"
                        ) {

                            setJob(
                                current => {

                                    if (
                                        !current
                                    ) {
                                        return current;
                                    }


                                    return {

                                        ...current,

                                        status:
                                            "cancelled"

                                    };

                                }
                            );


                            setBusy(
                                false
                            );

                        }

                    } catch (
                    error
                    ) {

                        console.error(
                            "Error procesando SSE:",
                            error
                        );

                    }

                };


            /*
                ==========================================
                ERROR SSE
                ==========================================
            */

            source.onerror =
                () => {

                    console.log(
                        "SSE cerrado:",
                        job.id
                    );

                    source.close();

                };


            /*
                ==========================================
                LIMPIAR SSE
                ==========================================
            */

            return () => {

                source.close();

            };

        },
        [
            job?.id
        ]
    );


    /*
        ==================================================
        ANALIZAR URL
        ==================================================
    */

    async function handleAnalyze(
        event
    ) {

        event.preventDefault();


        if (
            !url.trim()
        ) {

            setMessage(
                "Pega primero un enlace."
            );

            return;

        }


        setAnalyzing(
            true
        );

        setMessage(
            ""
        );

        setVideo(
            null
        );

        setJob(
            null
        );

        setLogs(
            []
        );


        /*
            Reiniciar progreso.
        */

        downloadPhase.current =
            0;

        lastPercent.current =
            0;

        progressStarted.current =
            false;


        try {

            const result =
                await getVideoInfo(
                    url.trim()
                );


            setVideo(
                result.video
            );


            /*
                Seleccionar automáticamente
                la resolución máxima.
            */

            if (
                result.video
                    ?.resolutions
                    ?.length
            ) {

                const max =
                    Math.max(
                        ...result.video.resolutions
                    );


                setResolution(
                    String(
                        max
                    )
                );

            }

        } catch (
        error
        ) {

            setMessage(
                error.response
                    ?.data
                    ?.error ||
                error.message ||
                "No se pudo analizar el video."
            );

        } finally {

            setAnalyzing(
                false
            );

        }

    }


    /*
        ==================================================
        DESCARGAR
        ==================================================
    */

    async function handleDownload(
        event
    ) {

        event.preventDefault();


        if (
            !video
        ) {

            return;

        }


        setBusy(
            true
        );

        setMessage(
            ""
        );

        setLogs(
            []
        );


        /*
            Reiniciar progreso.
        */

        downloadPhase.current =
            0;

        lastPercent.current =
            0;

        progressStarted.current =
            false;


        setJob(
            null
        );


        try {

            const result =
                await createDownload({

                    url:
                        url.trim(),

                    format,

                    resolution,

                    audioQuality

                });


            setJob({

                ...result.job,

                progress:
                    0,

                total:
                    null,

                speed:
                    null,

                eta:
                    null

            });

        } catch (
        error
        ) {

            setBusy(
                false
            );


            setMessage(
                error.response
                    ?.data
                    ?.error ||
                "No se pudo iniciar la descarga."
            );

        }

    }


    /*
        ==================================================
        CANCELAR
        ==================================================
    */

    async function handleCancel() {

        if (
            !job?.id
        ) {

            return;

        }


        try {

            await cancelDownload(
                job.id
            );


            setJob(
                current => {

                    if (
                        !current
                    ) {
                        return current;
                    }


                    return {

                        ...current,

                        status:
                            "cancelled"

                    };

                }
            );


            setBusy(
                false
            );

        } catch {

            setMessage(
                "No se pudo cancelar."
            );

        }

    }


    /*
        ==================================================
        LIMPIAR
        ==================================================
    */

    function handleClear() {

        if (
            busy ||
            analyzing
        ) {

            return;

        }


        setUrl(
            ""
        );

        setVideo(
            null
        );

        setJob(
            null
        );

        setMessage(
            ""
        );

        setLogs(
            []
        );

        setFormat(
            "mp4"
        );

        setResolution(
            "best"
        );

        setAudioQuality(
            "192"
        );


        downloadPhase.current =
            0;

        lastPercent.current =
            0;

        progressStarted.current =
            false;

    }


    /*
        ==================================================
        ESTADOS
        ==================================================
    */

    const completed =
        job?.status ===
        "completed";


    const failed =
        job?.status ===
        "error";


    const cancelled =
        job?.status ===
        "cancelled";


    const progress =
        Math.min(
            100,
            Math.max(
                0,
                Number(
                    job?.progress || 0
                )
            )
        );


    /*
        ==================================================
        RENDER
        ==================================================
    */

    return (

        <section className="downloader">

            <div className="hero-copy">

                <div className="eyebrow">
                    VIDEO DOWNLOADER
                </div>


                <h1>

                    Descarga tus videos

                    <span>
                        fácilmente.
                    </span>

                </h1>


                <p>

                    Pega el enlace de un video
                    público que tengas permitido
                    descargar y selecciona el
                    formato y calidad.

                </p>

            </div>


            <form
                className="url-form"
                onSubmit={
                    handleAnalyze
                }
            >

                <div className="url-input-wrap">

                    <span className="link-icon">
                        🔗
                    </span>


                    <input

                        type="url"

                        value={
                            url
                        }

                        onChange={
                            event =>
                                setUrl(
                                    event.target.value
                                )
                        }

                        placeholder={
                            "Pega aquí el enlace del video..."
                        }

                        disabled={
                            busy ||
                            analyzing
                        }

                    />


                    {url &&
                        !busy &&
                        !analyzing && (

                            <button

                                type="button"

                                className="clear-button"

                                onClick={
                                    handleClear
                                }

                            >

                                ×

                            </button>

                        )}

                </div>


                <button

                    className="analyze-button"

                    type="submit"

                    disabled={

                        analyzing ||

                        busy ||

                        !url.trim()

                    }

                >

                    {analyzing

                        ? "ANALIZANDO..."

                        : "ANALIZAR VIDEO"

                    }

                </button>

            </form>


            {message && (

                <div className="message error-message">

                    {message}

                </div>

            )}


            {video && !job && (

                <form
                    className="result-card"
                    onSubmit={
                        handleDownload
                    }
                >

                    <div className="result-top">

                        <div>

                            <span className="platform">

                                {video.platform}

                            </span>


                            <h2>

                                {video.title}

                            </h2>

                        </div>

                    </div>


                    {video.thumbnail && (

                        <div
                            className="video-preview"
                        >

                            <img

                                src={
                                    video.thumbnail
                                }

                                alt={
                                    video.title
                                }

                            />

                        </div>

                    )}


                    <div className="video-information">

                        {video.durationFormatted && (

                            <div>

                                <small>
                                    Duración
                                </small>

                                <strong>
                                    {video.durationFormatted}
                                </strong>

                            </div>

                        )}


                        {video.uploader && (

                            <div>

                                <small>
                                    Canal
                                </small>

                                <strong>
                                    {video.uploader}
                                </strong>

                            </div>

                        )}

                    </div>


                    <div className="download-options">

                        <label>

                            Formato

                            <select

                                value={
                                    format
                                }

                                onChange={
                                    event =>
                                        setFormat(
                                            event.target.value
                                        )
                                }

                            >

                                <option value="mp4">
                                    MP4 - Video
                                </option>

                                <option value="mp3">
                                    MP3 - Audio
                                </option>

                            </select>

                        </label>


                        {format === "mp4" && (

                            <label>

                                Resolución

                                <select

                                    value={
                                        resolution
                                    }

                                    onChange={
                                        event =>
                                            setResolution(
                                                event.target.value
                                            )
                                    }

                                >

                                    <option value="best">
                                        Mejor calidad disponible
                                    </option>


                                    {video.resolutions
                                        ?.slice()
                                        .sort(
                                            (
                                                a,
                                                b
                                            ) =>
                                                b - a
                                        )
                                        .map(
                                            height => (

                                                <option

                                                    key={
                                                        height
                                                    }

                                                    value={
                                                        height
                                                    }

                                                >

                                                    {height}p

                                                </option>

                                            )
                                        )}

                                </select>

                            </label>

                        )}


                        {format === "mp3" && (

                            <label>

                                Calidad de audio

                                <select

                                    value={
                                        audioQuality
                                    }

                                    onChange={
                                        event =>
                                            setAudioQuality(
                                                event.target.value
                                            )
                                    }

                                >

                                    <option value="128">
                                        128 kbps
                                    </option>

                                    <option value="192">
                                        192 kbps
                                    </option>

                                    <option value="320">
                                        320 kbps
                                    </option>

                                </select>

                            </label>

                        )}

                    </div>


                    <button

                        className="download-button"

                        type="submit"

                        disabled={
                            busy
                        }

                    >

                        {busy

                            ? "PROCESANDO..."

                            : format === "mp3"

                                ? "🎵 DESCARGAR MP3"

                                : "⬇ DESCARGAR MP4"

                        }

                    </button>

                </form>

            )}


            {job && (

                <div className="result-card">

                    <div className="result-top">

                        <div>

                            <span className="platform">

                                {job.platform}

                            </span>


                            <h2>

                                {completed &&
                                    "¡Descarga terminada!"}


                                {failed &&
                                    "No se pudo completar"}


                                {cancelled &&
                                    "Descarga cancelada"}


                                {!completed &&
                                    !failed &&
                                    !cancelled &&
                                    "Descargando..."}

                            </h2>

                        </div>


                        <div className="status-pill">

                            {job.status}

                        </div>

                    </div>


                    <div className="progress-area">

                        <div className="progress-header">

                            <span>
                                Progreso
                            </span>


                            <strong>

                                {Math.round(
                                    progress
                                )}%

                            </strong>

                        </div>


                        <div className="progress-track">

                            <div

                                className="progress-value"

                                style={{

                                    width:
                                        `${progress}%`

                                }}

                            />

                        </div>


                        <div className="progress-meta">

                            {job.speed && (

                                <span>

                                    ⚡ {job.speed}

                                </span>

                            )}


                            {job.total && (

                                <span>

                                    📦 {job.total}

                                </span>

                            )}


                            {job.eta && (

                                <span>

                                    ⏱ ETA {job.eta}

                                </span>

                            )}

                        </div>

                    </div>


                    {completed && (

                        <a

                            className="download-button"

                            href={
                                getFileUrl(
                                    job.id
                                )
                            }

                        >

                            ⬇ Descargar archivo

                        </a>

                    )}


                    {!completed &&
                        !failed &&
                        !cancelled && (

                            <button

                                className="cancel-button"

                                onClick={
                                    handleCancel
                                }

                            >

                                Cancelar descarga

                            </button>

                        )}


                    {failed && (

                        <div className="error-box">

                            {job.error ||
                                "Ocurrió un error."}

                        </div>

                    )}


                    {cancelled && (

                        <div className="cancelled-box">

                            La descarga fue cancelada.

                        </div>

                    )}


                    {logs.length > 0 && (

                        <details className="logs">

                            <summary>
                                Ver detalles técnicos
                            </summary>


                            <pre>

                                {logs.join(
                                    "\n"
                                )}

                            </pre>

                        </details>

                    )}

                </div>

            )}


            <div className="supported">

                <span>YouTube</span>

                <span>•</span>

                <span>TikTok</span>

                <span>•</span>

                <span>Instagram</span>

                <span>•</span>

                <span>Facebook</span>

                <span>•</span>

                <span>X</span>

                <span>•</span>

                <span>Vimeo</span>

                <span>•</span>

                <span>MP4</span>

                <span>•</span>

                <span>MP3</span>

            </div>

        </section>

    );

}


export default Downloader;