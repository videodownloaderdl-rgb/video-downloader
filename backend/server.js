import "dotenv/config";

import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import {
    execFile
} from "node:child_process";
import {
    promisify
} from "node:util";

import downloaderRoutes
    from "./src/routes/downloader.routes.js";

import {
    cleanupOldJobs
} from "./src/services/downloader.service.js";


/* =====================================================
   UTILIDADES
===================================================== */

const execFileAsync =
    promisify(execFile);


const app =
    express();


/* =====================================================
   CONFIGURACIÓN
===================================================== */

const PORT =
    Number(
        process.env.PORT || 3001
    );


const NODE_ENV =
    process.env.NODE_ENV ||
    "development";


const isProduction =
    NODE_ENV === "production";


/*
    En producción puedes establecer:

    FRONTEND_URL=https://tudominio.com

    Para varios dominios:

    FRONTEND_URL=https://tudominio.com,https://www.tudominio.com
*/


const allowedOrigins =
    (
        process.env.FRONTEND_URL ||
        ""
    )
        .split(",")
        .map(
            origin =>
                origin.trim()
        )
        .filter(Boolean);


/* =====================================================
   RUTAS DE BINARIOS
===================================================== */

function getExecutable(name) {

    const executableName =
        process.platform === "win32"
            ? `${name}.exe`
            : name;


    /*
        Primero buscamos los binarios locales
        del proyecto.

        Esto es lo recomendado para producción.
    */

    const localPath =
        path.join(
            process.cwd(),
            "bin",
            executableName
        );


    if (
        fs.existsSync(
            localPath
        )
    ) {

        return localPath;

    }


    /*
        Compatibilidad con tu instalación
        actual mediante WinGet.

        Esto permite que el proyecto
        siga funcionando en tu PC.
    */

    if (
        process.platform === "win32" &&
        name === "yt-dlp"
    ) {

        const wingetPath =
            path.join(
                process.env.LOCALAPPDATA || "",
                "Microsoft",
                "WinGet",
                "Packages",
                "yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe",
                "yt-dlp.exe"
            );


        if (
            fs.existsSync(
                wingetPath
            )
        ) {

            return wingetPath;

        }

    }


    if (
        process.platform === "win32" &&
        name === "ffmpeg"
    ) {

        const wingetPath =
            path.join(
                process.env.LOCALAPPDATA || "",
                "Microsoft",
                "WinGet",
                "Packages",
                "yt-dlp.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe",
                "ffmpeg-N-125875-g5d4d3bdc61-win64-gpl",
                "bin",
                "ffmpeg.exe"
            );


        if (
            fs.existsSync(
                wingetPath
            )
        ) {

            return wingetPath;

        }

    }


    /*
        Finalmente intentamos utilizar
        el ejecutable disponible en PATH.
    */

    return executableName;
}


/* =====================================================
   CORS
===================================================== */

app.use(
    cors({
        origin: (
            origin,
            callback
        ) => {

            /*
                Permitir herramientas locales,
                Postman y peticiones sin Origin
                durante desarrollo.
            */

            if (
                !isProduction &&
                !origin
            ) {

                return callback(
                    null,
                    true
                );

            }


            if (
                !isProduction &&
                allowedOrigins.length === 0
            ) {

                return callback(
                    null,
                    true
                );

            }


            /*
                En producción solamente
                permitimos los dominios configurados.
            */

            if (
                allowedOrigins.includes(origin)
            ) {

                return callback(
                    null,
                    true
                );

            }


            /*
                También permitimos localhost
                para poder probar el backend.
            */

            if (
                origin?.startsWith(
                    "http://localhost:"
                ) ||
                origin?.startsWith(
                    "http://127.0.0.1:"
                )
            ) {

                return callback(
                    null,
                    true
                );

            }


            return callback(
                new Error(
                    "Origen no permitido por CORS."
                )
            );

        },

        methods: [
            "GET",
            "POST",
            "OPTIONS"
        ],

        allowedHeaders: [
            "Content-Type",
            "Accept"
        ]

    })
);


/* =====================================================
   MIDDLEWARE
===================================================== */

app.use(
    express.json({
        limit: "1mb"
    })
);


/*
    Si utilizamos Cloudflare, Nginx,
    Render, Railway, etc., Express podrá
    interpretar correctamente los proxies.
*/

