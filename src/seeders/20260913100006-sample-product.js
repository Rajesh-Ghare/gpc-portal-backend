'use strict';

const { randomUUID } = require('crypto');
const { QueryTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const sequelize = queryInterface.sequelize;

    const [test] = await sequelize.query("SELECT id FROM tests WHERE slug = 'ssc-cgl-quant-sample-mock'", {
      type: QueryTypes.SELECT,
    });
    const [admin] = await sequelize.query("SELECT id FROM users WHERE mobile_number = '9000000002'", {
      type: QueryTypes.SELECT,
    });

    const productId = randomUUID();
    await queryInterface.bulkInsert('products', [
      {
        id: productId,
        name: 'SSC CGL Quantitative Aptitude — Sample Mock Test',
        slug: 'ssc-cgl-quant-sample-mock-product',
        description: 'One-time access to the sample SSC CGL Quantitative Aptitude mock test.',
        product_type: 'INDIVIDUAL_TEST',
        status: 'ACTIVE',
        display_order: 1,
        is_active: true,
        metadata: '{}',
        created_by: admin.id,
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert('product_prices', [
      {
        id: randomUUID(),
        product_id: productId,
        currency_code: 'INR',
        amount: 10.0,
        tax_amount: 0,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.bulkInsert('product_items', [
      {
        id: randomUUID(),
        product_id: productId,
        test_id: test.id,
        access_type: 'INDIVIDUAL_TEST',
        attempt_limit: 2,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM product_items WHERE product_id IN (SELECT id FROM products WHERE slug = 'ssc-cgl-quant-sample-mock-product');
    `);
    await queryInterface.sequelize.query(`
      DELETE FROM product_prices WHERE product_id IN (SELECT id FROM products WHERE slug = 'ssc-cgl-quant-sample-mock-product');
    `);
    await queryInterface.bulkDelete('products', { slug: 'ssc-cgl-quant-sample-mock-product' });
  },
};
