import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class TestSeries extends Model<InferAttributes<TestSeries>, InferCreationAttributes<TestSeries>> {
  declare id: CreationOptional<string>;
  declare competitiveExamId: string | null;
  declare name: string;
  declare slug: string;
  declare description: string | null;
  declare thumbnailUrl: string | null;
  declare displayOrder: CreationOptional<number>;
  declare isActive: CreationOptional<boolean>;
  declare metadata: CreationOptional<Record<string, unknown>>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  static associate(models: {
    CompetitiveExam: typeof import('./CompetitiveExam').CompetitiveExam;
    Test: typeof import('./Test').Test;
  }) {
    TestSeries.belongsTo(models.CompetitiveExam, { foreignKey: 'competitiveExamId', as: 'competitiveExam' });
    TestSeries.hasMany(models.Test, { foreignKey: 'testSeriesId', as: 'tests' });
  }
}

export function initTestSeries(sequelize: Sequelize) {
  TestSeries.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      competitiveExamId: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      slug: { type: DataTypes.STRING(180), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      thumbnailUrl: { type: DataTypes.STRING(500), allowNull: true },
      displayOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'test_series',
      underscored: true,
      timestamps: true,
      paranoid: true,
    },
  );
}
