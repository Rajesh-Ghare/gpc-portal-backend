import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class Tag extends Model<InferAttributes<Tag>, InferCreationAttributes<Tag>> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare slug: string;
  declare tagType: CreationOptional<string>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static associate(models: {
    Question: typeof import('./Question').Question;
    QuestionTag: typeof import('./QuestionTag').QuestionTag;
  }) {
    Tag.belongsToMany(models.Question, {
      through: models.QuestionTag,
      foreignKey: 'tagId',
      otherKey: 'questionId',
      as: 'questions',
    });
  }
}

export function initTag(sequelize: Sequelize) {
  Tag.init(
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      name: { type: DataTypes.STRING(100), allowNull: false },
      slug: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      tagType: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'GENERAL' },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'tags',
      underscored: true,
      timestamps: true,
    },
  );
}
