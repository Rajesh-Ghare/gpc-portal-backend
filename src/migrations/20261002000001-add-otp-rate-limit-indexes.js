'use strict';

// Supports the OTP rate-limit window queries in authService (recent
// requests per mobile number, and per request IP, within the last hour).
module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('otp_requests', ['mobile_number', 'purpose', 'created_at'], {
      name: 'otp_requests_mobile_purpose_created_at',
    });
    await queryInterface.addIndex('otp_requests', ['request_ip', 'created_at'], {
      name: 'otp_requests_request_ip_created_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('otp_requests', 'otp_requests_request_ip_created_at');
    await queryInterface.removeIndex('otp_requests', 'otp_requests_mobile_purpose_created_at');
  },
};
