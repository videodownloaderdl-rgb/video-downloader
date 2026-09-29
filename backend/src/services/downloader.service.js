import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

import {
    detectPlatform,
    validatePublicUrl
} from "../utils/platform.js";


const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);

const BACKEND_DIR =
    path.resolve(
        __dirname,
        "../../"
    );

const DOWNLOAD_DIR =
    path.join(
        BACKEND_DIR,
        "downloads"
    );


const YTDLP_PATH =
    path.join(
        BACKEND_DIR,
        "bin",
        process.platform === "win32"
            ? "yt-dlp.exe"
            : "yt-dlp"
    );


const FFMPEG_PATH =
    path.join(
        BACKEND_DIR,
        "bin",
        process.platform === "win32"
            ? "ffmpeg.exe"
            : "ffmpeg"
    );


const DENO_PATH =
    process.platform === "win32"
        ? path.join(
            process.env.LOCALAPPDATA || "",
            "Microsoft",
            "WinGet",
            "Packages",
            "DenoLand.Deno_Microsoft.Winget.Source_8wekyb3d8bbwe",
            "deno.exe"
        )
        : "deno";

const YOUTUBE_COOKIES_PATH =
    path.join(
        BACKEND_DIR,
        "youtube-cookies.txt"
    );


const jobs =
    new Map();


fs.mkdirSync(
    DOWNLOAD_DIR,
    {
        recursive: true
    }
);


/* =========================================================
   UTILIDADES
========================================================= */

function now() {

    return new Date()
        .toISOString();

}


function generateId() {

    return crypto
        .randomUUID();

}


function emit(
    job,
    type,
    data = {}
) {

    const event = {

        time:
            now(),

        type,

        ...data

    };


    job.events.push(
        event
    );


    if (
        job.events.length > 500
    ) {

        job.events =
            job.events.slice(
                -500
            );

    }

}


function getExecutable(
    executablePath,
    name
) {

    /*
        Primero intentamos utilizar el
        ejecutable local del proyecto.

        Windows:
            backend/bin/yt-dlp.exe

        Linux:
            backend/bin/yt-dlp
    */

    if (
        fs.existsSync(
            executablePath
        )
    ) {

        return executablePath;

    }


    /*
        En Render/Linux los ejecutables
        están instalados en PATH.

        Por ejemplo:

            yt-dlp
            ffmpeg

        Windows no utiliza este fallback
        porque allí tenemos los ejecutables
        locales dentro de backend/bin.
    */

    if (
        process.platform !== "win32"
    ) {

        return name === "FFmpeg"
            ? "ffmpeg"
            : "yt-dlp";

    }


    throw new Error(
        `${name} no está instalado en:\n${executablePath}`
    );

}


function getDeno() {

    if (
        process.platform === "win32"
    ) {

        if (
            fs.existsSync(
                DENO_PATH
            )
        ) {

            return DENO_PATH;

        }


        return "deno";

    }


    return "deno";

}

function getYouTubeCookiesPath() {

    const renderPath =
        "/etc/secrets/youtube-cookies.txt";

    if (
        fs.existsSync(
            renderPath
        )
    ) {
        return renderPath;
    }

    const localPath =
        path.join(
            BACKEND_DIR,
            "youtube-cookies.txt"
        );

    if (
        fs.existsSync(
            localPath
        )
    ) {
        return localPath;
    }

    return null;
}

function prepareYouTubeCookies(
    jobDirectory = DOWNLOAD_DIR
) {

    const source =
        getYouTubeCookiesPath();

    if (!source) {
        return null;
    }

    const target =
        path.join(
            jobDirectory,
            "youtube-cookies.txt"
        );

    fs.copyFileSync(
        source,
        target
    );

    return target;
}

function prepareInfoCookies() {

    const source =
        getYouTubeCookiesPath();

    if (!source) {
        return null;
    }

    const directory =
        path.join(
            DOWNLOAD_DIR,
            "_cookies"
        );

    fs.mkdirSync(
        directory,
        {
            recursive: true
        }
    );

    const target =
        path.join(
            directory,
            "youtube-cookies.txt"
        );

    fs.copyFileSync(
        source,
        target
    );

    return target;
}

