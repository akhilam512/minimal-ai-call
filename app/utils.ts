/**
 * Get common security headers for API responses
 */
export function getSecurityHeaders(): Record<string, string> {
    return {
      'Content-Security-Policy': 'default-src \'none\'; frame-ancestors \'none\'',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY', 
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Access-Control-Allow-Origin': process.env.SITE_URL || '',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
  }