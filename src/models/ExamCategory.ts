import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class ExamCategory extends Model<InferAttributes<ExamCategory>, InferCreationAttributes<ExamCategory>> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare slug: string;
  declare description: string | null;
  declare displayOrder: CreationOptional<number>;
  declare isActive: CreationOptional<boolean>;
  declare metadata: CreationOptional<Record<string, unknown>>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  static associate(models: { CompetitiveExam: typeof import('./CompetitiveExam').CompetitiveExam }) {
    ExamCategory.hasMany(models.CompetitiveExam, { foreignKey: 'categoryId', as: 'competitiveExams' });
  }
}

export function initExamCategory(sequelize: Sequelize) {
  ExamCategory.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      name: { type: DataTypes.STRING(150), allowNull: false },
      slug: { type: DataTypes.STRING(180), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      displayOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'exam_categories',
      underscored: true,
      timestamps: true,
      paranoid: true,
    },
  );
}
