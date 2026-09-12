import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class ResultDetail extends Model<InferAttributes<ResultDetail>, InferCreationAttributes<ResultDetail>> {
  declare id: CreationOptional<string>;
  declare resultId: string;
  declare attemptQuestionId: string;
  declare questionId: string;
  declare questionVersionId: string;
  declare selectedOptionId: string | null;
  declare correctOptionId: string | null;
  declare answerStatus: string;
  declare marksAwarded: CreationOptional<string>;
  declare negativeMarksAwarded: CreationOptional<string>;
  declare finalMarks: CreationOptional<string>;
  declare evaluatorType: CreationOptional<string>;
  declare evaluatorNotes: string | null;
  declare createdAt: CreationOptional<Date>;

  static associate(models: {
    Result: typeof import('./Result').Result;
    AttemptQuestion: typeof import('./AttemptQuestion').AttemptQuestion;
    Question: typeof import('./Question').Question;
    QuestionVersion: typeof import('./QuestionVersion').QuestionVersion;
  }) {
    ResultDetail.belongsTo(models.Result, { foreignKey: 'resultId', as: 'result' });
    ResultDetail.belongsTo(models.AttemptQuestion, { foreignKey: 'attemptQuestionId', as: 'attemptQuestion' });
    ResultDetail.belongsTo(models.Question, { foreignKey: 'questionId', as: 'question' });
    ResultDetail.belongsTo(models.QuestionVersion, { foreignKey: 'questionVersionId', as: 'questionVersion' });
  }
}

export function initResultDetail(sequelize: Sequelize) {
  ResultDetail.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      resultId: { type: DataTypes.UUID, allowNull: false },
      attemptQuestionId: { type: DataTypes.UUID, allowNull: false },
      questionId: { type: DataTypes.UUID, allowNull: false },
      questionVersionId: { type: DataTypes.UUID, allowNull: false },
      selectedOptionId: { type: DataTypes.UUID, allowNull: true },
      correctOptionId: { type: DataTypes.UUID, allowNull: true },
      answerStatus: { type: DataTypes.STRING(20), allowNull: false },
      marksAwarded: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      negativeMarksAwarded: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      finalMarks: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      evaluatorType: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'AUTO' },
      evaluatorNotes: { type: DataTypes.TEXT, allowNull: true },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'result_details',
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );
}
