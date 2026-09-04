import { Router, type IRouter } from "express";
import healthRouter from "./health";
import eventsRouter from "./events";
import duplicatesRouter from "./duplicates.js";
import telegramRouter from "./telegram";
import directionsRouter from "./directions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eventsRouter);
router.use(duplicatesRouter);
router.use(telegramRouter);
router.use(directionsRouter);

export default router;
