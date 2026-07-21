import { Router, type IRouter } from "express";
import healthRouter from "./health";
import eventsRouter from "./events";
import duplicatesRouter from "./duplicates.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eventsRouter);
router.use(duplicatesRouter);

export default router;
