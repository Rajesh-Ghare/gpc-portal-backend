'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.addConstraint('questions', {
      fields: ['generation_job_id'],
      type: 'foreign key',
      name: 'questions_generation_job_id_fkey',
      references: { table: 'ai_generation_jobs', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('questions', 'questions_generation_job_id_fkey');
  },
};