function isYouTubeUrl(
    url
) {

    try {

        const parsed =
            new URL(
                url
            );

        const hostname =
            parsed.hostname
                .toLowerCase()
                .replace(
                    /^www\./,
                    ""
                );

        return (
            hostname === "youtube.com" ||
            hostname === "youtu.be" ||
            hostname.endsWith(
                ".youtube.com"
            )
        );

    } catch {

        return false;

    }
}


function getYouTubeCookiesArgs(
    url,
    writableDirectory
) {

    if (
        !isYouTubeUrl(
            url
        )
    ) {
        return [];
    }

    const source =
        getYouTubeCookiesPath();

    if (!source) {
        return [];
    }

    const target =
        path.join(
            writableDirectory,
            "youtube-cookies.txt"
        );

    fs.copyFileSync(
        source,
        target
    );

    return [
        "--cookies",
        target
    ];
}

/* =========================================================
   PROGRESO DE YT-DLP
========================================================= */

function parseProgress(
    line
) {

    if (
        !line.startsWith(
            "download:"
        )
    ) {

        return null;

    }


    const payload =
        line.slice(
            "download:".length
        );


    const parts =
        payload.split(
            "|"
        );


    const percentRaw =
        parts[0] ||
        "";


    const total =
        parts[1]
            ?.trim() ||
        null;


    const speed =
        parts[2]
            ?.trim() ||
        null;


    const eta =
        parts[3]
            ?.trim() ||
        null;


    const percent =
        Number(
            String(
                percentRaw
            )
                .replace(
                    "%",
                    ""
                )
                .trim()
        );


    if (
        !Number.isFinite(
            percent
        )
    ) {

        return null;

    }


    return {

        percent,

        total,

        speed,

        eta

    };

}


/* =========================================================
   PROGRESO GENERAL
========================================================= */

/*
    Calcula el progreso que verá el usuario.

    MP3:
        0 -> 100

    MP4:
        etapa 1 = 0 -> 50
        etapa 2 = 50 -> 100
*/

function calculateOverallProgress(
    job,
    percent
) {

    const safePercent =
        Math.min(
            100,
            Math.max(
                0,
                Number(percent) || 0
            )
        );


    /*
        MP3 normalmente tiene una sola
        operación principal.
    */

    if (
        job.format === "mp3"
    ) {

        return Math.min(
            99.9,
            safePercent
        );

    }


    /*
        MP4 puede descargar:

        VIDEO
        AUDIO

        Por eso usamos dos etapas.
    */


    /*
        Si llegamos a aproximadamente
        100% en la primera etapa,
        cambiamos a la segunda.

        MUY IMPORTANTE:

        No devolvemos 100 aquí.

        Devolvemos máximo 50.
    */

    if (
        job.downloadPhase === 0 &&
        safePercent >= 99
    ) {

        job.downloadPhase =
            1;

    }


    if (
        job.downloadPhase === 0
    ) {

        return Math.min(
            49.9,
            safePercent / 2
        );

    }


    return Math.min(
        99.9,
        50 +
        (
            safePercent / 2
        )
    );

}


/* =========================================================
   ARCHIVOS
========================================================= */

function createOutputTemplate(
    jobId
) {

    return path.join(
        DOWNLOAD_DIR,
        jobId,
        "%(title).180s-%(id)s.%(ext)s"
    );

}


function findDownloadedFile(
    job
) {

    if (
        !fs.existsSync(
            job.directory
        )
    ) {

        return null;

    }


    const files =
        fs.readdirSync(
            job.directory
        );


    const allowedExtensions =
        job.format === "mp3"

            ? [
                ".mp3"
            ]

            : [
                ".mp4"
            ];


    const downloadedFiles =
        files.filter(
            file => {

                const lower =
                    file.toLowerCase();


                return allowedExtensions
                    .some(
                        extension =>
                            lower.endsWith(
                                extension
                            )
                    );

            }
        );


    if (
        downloadedFiles.length === 0
    ) {

        return null;

    }


    return path.join(
        job.directory,
        downloadedFiles[0]
    );

}


