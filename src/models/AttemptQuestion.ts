import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class AttemptQuestion extends Model<InferAttributes<AttemptQuestion>, InferCreationAttributes<AttemptQuestion>> {
  declare id: CreationOptional<string>;
  declare attemptId: string;
  declare questionId: string;
  declare questionVersionId: string;
  declare sectionId: string | null;
  declare sequenceNumber: number;
  declare marks: string;
  declare negativeMarks: CreationOptional<string>;
  declare visitedAt: Date | null;
  declare answeredAt: Date | null;
  declare markedForReview: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static associate(models: {
    Attempt: typeof import('./Attempt').Attempt;
    Question: typeof import('./Question').Question;
    QuestionVersion: typeof import('./QuestionVersion').QuestionVersion;
    TestSection: typeof import('./TestSection').TestSection;
    AttemptAnswer: typeof import('./AttemptAnswer').AttemptAnswer;
  }) {
    AttemptQuestion.belongsTo(models.Attempt, { foreignKey: 'attemptId', as: 'attempt' });
    AttemptQuestion.belongsTo(models.Question, { foreignKey: 'questionId', as: 'question' });
    AttemptQuestion.belongsTo(models.QuestionVersion, { foreignKey: 'questionVersionId', as: 'questionVersion' });
    AttemptQuestion.belongsTo(models.TestSection, { foreignKey: 'sectionId', as: 'section' });
    AttemptQuestion.hasOne(models.AttemptAnswer, { foreignKey: 'attemptQuestionId', as: 'answer' });
  }
}

export function initAttemptQuestion(sequelize: Sequelize) {
  AttemptQuestion.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      attemptId: { type: DataTypes.UUID, allowNull: false },
      questionId: { type: DataTypes.UUID, allowNull: false },
      questionVersionId: { type: DataTypes.UUID, allowNull: false },
      sectionId: { type: DataTypes.UUID, allowNull: true },
      sequenceNumber: { type: DataTypes.INTEGER, allowNull: false },
      marks: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      negativeMarks: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      visitedAt: { type: DataTypes.DATE, allowNull: true },
      answeredAt: { type: DataTypes.DATE, allowNull: true },
      markedForReview: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'attempt_questions',
      underscored: true,
      timestamps: true,
    },
  );
}
