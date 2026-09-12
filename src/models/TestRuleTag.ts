import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class TestRuleTag extends Model<InferAttributes<TestRuleTag>, InferCreationAttributes<TestRuleTag>> {
  declare testRuleId: string;
  declare tagId: string;
  declare createdAt: CreationOptional<Date>;
}

export function initTestRuleTag(sequelize: Sequelize) {
  TestRuleTag.init(
    {
      testRuleId: { type: DataTypes.UUID, primaryKey: true },
      tagId: { type: DataTypes.UUID, primaryKey: true },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'test_rule_tags',
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );
}
