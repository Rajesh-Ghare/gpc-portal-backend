import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class TestQuestion extends Model<InferAttributes<TestQuestion>, InferCreationAttributes<TestQuestion>> {
  declare id: CreationOptional<string>;
  declare testId: string;
  declare sectionId: string | null;
  declare questionId: string;
  declare questionVersionId: string;
  declare displayOrder: number;
  declare marks: string | null;
  declare negativeMarks: string | null;
  declare createdAt: CreationOptional<Date>;

  static associate(models: {
    Test: typeof import('./Test').Test;
    TestSection: typeof import('./TestSection').TestSection;
    Question: typeof import('./Question').Question;
    QuestionVersion: typeof import('./QuestionVersion').QuestionVersion;
  }) {
    TestQuestion.belongsTo(models.Test, { foreignKey: 'testId', as: 'test' });
    TestQuestion.belongsTo(models.TestSection, { foreignKey: 'sectionId', as: 'section' });
    TestQuestion.belongsTo(models.Question, { foreignKey: 'questionId', as: 'question' });
    TestQuestion.belongsTo(models.QuestionVersion, { foreignKey: 'questionVersionId', as: 'questionVersion' });
  }
}

export function initTestQuestion(sequelize: Sequelize) {
  TestQuestion.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      testId: { type: DataTypes.UUID, allowNull: false },
      sectionId: { type: DataTypes.UUID, allowNull: true },
      questionId: { type: DataTypes.UUID, allowNull: false },
      questionVersionId: { type: DataTypes.UUID, allowNull: false },
      displayOrder: { type: DataTypes.INTEGER, allowNull: false },
      marks: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      negativeMarks: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'test_questions',
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );
}
