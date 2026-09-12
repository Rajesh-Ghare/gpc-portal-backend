'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const categoryId = randomUUID();
    await queryInterface.bulkInsert('exam_categories', [
      {
        id: categoryId,
        name: 'SSC',
        slug: 'ssc',
        description: 'Staff Selection Commission examinations',
        display_order: 1,
        is_active: true,
        metadata: '{}',
        created_at: now,
        updated_at: now,
      },
    ]);

    const examId = randomUUID();
    await queryInterface.bulkInsert('competitive_exams', [
      {
        id: examId,
        category_id: categoryId,
        name: 'SSC CGL',
        slug: 'ssc-cgl',
        code: 'SSC-CGL',
        description: 'Staff Selection Commission Combined Graduate Level Examination',
        conducting_body: 'Staff Selection Commission',
        is_active: true,
        metadata: '{}',
        created_at: now,
        updated_at: now,
      },
    ]);

    const subjectId = randomUUID();
    await queryInterface.bulkInsert('subjects', [
      {
        id: subjectId,
        name: 'Quantitative Aptitude',
        slug: 'quantitative-aptitude',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert('topics', [
      {
        id: randomUUID(),
        subject_id: subjectId,
        name: 'Percentage',
        slug: 'percentage',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: randomUUID(),
        subject_id: subjectId,
        name: 'Profit & Loss',
        slug: 'profit-and-loss',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('topics', { slug: ['percentage', 'profit-and-loss'] });
    await queryInterface.bulkDelete('subjects', { slug: 'quantitative-aptitude' });
    await queryInterface.bulkDelete('competitive_exams', { slug: 'ssc-cgl' });
    await queryInterface.bulkDelete('exam_categories', { slug: 'ssc' });
  },
};
