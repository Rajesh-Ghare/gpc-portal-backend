import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class CompetitiveExam extends Model<InferAttributes<CompetitiveExam>, InferCreationAttributes<CompetitiveExam>> {
  declare id: CreationOptional<string>;
  declare categoryId: string;
  declare name: string;
  declare slug: string;
  declare code: string | null;
  declare description: string | null;
  declare conductingBody: string | null;
  declare officialWebsite: string | null;
  declare isActive: CreationOptional<boolean>;
  declare metadata: CreationOptional<Record<string, unknown>>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  static associate(models: {
    ExamCategory: typeof import('./ExamCategory').ExamCategory;
    TestSeries: typeof import('./TestSeries').TestSeries;
    Test: typeof import('./Test').Test;
  }) {
    CompetitiveExam.belongsTo(models.ExamCategory, { foreignKey: 'categoryId', as: 'category' });
    CompetitiveExam.hasMany(models.TestSeries, { foreignKey: 'competitiveExamId', as: 'testSeries' });
    CompetitiveExam.hasMany(models.Test, { foreignKey: 'competitiveExamId', as: 'tests' });
  }
}

export function initCompetitiveExam(sequelize: Sequelize) {
  CompetitiveExam.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      categoryId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(150), allowNull: false },
      slug: { type: DataTypes.STRING(180), allowNull: false, unique: true },
      code: { type: DataTypes.STRING(50), allowNull: true, unique: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      conductingBody: { type: DataTypes.STRING(200), allowNull: true },
      officialWebsite: { type: DataTypes.STRING(255), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'competitive_exams',
      underscored: true,
      timestamps: true,
      paranoid: true,
    },
  );
}
