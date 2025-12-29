// Test setup file
// Configure test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test_auction_db';
process.env.JWT_SECRET = 'test-secret-key';
process.env.PORT = '3001';

