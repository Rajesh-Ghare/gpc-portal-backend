import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
  Sequelize,
} from 'sequelize';
import type { AttemptQuestion } from './AttemptQuestion';
import type { User } from './User';
import type { Test } from './Test';

export class Attempt extends Model<InferAttributes<Attempt>, InferCreationAttributes<Attempt>> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare testId: string;
  declare attemptNumber: number;
  declare status: CreationOptional<string>;
  declare startedAt: Date;
  declare expiresAt: Date;
  declare submittedAt: Date | null;
  declare autoSubmitted: CreationOptional<boolean>;
  declare languageCode: CreationOptional<string>;
  declare totalQuestions: CreationOptional<number>;
  declare totalMarks: CreationOptional<string>;
  declare ipAddress: string | null;
  declare userAgent: string | null;
  declare metadata: CreationOptional<Record<string, unknown>>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare attemptQuestions?: NonAttribute<AttemptQuestion[]>;
  declare user?: NonAttribute<User>;
  declare test?: NonAttribute<Test>;

  static associate(models: {
    User: typeof import('./User').User;
    Test: typeof import('./Test').Test;
    AttemptQuestion: typeof import('./AttemptQuestion').AttemptQuestion;
    Result: typeof import('./Result').Result;
  }) {
    Attempt.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Attempt.belongsTo(models.Test, { foreignKey: 'testId', as: 'test' });
    Attempt.hasMany(models.AttemptQuestion, { foreignKey: 'attemptId', as: 'attemptQuestions' });
    Attempt.hasOne(models.Result, { foreignKey: 'attemptId', as: 'result' });
  }
}

export function initAttempt(sequelize: Sequelize) {
  Attempt.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false },
      testId: { type: DataTypes.UUID, allowNull: false },
      attemptNumber: { type: DataTypes.INTEGER, allowNull: false },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'IN_PROGRESS' },
      startedAt: { type: DataTypes.DATE, allowNull: false },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      submittedAt: { type: DataTypes.DATE, allowNull: true },
      autoSubmitted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      languageCode: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'en' },
      totalQuestions: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      totalMarks: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      ipAddress: { type: DataTypes.STRING(45), allowNull: true },
      userAgent: { type: DataTypes.TEXT, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'attempts',
      underscored: true,
      timestamps: true,
    },
  );
}
