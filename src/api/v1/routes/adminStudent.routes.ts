import { Router } from 'express';
import * as controller from '../../../controllers/studentAdminController';
import { authenticate, requirePermission } from '../../../middleware/auth';

export const adminStudentRouter = Router();

adminStudentRouter.use(authenticate);
adminStudentRouter.get('/students', requirePermission('student.view'), controller.searchStudents);
