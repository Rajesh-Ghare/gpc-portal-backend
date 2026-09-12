import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class TestSection extends Model<InferAttributes<TestSection>, InferCreationAttributes<TestSection>> {
  declare id: CreationOptional<string>;
  declare testId: string;
  declare title: string;
  declare description: string | null;
  declare displayOrder: CreationOptional<number>;
  declare questionCount: CreationOptional<number>;
  declare totalMarks: CreationOptional<string>;
  declare durationSeconds: number | null;
  declare marksPerQuestion: string | null;
  declare negativeMarks: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static associate(models: { Test: typeof import('./Test').Test }) {
    TestSection.belongsTo(models.Test, { foreignKey: 'testId', as: 'test' });
  }
}

export function initTestSection(sequelize: Sequelize) {
  TestSection.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      testId: { type: DataTypes.UUID, allowNull: false },
      title: { type: DataTypes.STRING(150), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      displayOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      questionCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      totalMarks: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      durationSeconds: { type: DataTypes.INTEGER, allowNull: true },
      marksPerQuestion: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      negativeMarks: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'test_sections',
      underscored: true,
      timestamps: true,
    },
  );
}
