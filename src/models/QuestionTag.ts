import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class QuestionTag extends Model<InferAttributes<QuestionTag>, InferCreationAttributes<QuestionTag>> {
  declare questionId: string;
  declare tagId: string;
  declare createdAt: CreationOptional<Date>;
}

export function initQuestionTag(sequelize: Sequelize) {
  QuestionTag.init(
    {
      questionId: { type: DataTypes.UUID, primaryKey: true },
      tagId: { type: DataTypes.UUID, primaryKey: true },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'question_tags',
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );
}
