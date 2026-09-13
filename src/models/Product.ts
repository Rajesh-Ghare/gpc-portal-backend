import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
  Sequelize,
} from 'sequelize';
import type { ProductPrice } from './ProductPrice';
import type { ProductItem } from './ProductItem';

export class Product extends Model<InferAttributes<Product>, InferCreationAttributes<Product>> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare slug: string;
  declare description: string | null;
  declare productType: string;
  declare status: CreationOptional<string>;
  declare displayOrder: CreationOptional<number>;
  declare isActive: CreationOptional<boolean>;
  declare metadata: CreationOptional<Record<string, unknown>>;
  declare createdBy: string;
  declare updatedBy: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  declare prices?: NonAttribute<ProductPrice[]>;
  declare items?: NonAttribute<ProductItem[]>;

  static associate(models: {
    ProductPrice: typeof import('./ProductPrice').ProductPrice;
    ProductItem: typeof import('./ProductItem').ProductItem;
  }) {
    Product.hasMany(models.ProductPrice, { foreignKey: 'productId', as: 'prices' });
    Product.hasMany(models.ProductItem, { foreignKey: 'productId', as: 'items' });
  }
}

export function initProduct(sequelize: Sequelize) {
  Product.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      name: { type: DataTypes.STRING(200), allowNull: false },
      slug: { type: DataTypes.STRING(220), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      productType: { type: DataTypes.STRING(30), allowNull: false },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'DRAFT' },
      displayOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdBy: { type: DataTypes.UUID, allowNull: false },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'products',
      underscored: true,
      timestamps: true,
      paranoid: true,
    },
  );
}
