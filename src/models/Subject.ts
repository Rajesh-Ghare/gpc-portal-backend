import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class Subject extends Model<InferAttributes<Subject>, InferCreationAttributes<Subject>> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare slug: string;
  declare description: string | null;
  declare isActive: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  static associate(models: {
    Topic: typeof import('./Topic').Topic;
    Question: typeof import('./Question').Question;
  }) {
    Subject.hasMany(models.Topic, { foreignKey: 'subjectId', as: 'topics' });
    Subject.hasMany(models.Question, { foreignKey: 'subjectId', as: 'questions' });
  }
}

export function initSubject(sequelize: Sequelize) {
  Subject.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      name: { type: DataTypes.STRING(150), allowNull: false },
      slug: { type: DataTypes.STRING(180), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'subjects',
      underscored: true,
      timestamps: true,
      paranoid: true,
    },
  );
}
