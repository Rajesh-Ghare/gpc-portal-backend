import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { authRouter } from './api/v1/routes/auth.routes';
import { catalogRouter } from './api/v1/routes/catalog.routes';
import { questionBankRouter } from './api/v1/routes/questionBank.routes';
import { testBuilderRouter } from './api/v1/routes/testBuilder.routes';
import { entitlementRouter } from './api/v1/routes/entitlement.routes';
import { studentRouter } from './api/v1/routes/student.routes';
import { adminExamRouter } from './api/v1/routes/adminExam.routes';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { sendSuccess } from './utils/apiResponse';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  if (env.nodeEnv !== 'test') {
    app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));
  }

  app.get('/health', (_req, res) => {
    sendSuccess(res, { status: 'ok' }, 'Service is healthy');
  });

  const apiRouter = express.Router();
  apiRouter.get('/', (_req, res) => {
    sendSuccess(res, { name: 'GPC Exam Portal API', version: 'v1' });
  });
  apiRouter.use('/auth', authRouter);
  apiRouter.use('/admin', catalogRouter);
  apiRouter.use('/admin', questionBankRouter);
  apiRouter.use('/admin', testBuilderRouter);
  apiRouter.use('/admin', entitlementRouter);
  apiRouter.use('/admin', adminExamRouter);
  apiRouter.use('/', studentRouter);
  app.use(env.apiBasePath, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