/* =========================================================
   INFORMACIÓN DEL VIDEO
========================================================= */

function parseDuration(
    seconds
) {

    if (
        !seconds ||
        Number.isNaN(
            Number(seconds)
        )
    ) {

        return null;

    }


    const total =
        Math.floor(
            Number(seconds)
        );


    const hours =
        Math.floor(
            total / 3600
        );


    const minutes =
        Math.floor(
            (total % 3600) / 60
        );


    const secs =
        total % 60;


    if (
        hours > 0
    ) {

        return [

            String(hours)
                .padStart(
                    2,
                    "0"
                ),

            String(minutes)
                .padStart(
                    2,
                    "0"
                ),

            String(secs)
                .padStart(
                    2,
                    "0"
                )

        ].join(":");

    }


    return [

        String(minutes)
            .padStart(
                2,
                "0"
            ),

        String(secs)
            .padStart(
                2,
                "0"
            )

    ].join(":");

}

const infoCookiesDirectory =
    path.join(
        DOWNLOAD_DIR,
        "_info"
    );

fs.mkdirSync(
    infoCookiesDirectory,
    {
        recursive: true
    }
);


export async function getVideoInfo(
    rawUrl
) {

    const url =
        validatePublicUrl(
            rawUrl
        );


    const ytdlp =
        getExecutable(
            YTDLP_PATH,
            "yt-dlp"
        );


    const deno =
        getDeno();


    const args = [
        "--newline",
        "--progress",
        "--progress-template",
        "download:%(progress._percent_str)s|%(progress._total_bytes_str)s|%(progress._speed_str)s|%(progress._eta_str)s",
        "--dump-single-json",
        "--no-playlist",
        "--no-warnings",
        "--no-check-certificates",
        "--js-runtimes",
        `deno:${deno}`,

        ...getYouTubeCookiesArgs(
            url,
            infoCookiesDirectory
        ),

        url
    ];

    const cookiesPath =
        getYouTubeCookiesPath();

    console.log(
        "[YouTube] Cookies:",
        cookiesPath || "NO DISPONIBLES"
    );

    console.log(
        "[YouTube] Args:",
        args
    );


    return new Promise(
        (
            resolve,
            reject
        ) => {

            const child =
                spawn(
                    ytdlp,
                    args,
                    {

                        cwd:
                            BACKEND_DIR,

                        env: {

                            ...process.env,

                            PATH:
                                [

                                    path.dirname(
                                        ytdlp
                                    ),

                                    path.dirname(
                                        FFMPEG_PATH
                                    ),

                                    path.dirname(
                                        deno
                                    ),

                                    process.env.PATH ||
                                    ""

                                ]
                                    .filter(
                                        Boolean
                                    )
                                    .join(
                                        path.delimiter
                                    )

                        },

                        shell:
                            false,

                        windowsHide:
                            true,

                        stdio: [

                            "ignore",

                            "pipe",

                            "pipe"

                        ]

                    }
                );


            let stdout =
                "";

            let stderr =
                "";


            child.stdout.on(
                "data",
                chunk => {

                    stdout +=
                        chunk.toString();

                }
            );


            child.stderr.on(
                "data",
                chunk => {

                    stderr +=
                        chunk.toString();

                }
            );


            child.on(
                "error",
                error => {

                    reject(
                        error
                    );

                }
            );


            child.on(
                "close",
                code => {

                    if (
                        code !== 0
                    ) {

                        const errorText =
                            stderr.trim();


                        reject(
                            new Error(
                                errorText ||
                                `yt-dlp terminó con código ${code}.`
                            )
                        );


                        return;

                    }


                    try {

                        const info =
                            JSON.parse(
                                stdout
                            );


                        const heights =
                            new Set();


                        const formats =
                            Array.isArray(
                                info.formats
                            )
                                ? info.formats
                                : [];


                        for (
                            const format
                            of formats
                        ) {

                            const height =
                                Number(
                                    format.height
                                );


                            const hasVideo =
                                format.vcodec &&
                                format.vcodec !==
                                "none";


                            if (
                                hasVideo &&
                                height > 0
                            ) {

                                heights.add(
                                    height
                                );

                            }

                        }


                        const resolutions =
                            Array
                                .from(
                                    heights
                                )
                                .filter(
                                    height =>
                                        height >= 144
                                )
                                .sort(
                                    (
                                        a,
                                        b
                                    ) =>
                                        a - b
                                );


                        resolve({

                            title:
                                info.title ||
                                "Video",

                            uploader:
                                info.uploader ||
                                info.channel ||
                                null,

                            duration:
                                info.duration ||
                                null,

                            durationFormatted:
                                parseDuration(
                                    info.duration
                                ),

                            thumbnail:
                                info.thumbnail ||
                                null,

                            platform:
                                detectPlatform(
                                    url
                                ),

                            webpageUrl:
                                info.webpage_url ||
                                url,

                            resolutions,

                            hasAudio:
                                formats.some(
                                    format =>
                                        format.acodec &&
                                        format.acodec !==
                                        "none"
                                )

                        });

                    } catch (
                    error
                    ) {

                        reject(
                            new Error(
                                `No se pudo interpretar la información del video: ${error.message}`
                            )
                        );

                    }

                }
            );

        }
    );

}


