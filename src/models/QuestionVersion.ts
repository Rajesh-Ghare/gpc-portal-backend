import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class QuestionVersion extends Model<InferAttributes<QuestionVersion>, InferCreationAttributes<QuestionVersion>> {
  declare id: CreationOptional<string>;
  declare questionId: string;
  declare versionNumber: number;
  declare explanation: string | null;
  declare solutionSteps: string | null;
  declare marks: string | null;
  declare negativeMarks: string | null;
  declare metadata: CreationOptional<Record<string, unknown>>;
  declare createdBy: string;
  declare createdAt: CreationOptional<Date>;

  static associate(models: {
    Question: typeof import('./Question').Question;
    QuestionTranslation: typeof import('./QuestionTranslation').QuestionTranslation;
    QuestionOption: typeof import('./QuestionOption').QuestionOption;
  }) {
    QuestionVersion.belongsTo(models.Question, { foreignKey: 'questionId', as: 'question' });
    QuestionVersion.hasMany(models.QuestionTranslation, { foreignKey: 'questionVersionId', as: 'translations' });
    QuestionVersion.hasMany(models.QuestionOption, { foreignKey: 'questionVersionId', as: 'options' });
  }
}

export function initQuestionVersion(sequelize: Sequelize) {
  QuestionVersion.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      questionId: { type: DataTypes.UUID, allowNull: false },
      versionNumber: { type: DataTypes.INTEGER, allowNull: false },
      explanation: { type: DataTypes.TEXT, allowNull: true },
      solutionSteps: { type: DataTypes.TEXT, allowNull: true },
      marks: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      negativeMarks: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdBy: { type: DataTypes.UUID, allowNull: false },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'question_versions',
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );
}
