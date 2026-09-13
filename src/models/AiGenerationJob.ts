import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
  Sequelize,
} from 'sequelize';
import type { AiGenerationItem } from './AiGenerationItem';

export class AiGenerationJob extends Model<InferAttributes<AiGenerationJob>, InferCreationAttributes<AiGenerationJob>> {
  declare id: CreationOptional<string>;
  declare requestedBy: string;
  declare subjectId: string | null;
  declare topicId: string | null;
  declare competitiveExamId: string | null;
  declare questionType: string | null;
  declare difficulty: string | null;
  declare languageCode: CreationOptional<string>;
  declare requestedCount: number;
  declare generatedCount: CreationOptional<number>;
  declare approvedCount: CreationOptional<number>;
  declare failedCount: CreationOptional<number>;
  declare provider: string;
  declare model: string | null;
  declare promptVersion: string | null;
  declare status: CreationOptional<string>;
  declare errorMessage: string | null;
  declare startedAt: Date | null;
  declare completedAt: Date | null;
  declare configuration: CreationOptional<Record<string, unknown>>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare items?: NonAttribute<AiGenerationItem[]>;

  static associate(models: {
    User: typeof import('./User').User;
    Subject: typeof import('./Subject').Subject;
    Topic: typeof import('./Topic').Topic;
    CompetitiveExam: typeof import('./CompetitiveExam').CompetitiveExam;
    AiGenerationItem: typeof import('./AiGenerationItem').AiGenerationItem;
  }) {
    AiGenerationJob.belongsTo(models.User, { foreignKey: 'requestedBy', as: 'requester' });
    AiGenerationJob.belongsTo(models.Subject, { foreignKey: 'subjectId', as: 'subject' });
    AiGenerationJob.belongsTo(models.Topic, { foreignKey: 'topicId', as: 'topic' });
    AiGenerationJob.belongsTo(models.CompetitiveExam, { foreignKey: 'competitiveExamId', as: 'competitiveExam' });
    AiGenerationJob.hasMany(models.AiGenerationItem, { foreignKey: 'jobId', as: 'items' });
  }
}

export function initAiGenerationJob(sequelize: Sequelize) {
  AiGenerationJob.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      requestedBy: { type: DataTypes.UUID, allowNull: false },
      subjectId: { type: DataTypes.UUID, allowNull: true },
      topicId: { type: DataTypes.UUID, allowNull: true },
      competitiveExamId: { type: DataTypes.UUID, allowNull: true },
      questionType: { type: DataTypes.STRING(30), allowNull: true },
      difficulty: { type: DataTypes.STRING(20), allowNull: true },
      languageCode: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'en' },
      requestedCount: { type: DataTypes.INTEGER, allowNull: false },
      generatedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      approvedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      failedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      provider: { type: DataTypes.STRING(30), allowNull: false },
      model: { type: DataTypes.STRING(100), allowNull: true },
      promptVersion: { type: DataTypes.STRING(30), allowNull: true },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING' },
      errorMessage: { type: DataTypes.TEXT, allowNull: true },
      startedAt: { type: DataTypes.DATE, allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: true },
      configuration: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'ai_generation_jobs',
      underscored: true,
      timestamps: true,
    },
  );
}
