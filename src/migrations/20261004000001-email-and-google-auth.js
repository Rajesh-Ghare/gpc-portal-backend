'use strict';

const { DataTypes } = require('sequelize');

/**
 * Email OTP + Google sign-in (ADR-040). A user is now identified by a
 * verified mobile number, a verified email, or a Google account — so
 * mobile_number becomes optional. Postgres UNIQUE allows many NULLs, so the
 * existing unique index still guarantees one account per verified number.
 */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.changeColumn(
        'users',
        'mobile_number',
        { type: DataTypes.STRING(20), allowNull: true },
        { transaction },
      );
      // Optional, unverified contact number a student may add on their
      // profile (Razorpay prefill, support). Deliberately NOT mobile_number:
      // that column means "verified login identity" — an unverified number
      // there would later let SMS login land in someone else's account.
      await queryInterface.addColumn(
        'users',
        'contact_mobile_number',
        { type: DataTypes.STRING(20), allowNull: true },
        { transaction },
      );
      await queryInterface.addColumn(
        'users',
        'google_sub',
        { type: DataTypes.STRING(255), allowNull: true, unique: true },
        { transaction },
      );

      await queryInterface.changeColumn(
        'otp_requests',
        'mobile_number',
        { type: DataTypes.STRING(20), allowNull: true },
        { transaction },
      );
      await queryInterface.addColumn(
        'otp_requests',
        'channel',
        { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'SMS' },
        { transaction },
      );
      await queryInterface.addColumn(
        'otp_requests',
        'email',
        { type: DataTypes.STRING(255), allowNull: true },
        { transaction },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE otp_requests ADD CONSTRAINT otp_requests_destination_matches_channel CHECK (
           (channel = 'SMS' AND mobile_number IS NOT NULL AND email IS NULL) OR
           (channel = 'EMAIL' AND email IS NOT NULL AND mobile_number IS NULL)
         )`,
        { transaction },
      );
      await queryInterface.addIndex('otp_requests', ['email', 'purpose', 'created_at'], {
        name: 'otp_requests_email_purpose_created_at',
        transaction,
      });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Email-only rows/users can't satisfy the restored NOT NULLs.
      await queryInterface.sequelize.query("DELETE FROM otp_requests WHERE channel = 'EMAIL'", { transaction });
      await queryInterface.removeIndex('otp_requests', 'otp_requests_email_purpose_created_at', { transaction });
      await queryInterface.removeConstraint('otp_requests', 'otp_requests_destination_matches_channel', {
        transaction,
      });
      await queryInterface.removeColumn('otp_requests', 'email', { transaction });
      await queryInterface.removeColumn('otp_requests', 'channel', { transaction });
      await queryInterface.changeColumn(
        'otp_requests',
        'mobile_number',
        { type: DataTypes.STRING(20), allowNull: false },
        { transaction },
      );

      await queryInterface.removeColumn('users', 'google_sub', { transaction });
      await queryInterface.removeColumn('users', 'contact_mobile_number', { transaction });
      // Fails (deliberately) if email/Google-only users exist — reverting
      // would otherwise have to delete real accounts.
      await queryInterface.changeColumn(
        'users',
        'mobile_number',
        { type: DataTypes.STRING(20), allowNull: false },
        { transaction },
      );
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
