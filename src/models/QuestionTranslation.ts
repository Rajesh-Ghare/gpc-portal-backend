import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class QuestionTranslation extends Model<
  InferAttributes<QuestionTranslation>,
  InferCreationAttributes<QuestionTranslation>
> {
  declare id: CreationOptional<string>;
  declare questionVersionId: string;
  declare languageCode: string;
  declare questionText: string;
  declare explanation: string | null;
  declare solutionSteps: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static associate(models: { QuestionVersion: typeof import('./QuestionVersion').QuestionVersion }) {
    QuestionTranslation.belongsTo(models.QuestionVersion, { foreignKey: 'questionVersionId', as: 'questionVersion' });
  }
}

export function initQuestionTranslation(sequelize: Sequelize) {
  QuestionTranslation.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      questionVersionId: { type: DataTypes.UUID, allowNull: false },
      languageCode: { type: DataTypes.STRING(10), allowNull: false },
      questionText: { type: DataTypes.TEXT, allowNull: false },
      explanation: { type: DataTypes.TEXT, allowNull: true },
      solutionSteps: { type: DataTypes.TEXT, allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'question_translations',
      underscored: true,
      timestamps: true,
    },
  );
}
