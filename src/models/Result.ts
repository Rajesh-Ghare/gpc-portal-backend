import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class Result extends Model<InferAttributes<Result>, InferCreationAttributes<Result>> {
  declare id: CreationOptional<string>;
  declare attemptId: string;
  declare userId: string;
  declare testId: string;
  declare status: CreationOptional<string>;
  declare totalQuestions: CreationOptional<number>;
  declare attemptedQuestions: CreationOptional<number>;
  declare correctAnswers: CreationOptional<number>;
  declare incorrectAnswers: CreationOptional<number>;
  declare unansweredQuestions: CreationOptional<number>;
  declare totalMarks: CreationOptional<string>;
  declare scoredMarks: CreationOptional<string>;
  declare negativeMarks: CreationOptional<string>;
  declare percentage: string | null;
  declare accuracyPercentage: string | null;
  declare timeTakenSeconds: number | null;
  declare rank: number | null;
  declare percentile: string | null;
  declare evaluatedAt: Date | null;
  declare releasedAt: Date | null;
  declare evaluatedBy: string | null;
  declare metadata: CreationOptional<Record<string, unknown>>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static associate(models: {
    Attempt: typeof import('./Attempt').Attempt;
    User: typeof import('./User').User;
    Test: typeof import('./Test').Test;
    ResultDetail: typeof import('./ResultDetail').ResultDetail;
  }) {
    Result.belongsTo(models.Attempt, { foreignKey: 'attemptId', as: 'attempt' });
    Result.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Result.belongsTo(models.Test, { foreignKey: 'testId', as: 'test' });
    Result.hasMany(models.ResultDetail, { foreignKey: 'resultId', as: 'details' });
  }
}

export function initResult(sequelize: Sequelize) {
  Result.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      attemptId: { type: DataTypes.UUID, allowNull: false, unique: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      testId: { type: DataTypes.UUID, allowNull: false },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING' },
      totalQuestions: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      attemptedQuestions: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      correctAnswers: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      incorrectAnswers: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      unansweredQuestions: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      totalMarks: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      scoredMarks: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      negativeMarks: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      percentage: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      accuracyPercentage: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      timeTakenSeconds: { type: DataTypes.INTEGER, allowNull: true },
      rank: { type: DataTypes.INTEGER, allowNull: true },
      percentile: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      evaluatedAt: { type: DataTypes.DATE, allowNull: true },
      releasedAt: { type: DataTypes.DATE, allowNull: true },
      evaluatedBy: { type: DataTypes.UUID, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'results',
      underscored: true,
      timestamps: true,
    },
  );
}