/* =========================================================
   CREAR JOB
========================================================= */

export function createJob(
    rawUrl,
    options = {}
) {

    const url =
        validatePublicUrl(
            rawUrl
        );


    const format =
        options.format ||
        "mp4";


    if (
        ![
            "mp4",
            "mp3"
        ].includes(
            format
        )
    ) {

        throw new Error(
            "Formato no válido."
        );

    }


    const resolution =
        options.resolution ||
        "best";


    const audioQuality =
        options.audioQuality ||
        "192";


    const id =
        generateId();


    const directory =
        path.join(
            DOWNLOAD_DIR,
            id
        );


    fs.mkdirSync(
        directory,
        {
            recursive:
                true
        }
    );


    const job = {

        id,

        url,

        platform:
            detectPlatform(
                url
            ),

        format,

        resolution,

        audioQuality,

        status:
            "queued",


        /*
            Información del progreso
        */

        progress: {

            percent:
                0,

            total:
                null,

            speed:
                null,

            eta:
                null

        },


        /*
            Etapa actual.

            MP4:

            0 = primera etapa
            1 = segunda etapa

            MP3:

            siempre se usa una etapa.
        */

        downloadPhase:
            0,


        title:
            null,

        filename:
            null,

        error:
            null,

        process:
            null,

        directory,

        createdAt:
            now(),

        events:
            []

    };


    jobs.set(
        id,
        job
    );


    emit(
        job,
        "queued",
        {

            message:
                "Descarga agregada a la cola."

        }
    );


    return job;

}


/* =========================================================
   OBTENER JOB
========================================================= */

export function getJob(
    id
) {

    return jobs.get(
        id
    );

}


/* =========================================================
   FORMATO DE VIDEO
========================================================= */

function getVideoFormat(
    resolution
) {

    if (
        !resolution ||
        resolution === "best"
    ) {

        return "bv*+ba/b";

    }


    const height =
        Number(
            resolution
        );


    if (
        !Number.isFinite(
            height
        )
    ) {

        return "bv*+ba/b";

    }


    return `bv*[height<=${height}]+ba/b[height<=${height}]/b[height<=${height}]`;

}


/* =========================================================
   INICIAR JOB
========================================================= */

