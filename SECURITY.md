# Security Policy

## Reporting a Vulnerability

**⚠️ IMPORTANT: Do NOT open public issues for security vulnerabilities.**

Security vulnerabilities in haichan should be reported privately to protect users while a fix is being developed.

### How to Report

1. **Email**: security@haichan.project (preferred)
2. **GitHub Security Advisories**: Use the "Security" tab to report privately
3. **Include**:
   - Detailed description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact
   - Suggested fix (if you have one)
   - Your contact information

### What to Expect

- **Initial Response**: Within 48 hours
- **Status Update**: Within 1 week
- **Fix Timeline**: Depends on severity (critical issues prioritized)
- **Credit**: We'll acknowledge your contribution in the security advisory

### Responsible Disclosure

We ask that you:
- Give us reasonable time to fix the issue before public disclosure
- Don't exploit the vulnerability or disclose it to others
- Don't access or modify user data without permission
- Don't perform DoS attacks or spam

In return, we will:
- Acknowledge your report promptly
- Keep you updated on our progress
- Credit you in the security advisory (unless you prefer anonymity)
- Work with you to understand and fix the issue

## Supported Versions

We release security patches for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| 0.x.x   | :x: (beta, use at own risk) |

## Security Measures

### Client-Side Security

haichan implements several client-side security measures:

1. **Private Key Protection**
   - Private keys are NEVER transmitted to servers
   - All cryptographic operations happen client-side
   - Keys are stored only in browser memory or local storage (if user opts in)

2. **Input Validation**
   - All user input is validated and sanitized
   - XSS protection through React's built-in escaping
   - No `dangerouslySetInnerHTML` without sanitization

3. **Content Security Policy**
   - Strict CSP headers to prevent injection attacks
   - No inline scripts (all external)
   - Whitelist for external resources

### Server-Side Security

1. **Authentication**
   - JWT tokens with expiration
   - Secure password hashing (bcrypt)
   - Rate limiting on auth endpoints

2. **Proof-of-Work Validation**
   - All PoW validated server-side
   - Challenge expiration (stale challenges rejected)
   - Duplicate hash detection

3. **Database Security**
   - Parameterized queries (no SQL injection)
   - Row-level security policies
   - User isolation (can't access others' data)

4. **API Security**
   - CORS properly configured
   - Rate limiting on all endpoints
   - Input validation and sanitization

### Infrastructure Security

1. **HTTPS Only**
   - All connections encrypted
   - HSTS enabled
   - Secure cookies

2. **Secrets Management**
   - No secrets in code
   - Environment variables only
   - Blink Vault for sensitive data

3. **Dependencies**
   - Regular updates
   - Automated vulnerability scanning
   - Minimal dependency footprint

## Known Limitations

### Proof-of-Work

- PoW is client-side and can be faked (validation happens server-side)
- GPU/ASIC mining gives unfair advantage (accepted trade-off)
- Distributed mining possible (network overhead makes it impractical)

### Privacy

- User activity (posts, mining, chat) is public by design
- Bitcoin addresses are pseudonymous but traceable
- No private messaging (future feature)

### Rate Limiting

- Based on IP address (VPN/proxy can bypass)
- Aggressive limits to prevent abuse
- May affect legitimate users on shared IPs

## Security Best Practices for Users

1. **Protect Your Private Keys**
   - Never share your Bitcoin private key
   - Store backups securely offline
   - Use strong passwords

2. **Secure Your Account**
   - Use unique, strong passwords
   - Enable 2FA when available
   - Don't reuse passwords across sites

3. **Be Cautious**
   - Don't click suspicious links
   - Verify URLs before entering credentials
   - Report suspicious activity

4. **Browser Security**
   - Keep browser updated
   - Use reputable browsers (Chrome, Firefox, Safari, Edge)
   - Enable browser security features

## Threat Model

### What We Protect Against

- ✅ SQL injection
- ✅ XSS attacks
- ✅ CSRF attacks
- ✅ Session hijacking
- ✅ Brute force attacks
- ✅ Spam and bot abuse
- ✅ Data tampering

### What We Don't Protect Against

- ❌ Sophisticated timing attacks on PoW
- ❌ GPU/ASIC mining advantages
- ❌ Network-level attacks (DDoS)
- ❌ Physical access to user's device
- ❌ User error (lost keys, weak passwords)

## Security Updates

Security patches are released as needed:

- **Critical**: Immediate patch + announcement
- **High**: Patch within 7 days
- **Medium**: Patch in next release
- **Low**: Scheduled maintenance

Subscribe to [GitHub Security Advisories](https://github.com/YOUR_USERNAME/haichan-pow-imageboard/security/advisories) for notifications.

## Acknowledgments

We thank the following security researchers for responsibly disclosing vulnerabilities:

- *No reports yet - be the first!*

## Questions?

For general security questions (not vulnerabilities), open a GitHub Discussion or email: security@haichan.project

---

Thank you for helping keep haichan secure! 🔒
