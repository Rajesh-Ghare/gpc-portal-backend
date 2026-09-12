import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class ProductPrice extends Model<InferAttributes<ProductPrice>, InferCreationAttributes<ProductPrice>> {
  declare id: CreationOptional<string>;
  declare productId: string;
  declare currencyCode: CreationOptional<string>;
  declare amount: string;
  declare originalAmount: string | null;
  declare taxAmount: CreationOptional<string>;
  declare validFrom: Date | null;
  declare validUntil: Date | null;
  declare isActive: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static associate(models: { Product: typeof import('./Product').Product }) {
    ProductPrice.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
  }
}

export function initProductPrice(sequelize: Sequelize) {
  ProductPrice.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      productId: { type: DataTypes.UUID, allowNull: false },
      currencyCode: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'INR' },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      originalAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      taxAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      validFrom: { type: DataTypes.DATE, allowNull: true },
      validUntil: { type: DataTypes.DATE, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'product_prices',
      underscored: true,
      timestamps: true,
    },
  );
}