export function startJob(
    id
) {

    const job =
        jobs.get(
            id
        );


    if (!job) {

        return false;

    }


    if (
        job.status !==
        "queued"
    ) {

        return false;

    }


    job.status =
        "downloading";


    job.downloadPhase =
        0;


    job.progress = {

        percent:
            0,

        total:
            null,

        speed:
            null,

        eta:
            null

    };


    emit(
        job,
        "started",
        {

            message:
                "Iniciando descarga."

        }
    );


    let ytdlp;
    let ffmpeg;


    try {

        ytdlp =
            getExecutable(
                YTDLP_PATH,
                "yt-dlp"
            );


        ffmpeg =
            getExecutable(
                FFMPEG_PATH,
                "FFmpeg"
            );

    } catch (
    error
    ) {

        job.status =
            "error";


        job.error =
            error.message;


        emit(
            job,
            "error",
            {

                message:
                    error.message

            }
        );


        return false;

    }


    const deno =
        getDeno();


    const outputTemplate =
        createOutputTemplate(
            job.id
        );


    let args;


    /* =====================================================
       OPCIONES BASE
    ===================================================== */

    const commonArgs = [
        "--newline",
        "--progress",
        "--progress-template",
        "download:%(progress._percent_str)s|%(progress._total_bytes_str)s|%(progress._speed_str)s|%(progress._eta_str)s",
        "--no-playlist",
        "--restrict-filenames",
        "--no-warnings",
        "--no-check-certificates",
        "--js-runtimes",
        `deno:${deno}`,

        ...getYouTubeCookiesArgs(
            job.url,
            job.directory
        ),
    ];


    /* =====================================================
       MP3
    ===================================================== */

    if (
        job.format === "mp3"
    ) {

        args = [

            ...commonArgs,

            "-x",

            "--audio-format",
            "mp3",

            "--audio-quality",
            `${job.audioQuality}K`,

            "--ffmpeg-location",
            ffmpeg,

            "--print",
            "after_move:filepath",

            "-o",
            outputTemplate,

            job.url

        ];

    }


    /* =====================================================
       MP4
    ===================================================== */

    else {

        args = [

            ...commonArgs,

            "-f",

            getVideoFormat(
                job.resolution
            ),

            "--merge-output-format",
            "mp4",

            "--ffmpeg-location",
            ffmpeg,

            "--print",
            "after_move:filepath",

            "-o",
            outputTemplate,

            job.url

        ];

    }


    /* =====================================================
       INFORMACIÓN INICIAL
    ===================================================== */

    emit(
        job,
        "log",
        {

            message:
                "Iniciando yt-dlp."

        }
    );


    emit(
        job,
        "log",
        {

            message:
                `yt-dlp: ${ytdlp}`

        }
    );


    emit(
        job,
        "log",
        {

            message:
                `FFmpeg: ${ffmpeg}`

        }
    );


    emit(
        job,
        "log",
        {

            message:
                `Deno: ${deno}`

        }
    );


    emit(
        job,
        "log",
        {

            message:
                `Plataforma detectada: ${job.platform}`

        }
    );


    emit(
        job,
        "log",
        {

            message:
                `Formato: ${job.format}`

        }
    );


    if (
        job.format === "mp4"
    ) {

        emit(
            job,
            "log",
            {

                message:
                    `Resolución: ${job.resolution === "best"
                        ? "Mejor disponible"
                        : `${job.resolution}p`
                    }`

            }
        );

    }


    if (
        job.format === "mp3"
    ) {

        emit(
            job,
            "log",
            {

                message:
                    `Calidad de audio: ${job.audioQuality} kbps`

            }
        );

    }


    emit(
        job,
        "log",
        {

            message:
                `Parámetros de yt-dlp: ${args.join(" ")}`

        }
    );


    /* =====================================================
       EJECUTAR YT-DLP
    ===================================================== */

    const child =
        spawn(
            ytdlp,
            args,
            {

                cwd:
                    BACKEND_DIR,

                env: {

                    ...process.env,

                    PATH:
                        [

                            path.dirname(
                                ytdlp
                            ),

                            path.dirname(
                                FFMPEG_PATH
                            ),

                            path.dirname(
                                deno
                            ),

                            process.env.PATH ||
                            ""

                        ]
                            .filter(
                                Boolean
                            )
                            .join(
                                path.delimiter
                            )

                },

                shell:
                    false,

                windowsHide:
                    true,

                stdio: [

                    "ignore",

                    "pipe",

                    "pipe"

                ]

            }
        );


    job.process =
        child;


    let stdoutBuffer =
        "";

    let stderrBuffer =
        "";


    /* =====================================================
       PROCESAR LÍNEA
    ===================================================== */

    function processLine(
        rawLine,
        source
    ) {

        const line =
            String(
                rawLine
            )
                .replace(
                    /\r$/g,
                    ""
                )
                .trim();


        if (!line) {

            return;

        }


        /* =================================================
           PROGRESO
        ================================================= */

        const progress =
            parseProgress(
                line
            );


        if (
            progress
        ) {

            /*
                Calculamos el progreso general
                ANTES de enviarlo al frontend.
            */

            const overallProgress =
                calculateOverallProgress(
                    job,
                    progress.percent
                );


            /*
                Nunca permitimos retroceder.
            */

            const previousProgress =
                Number(
                    job.progress?.percent ||
                    0
                );


            const safeProgress =
                Math.max(
                    previousProgress,
                    overallProgress
                );


            job.progress = {

                percent:
                    safeProgress,

                total:
                    progress.total,

                speed:
                    progress.speed,

                eta:
                    progress.eta

            };


            /*
                Ahora el SSE recibe el progreso
                GENERAL, no el porcentaje interno
                de yt-dlp.
            */

            emit(
                job,
                "progress",
                {

                    percent:
                        safeProgress,

                    total:
                        progress.total,

                    speed:
                        progress.speed,

                    eta:
                        progress.eta

                }
            );


            /*
                No agregamos los porcentajes
                a los logs normales.
            */

            return;

        }


        /* =================================================
           LOG NORMAL
        ================================================= */

        emit(
            job,
            "log",
            {

                message:
                    line,

                source

            }
        );


        /* =================================================
           ERRORES 403
        ================================================= */

        if (
            line.includes(
                "HTTP Error 403"
            ) ||
            line.includes(
                "Forbidden"
            )
        ) {

            job.error =
                "YouTube rechazó la solicitud con HTTP 403 Forbidden.";

        }


        /* =================================================
           DESTINATION
        ================================================= */

        if (
            line.includes(
                "Destination:"
            )
        ) {

            const match =
                line.match(
                    /Destination:\s*(.+)$/i
                );


            if (
                match
            ) {

                job.filename =
                    path.basename(
                        match[1].trim()
                    );

            }

        }


        /* =================================================
           YA DESCARGADO
        ================================================= */

        if (
            line.includes(
                "has already been downloaded"
            )
        ) {

            /*
                NO enviamos 100 aquí.

                El trabajo solamente debe llegar
                a 100 cuando realmente finalice.
            */

            job.progress = {

                ...job.progress,

                percent:
                    Math.max(
                        job.progress?.percent ||
                        0,
                        99.9
                    ),

                eta:
                    "00:00"

            };


            emit(
                job,
                "progress",
                job.progress
            );

        }


        /* =================================================
           ERROR YT-DLP
        ================================================= */

        if (
            line.startsWith(
                "ERROR:"
            )
        ) {

            job.error =
                line
                    .replace(
                        /^ERROR:\s*/i,
                        ""
                    )
                    .trim();

        }

    }


    /* =====================================================
       STDOUT
    ===================================================== */

    child.stdout.on(
        "data",
        chunk => {

            stdoutBuffer +=
                chunk.toString();


            const lines =
                stdoutBuffer.split(
                    /\r?\n/
                );


            stdoutBuffer =
                lines.pop() ||
                "";


            for (
                const line
                of lines
            ) {

                processLine(
                    line,
                    "stdout"
                );

            }

        }
    );


    /* =====================================================
       STDERR
    ===================================================== */

    child.stderr.on(
        "data",
        chunk => {

            stderrBuffer +=
                chunk.toString();


            const lines =
                stderrBuffer.split(
                    /\r?\n/
                );


            stderrBuffer =
                lines.pop() ||
                "";


            for (
                const line
                of lines
            ) {

                processLine(
                    line,
                    "stderr"
                );

            }

        }
    );


    /* =====================================================
       ERROR DEL PROCESO
    ===================================================== */

    child.on(
        "error",
        error => {

            if (
                job.status ===
                "cancelled"
            ) {

                return;

            }


            job.status =
                "error";


            job.error =
                error.message;


            emit(
                job,
                "error",
                {

                    message:
                        error.message

                }
            );

        }
    );


    /* =====================================================
       PROCESO TERMINADO
    ===================================================== */

    child.on(
        "close",
        code => {

            /*
                Procesar texto pendiente.
            */

            if (
                stdoutBuffer
            ) {

                processLine(
                    stdoutBuffer,
                    "stdout"
                );

            }


            if (
                stderrBuffer
            ) {

                processLine(
                    stderrBuffer,
                    "stderr"
                );

            }


            job.process =
                null;


            /* =================================================
               CANCELADO
            ================================================= */

            if (
                job.status ===
                "cancelled"
            ) {

                return;

            }


            /* =================================================
               ERROR
            ================================================= */

            if (
                code !== 0
            ) {

                job.status =
                    "error";


                if (
                    !job.error
                ) {

                    job.error =
                        `yt-dlp terminó con código ${code}.`;

                }


                emit(
                    job,
                    "error",
                    {

                        message:
                            job.error,

                        code

                    }
                );


                return;

            }


            /* =================================================
               BUSCAR ARCHIVO
            ================================================= */

            const filePath =
                findDownloadedFile(
                    job
                );


            if (!filePath) {

                job.status =
                    "error";


                job.error =
                    job.format === "mp3"

                        ? "yt-dlp terminó pero no se encontró el archivo MP3."

                        : "yt-dlp terminó pero no se encontró el archivo MP4.";


                emit(
                    job,
                    "error",
                    {

                        message:
                            job.error

                    }
                );


                return;

            }


            /* =================================================
               ARCHIVO ENCONTRADO
            ================================================= */

            job.filename =
                path.basename(
                    filePath
                );


            /*
                AQUÍ es donde realmente terminó
                toda la descarga.
            */

            job.status =
                "completed";


            job.progress = {

                percent:
                    100,

                total:
                    job.progress?.total ||
                    null,

                speed:
                    job.progress?.speed ||
                    null,

                eta:
                    "00:00"

            };


            /*
                Ahora sí enviamos 100%.
            */

            emit(
                job,
                "progress",
                job.progress
            );


            emit(
                job,
                "completed",
                {

                    message:
                        "Descarga completada.",

                    filename:
                        job.filename

                }
            );

        }
    );


    return true;

}


