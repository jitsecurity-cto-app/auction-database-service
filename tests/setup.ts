// Test setup file
// Configure test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/auction_db';
process.env.JWT_SECRET = 'test-secret-key';
process.env.PORT = '3001';

