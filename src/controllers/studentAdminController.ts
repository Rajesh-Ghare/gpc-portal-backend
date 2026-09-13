import type { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import * as studentService from '../services/studentService';

export async function searchStudents(req: Request, res: Response) {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const students = await studentService.searchStudents(search);
  sendSuccess(
    res,
    students.map((u) => ({ id: u.id, mobileNumber: u.mobileNumber, fullName: u.fullName, status: u.status })),
  );
}
