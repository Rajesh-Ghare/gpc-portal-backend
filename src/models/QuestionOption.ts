import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class QuestionOption extends Model<InferAttributes<QuestionOption>, InferCreationAttributes<QuestionOption>> {
  declare id: CreationOptional<string>;
  declare questionVersionId: string;
  declare optionKey: string;
  declare displayOrder: CreationOptional<number>;
  declare isCorrect: CreationOptional<boolean>;
  declare numericValue: string | null;
  declare metadata: CreationOptional<Record<string, unknown>>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static associate(models: {
    QuestionVersion: typeof import('./QuestionVersion').QuestionVersion;
    QuestionOptionTranslation: typeof import('./QuestionOptionTranslation').QuestionOptionTranslation;
  }) {
    QuestionOption.belongsTo(models.QuestionVersion, { foreignKey: 'questionVersionId', as: 'questionVersion' });
    QuestionOption.hasMany(models.QuestionOptionTranslation, { foreignKey: 'questionOptionId', as: 'translations' });
  }
}

export function initQuestionOption(sequelize: Sequelize) {
  QuestionOption.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      questionVersionId: { type: DataTypes.UUID, allowNull: false },
      optionKey: { type: DataTypes.STRING(10), allowNull: false },
      displayOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isCorrect: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      numericValue: { type: DataTypes.DECIMAL(18, 4), allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'question_options',
      underscored: true,
      timestamps: true,
    },
  );
}
