import { Router, type IRouter } from "express";
import healthRouter from "./health";
import eventsRouter from "./events";
import duplicatesRouter from "./duplicates.js";
import telegramRouter from "./telegram";
import directionsRouter from "./directions";
import puntiInteresseRouter from "./punti-interesse";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eventsRouter);
router.use(duplicatesRouter);
router.use(telegramRouter);
router.use(directionsRouter);
router.use(puntiInteresseRouter);

export default router;
