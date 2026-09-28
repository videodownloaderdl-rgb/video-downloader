import express from "express";

import {
    createDownloadController,
    getDownloadStatusController,
    getDownloadEventsController,
    cancelDownloadController,
    downloadFileController,
    getVideoInfoController
} from "../controllers/downloader.controller.js";


const router =
    express.Router();


/*
    Analizar URL antes de descargar
*/
router.post(
    "/download/info",
    getVideoInfoController
);


/*
    Crear descarga
*/
router.post(
    "/download",
    createDownloadController
);


/*
    Consultar estado
*/
router.get(
    "/download/:id",
    getDownloadStatusController
);


/*
    Progreso SSE
*/
router.get(
    "/download/:id/events",
    getDownloadEventsController
);


/*
    Cancelar
*/
router.post(
    "/download/:id/cancel",
    cancelDownloadController
);


/*
    Descargar archivo terminado
*/
router.get(
    "/download/:id/file",
    downloadFileController
);


export default router;