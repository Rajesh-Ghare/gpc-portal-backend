import { sequelize } from '../config/database';

import { User, initUser } from './User';
import { Role, initRole } from './Role';
import { Permission, initPermission } from './Permission';
import { UserRole, initUserRole } from './UserRole';
import { RolePermission, initRolePermission } from './RolePermission';
import { OtpRequest, initOtpRequest } from './OtpRequest';
import { Session, initSession } from './Session';

import { ExamCategory, initExamCategory } from './ExamCategory';
import { CompetitiveExam, initCompetitiveExam } from './CompetitiveExam';
import { TestSeries, initTestSeries } from './TestSeries';
import { Test, initTest } from './Test';
import { TestSection, initTestSection } from './TestSection';

import { Subject, initSubject } from './Subject';
import { Topic, initTopic } from './Topic';
import { Question, initQuestion } from './Question';
import { QuestionVersion, initQuestionVersion } from './QuestionVersion';
import { QuestionTranslation, initQuestionTranslation } from './QuestionTranslation';
import { QuestionOption, initQuestionOption } from './QuestionOption';
import { QuestionOptionTranslation, initQuestionOptionTranslation } from './QuestionOptionTranslation';
import { Tag, initTag } from './Tag';
import { QuestionTag, initQuestionTag } from './QuestionTag';

import { TestQuestion, initTestQuestion } from './TestQuestion';
import { TestRule, initTestRule } from './TestRule';
import { TestRuleTag, initTestRuleTag } from './TestRuleTag';

import { Attempt, initAttempt } from './Attempt';
import { AttemptQuestion, initAttemptQuestion } from './AttemptQuestion';
import { AttemptAnswer, initAttemptAnswer } from './AttemptAnswer';

import { Result, initResult } from './Result';
import { ResultDetail, initResultDetail } from './ResultDetail';

import { Product, initProduct } from './Product';
import { ProductPrice, initProductPrice } from './ProductPrice';
import { ProductItem, initProductItem } from './ProductItem';
import { Order, initOrder } from './Order';
import { OrderItem, initOrderItem } from './OrderItem';
import { Payment, initPayment } from './Payment';
import { PaymentWebhookEvent, initPaymentWebhookEvent } from './PaymentWebhookEvent';
import { Entitlement, initEntitlement } from './Entitlement';

import { AiGenerationJob, initAiGenerationJob } from './AiGenerationJob';
import { AiGenerationItem, initAiGenerationItem } from './AiGenerationItem';

import { AuditLog, initAuditLog } from './AuditLog';
import { SystemSetting, initSystemSetting } from './SystemSetting';

initUser(sequelize);
initRole(sequelize);
initPermission(sequelize);
initUserRole(sequelize);
initRolePermission(sequelize);
initOtpRequest(sequelize);
initSession(sequelize);

initExamCategory(sequelize);
initCompetitiveExam(sequelize);
initTestSeries(sequelize);
initTest(sequelize);
initTestSection(sequelize);

initSubject(sequelize);
initTopic(sequelize);
initQuestion(sequelize);
initQuestionVersion(sequelize);
initQuestionTranslation(sequelize);
initQuestionOption(sequelize);
initQuestionOptionTranslation(sequelize);
initTag(sequelize);
initQuestionTag(sequelize);

initTestQuestion(sequelize);
initTestRule(sequelize);
initTestRuleTag(sequelize);

initAttempt(sequelize);
initAttemptQuestion(sequelize);
initAttemptAnswer(sequelize);

initResult(sequelize);
initResultDetail(sequelize);

initProduct(sequelize);
initProductPrice(sequelize);
initProductItem(sequelize);
initOrder(sequelize);
initOrderItem(sequelize);
initPayment(sequelize);
initPaymentWebhookEvent(sequelize);
initEntitlement(sequelize);

initAiGenerationJob(sequelize);
initAiGenerationItem(sequelize);

initAuditLog(sequelize);
initSystemSetting(sequelize);

const models = {
  User,
  Role,
  Permission,
  UserRole,
  RolePermission,
  OtpRequest,
  Session,
  ExamCategory,
  CompetitiveExam,
  TestSeries,
  Test,
  TestSection,
  Subject,
  Topic,
  Question,
  QuestionVersion,
  QuestionTranslation,
  QuestionOption,
  QuestionOptionTranslation,
  Tag,
  QuestionTag,
  TestQuestion,
  TestRule,
  TestRuleTag,
  Attempt,
  AttemptQuestion,
  AttemptAnswer,
  Result,
  ResultDetail,
  Product,
  ProductPrice,
  ProductItem,
  Order,
  OrderItem,
  Payment,
  PaymentWebhookEvent,
  Entitlement,
  AiGenerationJob,
  AiGenerationItem,
  AuditLog,
  SystemSetting,
};

User.associate(models);
Role.associate(models);
Permission.associate(models);
Session.associate(models);
ExamCategory.associate(models);
CompetitiveExam.associate(models);
TestSeries.associate(models);
Test.associate(models);
TestSection.associate(models);
Subject.associate(models);
Topic.associate(models);
Question.associate(models);
QuestionVersion.associate(models);
QuestionTranslation.associate(models);
QuestionOption.associate(models);
QuestionOptionTranslation.associate(models);
Tag.associate(models);
TestQuestion.associate(models);
TestRule.associate(models);
Attempt.associate(models);
AttemptQuestion.associate(models);
AttemptAnswer.associate(models);
Result.associate(models);
ResultDetail.associate(models);
Product.associate(models);
ProductPrice.associate(models);
ProductItem.associate(models);
Order.associate(models);
OrderItem.associate(models);
Payment.associate(models);
Entitlement.associate(models);
AiGenerationJob.associate(models);
AiGenerationItem.associate(models);
AuditLog.associate(models);

export {
  sequelize,
  User,
  Role,
  Permission,
  UserRole,
  RolePermission,
  OtpRequest,
  Session,
  ExamCategory,
  CompetitiveExam,
  TestSeries,
  Test,
  TestSection,
  Subject,
  Topic,
  Question,
  QuestionVersion,
  QuestionTranslation,
  QuestionOption,
  QuestionOptionTranslation,
  Tag,
  QuestionTag,
  TestQuestion,
  TestRule,
  TestRuleTag,
  Attempt,
  AttemptQuestion,
  AttemptAnswer,
  Result,
  ResultDetail,
  Product,
  ProductPrice,
  ProductItem,
  Order,
  OrderItem,
  Payment,
  PaymentWebhookEvent,
  Entitlement,
  AiGenerationJob,
  AiGenerationItem,
  AuditLog,
  SystemSetting,
};
export default models;
