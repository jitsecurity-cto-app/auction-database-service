// Intentionally verbose logging utility (security vulnerability)
// Logs sensitive data including passwords, tokens, and user input

export function logRequest(req: any): void {
  // Intentionally log all request details including sensitive data
  console.log('=== Request Log ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Path:', req.path);
  console.log('Query:', req.query);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('IP:', req.ip);
  console.log('User-Agent:', req.get('user-agent'));
  console.log('==================');
}

export function logResponse(res: any, data: any): void {
  // Intentionally log response data
  console.log('=== Response Log ===');
  console.log('Status:', res.statusCode);
  console.log('Data:', JSON.stringify(data, null, 2));
  console.log('===================');
}

export function logError(error: Error, context?: any): void {
  // Intentionally verbose error logging including stack traces
  console.error('=== Error Log ===');
  console.error('Message:', error.message);
  console.error('Stack:', error.stack);
  if (context) {
    console.error('Context:', JSON.stringify(context, null, 2));
  }
  console.error('=================');
}

export function logDatabaseQuery(query: string, params?: any[]): void {
  // Intentionally log all database queries including user input
  console.log('=== Database Query ===');
  console.log('Query:', query);
  if (params) {
    console.log('Params:', JSON.stringify(params, null, 2));
  }
  console.log('======================');
}

export function logAuthAttempt(email: string, password: string, success: boolean): void {
  // Intentionally log authentication attempts including passwords
  console.log('=== Auth Attempt ===');
  console.log('Email:', email);
  console.log('Password:', password); // Intentionally logging password
  console.log('Success:', success);
  console.log('====================');
}

export function logTokenGeneration(userId: number, email: string, token: string): void {
  // Intentionally log token generation
  console.log('=== Token Generation ===');
  console.log('User ID:', userId);
  console.log('Email:', email);
  console.log('Token:', token); // Intentionally logging full token
  console.log('========================');
}