/* =========================================================
   CANCELAR
========================================================= */

export function cancelJob(
    id
) {

    const job =
        jobs.get(
            id
        );


    if (!job) {

        return false;

    }


    if (
        job.status ===
        "completed" ||

        job.status ===
        "error" ||

        job.status ===
        "cancelled"
    ) {

        return false;

    }


    job.status =
        "cancelled";


    if (
        job.process
    ) {

        try {

            job.process.kill(
                "SIGTERM"
            );

        } catch {

            // Ignorar

        }

    }


    emit(
        job,
        "cancelled",
        {

            message:
                "Descarga cancelada."

        }
    );


    return true;

}


/* =========================================================
   ARCHIVO FINAL
========================================================= */

export function getFilePath(
    id
) {

    const job =
        jobs.get(
            id
        );


    if (!job) {

        return null;

    }


    if (
        job.status !==
        "completed"
    ) {

        return null;

    }


    return findDownloadedFile(
        job
    );

}


/* =========================================================
   LIMPIEZA
========================================================= */

export function cleanupOldJobs(
    maxAgeMs =
        1000 *
        60 *
        60 *
        6
) {

    const nowMs =
        Date.now();


    for (
        const [
            id,
            job
        ]
        of jobs.entries()
    ) {

        const created =
            new Date(
                job.createdAt
            ).getTime();


        if (
            nowMs -
            created <
            maxAgeMs
        ) {

            continue;

        }


        if (
            job.process
        ) {

            try {

                job.process.kill(
                    "SIGTERM"
                );

            } catch {

                // Ignorar

            }

        }


        try {

            fs.rmSync(
                job.directory,
                {

                    recursive:
                        true,

                    force:
                        true

                }
            );

        } catch {

            // Ignorar

        }


        jobs.delete(
            id
        );

    }

}