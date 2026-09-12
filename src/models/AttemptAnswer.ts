import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class AttemptAnswer extends Model<InferAttributes<AttemptAnswer>, InferCreationAttributes<AttemptAnswer>> {
  declare id: CreationOptional<string>;
  declare attemptId: string;
  declare attemptQuestionId: string;
  declare selectedOptionId: string | null;
  declare answerText: string | null;
  declare numericAnswer: string | null;
  declare isMarkedForReview: CreationOptional<boolean>;
  declare answeredAt: Date | null;
  declare lastSavedAt: Date | null;
  declare metadata: CreationOptional<Record<string, unknown>>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static associate(models: {
    Attempt: typeof import('./Attempt').Attempt;
    AttemptQuestion: typeof import('./AttemptQuestion').AttemptQuestion;
    QuestionOption: typeof import('./QuestionOption').QuestionOption;
  }) {
    AttemptAnswer.belongsTo(models.Attempt, { foreignKey: 'attemptId', as: 'attempt' });
    AttemptAnswer.belongsTo(models.AttemptQuestion, { foreignKey: 'attemptQuestionId', as: 'attemptQuestion' });
    AttemptAnswer.belongsTo(models.QuestionOption, { foreignKey: 'selectedOptionId', as: 'selectedOption' });
  }
}

export function initAttemptAnswer(sequelize: Sequelize) {
  AttemptAnswer.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      attemptId: { type: DataTypes.UUID, allowNull: false },
      attemptQuestionId: { type: DataTypes.UUID, allowNull: false },
      selectedOptionId: { type: DataTypes.UUID, allowNull: true },
      answerText: { type: DataTypes.TEXT, allowNull: true },
      numericAnswer: { type: DataTypes.DECIMAL(18, 4), allowNull: true },
      isMarkedForReview: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      answeredAt: { type: DataTypes.DATE, allowNull: true },
      lastSavedAt: { type: DataTypes.DATE, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'attempt_answers',
      underscored: true,
      timestamps: true,
    },
  );
}
