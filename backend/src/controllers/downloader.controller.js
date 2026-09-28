import {
    createJob,
    startJob,
    getJob,
    cancelJob,
    getFilePath,
    getVideoInfo
} from "../services/downloader.service.js";


/* =========================================================
   ANALIZAR VIDEO
========================================================= */

export async function getVideoInfoController(
    req,
    res
) {

    try {

        const {
            url
        } = req.body || {};


        if (!url) {

            return res.status(
                400
            ).json({

                success:
                    false,

                error:
                    "Pega una URL."

            });

        }


        const info =
            await getVideoInfo(
                url
            );


        return res.json({

            success:
                true,

            video:
                info

        });

    } catch (
    error
    ) {

        return res.status(
            400
        ).json({

            success:
                false,

            error:
                error.message

        });

    }

}


/* =========================================================
   CREAR DESCARGA
========================================================= */

export function createDownloadController(
    req,
    res
) {

    try {

        const {

            url,

            format =
            "mp4",

            resolution =
            "best",

            audioQuality =
            "192"

        } = req.body || {};


        if (!url) {

            return res.status(
                400
            ).json({

                success:
                    false,

                error:
                    "Pega una URL."

            });

        }


        if (
            ![
                "mp4",
                "mp3"
            ].includes(
                format
            )
        ) {

            return res.status(
                400
            ).json({

                success:
                    false,

                error:
                    "Formato no válido."

            });

        }


        const job =
            createJob(
                url,
                {

                    format,

                    resolution,

                    audioQuality

                }
            );


        startJob(
            job.id
        );


        return res.status(
            202
        ).json({

            success:
                true,

            job: {

                id:
                    job.id,

                platform:
                    job.platform,

                status:
                    job.status,

                format:
                    job.format,

                resolution:
                    job.resolution,

                audioQuality:
                    job.audioQuality

            }

        });

    } catch (
    error
    ) {

        return res.status(
            400
        ).json({

            success:
                false,

            error:
                error.message

        });

    }

}


/* =========================================================
   ESTADO
========================================================= */

export function getDownloadStatusController(
    req,
    res
) {

    const job =
        getJob(
            req.params.id
        );


    if (!job) {

        return res.status(
            404
        ).json({

            success:
                false,

            error:
                "Descarga no encontrada."

        });

    }


    return res.json({

        success:
            true,

        job: {

            id:
                job.id,

            platform:
                job.platform,

            status:
                job.status,

            format:
                job.format,

            resolution:
                job.resolution,

            audioQuality:
                job.audioQuality,

            progress:
                job.progress,

            title:
                job.title,

            filename:
                job.filename,

            error:
                job.error,

            updatedAt:
                job.events.at(-1)
                    ?.time ||
                job.createdAt

        }

    });

}


/* =========================================================
   SSE
========================================================= */

export function getDownloadEventsController(
    req,
    res
) {

    const job =
        getJob(
            req.params.id
        );


    if (!job) {

        return res.status(
            404
        ).end();

    }


    res.setHeader(
        "Content-Type",
        "text/event-stream"
    );


    res.setHeader(
        "Cache-Control",
        "no-cache, no-transform"
    );


    res.setHeader(
        "Connection",
        "keep-alive"
    );


    res.setHeader(
        "X-Accel-Buffering",
        "no"
    );


    if (
        typeof res.flushHeaders ===
        "function"
    ) {

        res.flushHeaders();

    }


    let lastIndex =
        0;


    const timer =
        setInterval(
            () => {

                const events =
                    job.events.slice(
                        lastIndex
                    );


                for (
                    const event
                    of events
                ) {

                    res.write(
                        `data: ${JSON.stringify(event)}\n\n`
                    );

                }


                lastIndex =
                    job.events.length;


                if (
                    [
                        "completed",
                        "error",
                        "cancelled"
                    ].includes(
                        job.status
                    )
                ) {

                    clearInterval(
                        timer
                    );


                    res.end();

                }

            },
            200
        );


    req.on(
        "close",
        () => {

            clearInterval(
                timer
            );

        }
    );

}


/* =========================================================
   CANCELAR
========================================================= */

export function cancelDownloadController(
    req,
    res
) {

    const ok =
        cancelJob(
            req.params.id
        );


    if (!ok) {

        return res.status(
            404
        ).json({

            success:
                false,

            error:
                "Descarga no encontrada o ya terminó."

        });

    }


    return res.json({

        success:
            true

    });

}


/* =========================================================
   ARCHIVO
========================================================= */

export function downloadFileController(
    req,
    res
) {

    const filePath =
        getFilePath(
            req.params.id
        );


    if (!filePath) {

        return res.status(
            404
        ).json({

            success:
                false,

            error:
                "El archivo todavía no está disponible."

        });

    }


    return res.download(
        filePath
    );

}