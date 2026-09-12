import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class ProductItem extends Model<InferAttributes<ProductItem>, InferCreationAttributes<ProductItem>> {
  declare id: CreationOptional<string>;
  declare productId: string;
  declare testId: string | null;
  declare testSeriesId: string | null;
  declare competitiveExamId: string | null;
  declare subjectId: string | null;
  declare accessType: string;
  declare attemptLimit: number | null;
  declare accessDurationDays: number | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static associate(models: {
    Product: typeof import('./Product').Product;
    Test: typeof import('./Test').Test;
    TestSeries: typeof import('./TestSeries').TestSeries;
    CompetitiveExam: typeof import('./CompetitiveExam').CompetitiveExam;
    Subject: typeof import('./Subject').Subject;
  }) {
    ProductItem.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
    ProductItem.belongsTo(models.Test, { foreignKey: 'testId', as: 'test' });
    ProductItem.belongsTo(models.TestSeries, { foreignKey: 'testSeriesId', as: 'testSeries' });
    ProductItem.belongsTo(models.CompetitiveExam, { foreignKey: 'competitiveExamId', as: 'competitiveExam' });
    ProductItem.belongsTo(models.Subject, { foreignKey: 'subjectId', as: 'subject' });
  }
}

export function initProductItem(sequelize: Sequelize) {
  ProductItem.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      productId: { type: DataTypes.UUID, allowNull: false },
      testId: { type: DataTypes.UUID, allowNull: true },
      testSeriesId: { type: DataTypes.UUID, allowNull: true },
      competitiveExamId: { type: DataTypes.UUID, allowNull: true },
      subjectId: { type: DataTypes.UUID, allowNull: true },
      accessType: { type: DataTypes.STRING(30), allowNull: false },
      attemptLimit: { type: DataTypes.INTEGER, allowNull: true },
      accessDurationDays: { type: DataTypes.INTEGER, allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'product_items',
      underscored: true,
      timestamps: true,
    },
  );
}
