import HyperExpress from 'hyper-express';
import { authRouter } from './auth/authRouter.js';

const router = new HyperExpress.Router();

router.use('/auth', authRouter);
export const apiRouter = router;