app.set(
    "trust proxy",
    1
);


/* =====================================================
   HEALTH PRINCIPAL
===================================================== */

app.get(
    "/",
    (req, res) => {

        res.json({

            status: "ok",

            app: "Video Downloader",

            version: "1.0.0",

            environment:
                NODE_ENV

        });

    }
);


/* =====================================================
   HEALTH CHECK
===================================================== */

app.get(
    "/api/health",
    async (req, res) => {

        let ytDlp = false;
        let ffmpeg = false;


        let ytDlpPath = null;
        let ffmpegPath = null;


        /* =============================================
           YT-DLP
        ============================================= */

        try {

            ytDlpPath =
                getExecutable(
                    "yt-dlp"
                );


            await execFileAsync(
                ytDlpPath,
                [
                    "--version"
                ]
            );


            ytDlp = true;

        } catch (error) {

            console.error(
                "yt-dlp health error:",
                error.message
            );

        }


        /* =============================================
           FFMPEG
        ============================================= */

        try {

            ffmpegPath =
                getExecutable(
                    "ffmpeg"
                );


            await execFileAsync(
                ffmpegPath,
                [
                    "-version"
                ]
            );


            ffmpeg = true;

        } catch (error) {

            console.error(
                "FFmpeg health error:",
                error.message
            );

        }


        /*
            No enviamos las rutas internas
            de los ejecutables al navegador.
        */

        return res.json({

            success: true,

            ytDlp,

            ffmpeg,

            environment:
                NODE_ENV

        });

    }
);


/* =====================================================
   RUTAS DEL DESCARGADOR
===================================================== */

app.use(
    "/api",
    downloaderRoutes
);


/* =====================================================
   404
===================================================== */

app.use(
    (req, res) => {

        return res.status(404).json({

            success: false,

            error:
                "Ruta no encontrada."

        });

    }
);


/* =====================================================
   MANEJO GLOBAL DE ERRORES
===================================================== */

app.use(
    (
        err,
        req,
        res,
        next
    ) => {

        console.error(
            "SERVER ERROR:",
            err
        );


        if (
            res.headersSent
        ) {

            return next(err);

        }


        /*
            No mostramos detalles internos
            cuando estamos en producción.
        */

        return res.status(500).json({

            success: false,

            error:
                isProduction
                    ? "Error interno del servidor."
                    : (
                        err.message ||
                        "Error interno del servidor."
                    )

        });

    }
);


/* =====================================================
   LIMPIEZA DE TRABAJOS
===================================================== */

const cleanupInterval =
    setInterval(
        () => {

            try {

                cleanupOldJobs();

            } catch (error) {

                console.error(
                    "Cleanup error:",
                    error
                );

            }

        },
        10 * 60 * 1000
    );


/*
    No mantener el proceso vivo solamente
    por este intervalo.
*/

cleanupInterval.unref();


/* =====================================================
   SERVIDOR
===================================================== */

const server =
    app.listen(
        PORT,
        () => {

            console.log("");

            console.log(
                "=================================="
            );

            console.log(
                "          VIDEO DOWNLOADER"
            );

            console.log(
                "=================================="
            );

            console.log(
                `Environment: ${NODE_ENV}`
            );

            console.log(
                `Port: ${PORT}`
            );

            console.log("");

            console.log(
                "yt-dlp:",
                getExecutable(
                    "yt-dlp"
                )
            );

            console.log(
                "FFmpeg:",
                getExecutable(
                    "ffmpeg"
                )
            );

            console.log("");

        }
    );


/* =====================================================
   CIERRE CONTROLADO
===================================================== */

function shutdown(
    signal
) {

    console.log(
        `\nRecibida señal ${signal}. Cerrando servidor...`
    );


    clearInterval(
        cleanupInterval
    );


    server.close(
        () => {

            console.log(
                "Servidor cerrado correctamente."
            );

            process.exit(
                0
            );

        }
    );


    /*
        Evitar que el proceso quede
        bloqueado indefinidamente.
    */

    setTimeout(
        () => {

            console.error(
                "Cierre forzado."
            );

            process.exit(
                1
            );

        },
        10000
    ).unref();

}


process.on(
    "SIGINT",
    () => {
        shutdown("SIGINT");
    }
);


process.on(
    "SIGTERM",
    () => {
        shutdown("SIGTERM");
    }
);