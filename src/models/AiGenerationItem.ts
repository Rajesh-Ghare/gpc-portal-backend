import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class AiGenerationItem extends Model<InferAttributes<AiGenerationItem>, InferCreationAttributes<AiGenerationItem>> {
  declare id: CreationOptional<string>;
  declare jobId: string;
  declare questionId: string | null;
  declare status: CreationOptional<string>;
  declare rawOutput: CreationOptional<Record<string, unknown>>;
  declare validationErrors: CreationOptional<unknown[]>;
  declare duplicateMatchQuestionId: string | null;
  declare reviewedBy: string | null;
  declare reviewedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static associate(models: {
    AiGenerationJob: typeof import('./AiGenerationJob').AiGenerationJob;
    Question: typeof import('./Question').Question;
  }) {
    AiGenerationItem.belongsTo(models.AiGenerationJob, { foreignKey: 'jobId', as: 'job' });
    AiGenerationItem.belongsTo(models.Question, { foreignKey: 'questionId', as: 'question' });
    AiGenerationItem.belongsTo(models.Question, {
      foreignKey: 'duplicateMatchQuestionId',
      as: 'duplicateMatchQuestion',
    });
  }
}

export function initAiGenerationItem(sequelize: Sequelize) {
  AiGenerationItem.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      jobId: { type: DataTypes.UUID, allowNull: false },
      questionId: { type: DataTypes.UUID, allowNull: true },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING' },
      rawOutput: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      validationErrors: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      duplicateMatchQuestionId: { type: DataTypes.UUID, allowNull: true },
      reviewedBy: { type: DataTypes.UUID, allowNull: true },
      reviewedAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'ai_generation_items',
      underscored: true,
      timestamps: true,
    },
  );
}
