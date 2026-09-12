import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class QuestionOptionTranslation extends Model<
  InferAttributes<QuestionOptionTranslation>,
  InferCreationAttributes<QuestionOptionTranslation>
> {
  declare id: CreationOptional<string>;
  declare questionOptionId: string;
  declare languageCode: string;
  declare optionText: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static associate(models: { QuestionOption: typeof import('./QuestionOption').QuestionOption }) {
    QuestionOptionTranslation.belongsTo(models.QuestionOption, {
      foreignKey: 'questionOptionId',
      as: 'questionOption',
    });
  }
}

export function initQuestionOptionTranslation(sequelize: Sequelize) {
  QuestionOptionTranslation.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      questionOptionId: { type: DataTypes.UUID, allowNull: false },
      languageCode: { type: DataTypes.STRING(10), allowNull: false },
      optionText: { type: DataTypes.TEXT, allowNull: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'question_option_translations',
      underscored: true,
      timestamps: true,
    },
  );
}
