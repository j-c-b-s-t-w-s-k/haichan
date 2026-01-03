# Contributing to haichan

Thank you for your interest in contributing to haichan! This document provides guidelines for contributing to the project.

## philosophy

Before contributing, please read the [thesis](/docs/THESIS.md) to understand the core philosophy:
- Computational scarcity over infinite abundance
- Cryptographic proof over trust
- Transparent mechanisms over hidden algorithms
- Structure over spectacle

Contributions should align with these principles.

## getting started

### prerequisites

- Node.js 18+
- Git
- Modern browser with WebAssembly support
- Basic understanding of TypeScript/React
- Familiarity with proof-of-work concepts

### setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/haichan-pow-imageboard.git
   cd haichan-pow-imageboard
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run development server:
   ```bash
   npm run dev
   ```
5. Run tests:
   ```bash
   npm test
   ```

## development workflow

### branch naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions/updates

### commit messages

Use clear, descriptive commit messages:

```
type: brief description

Longer explanation if needed
- Bullet points for details
- Reference issues: #123

Breaking changes: describe any breaking changes
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat: add diamond hash achievements`
- `fix: correct PoW validation logic`
- `docs: update thesis with new mechanisms`

### code style

- Follow existing code style
- Use TypeScript strict mode
- Run linter before committing: `npm run lint`
- Format code consistently
- Use meaningful variable names
- Add comments for complex logic

### testing

- Write tests for new features
- Update tests when modifying existing code
- Ensure all tests pass: `npm test`
- Aim for high code coverage
- Test edge cases

## pull request process

1. Create a feature branch from `main`
2. Make your changes
3. Run tests and linter
4. Commit with clear messages
5. Push to your fork
6. Open a pull request

### PR checklist

- [ ] Code follows project style
- [ ] Tests added/updated
- [ ] Linter passes
- [ ] Documentation updated
- [ ] Commit messages are clear
- [ ] No breaking changes (or clearly documented)
- [ ] Aligns with project philosophy

### PR description

Provide:
- Clear description of changes
- Motivation and context
- Related issues (if any)
- Screenshots (for UI changes)
- Breaking changes (if any)

## areas for contribution

### high priority

- **Mining optimizations**: Improve hash performance
- **UI/UX improvements**: Enhance terminal aesthetic
- **Documentation**: Expand guides and examples
- **Testing**: Increase test coverage
- **Edge function improvements**: Optimize backend logic

### medium priority

- **New features**: Propose features aligned with thesis
- **Bug fixes**: Fix reported issues
- **Performance**: Optimize rendering, database queries
- **Accessibility**: Improve keyboard navigation, screen readers
- **Mobile**: Enhance mobile experience

### low priority

- **Refactoring**: Clean up technical debt
- **Tooling**: Improve developer experience
- **Integrations**: Add complementary tools

## feature proposals

Before implementing major features:

1. Open an issue describing the feature
2. Explain how it aligns with the thesis
3. Discuss implementation approach
4. Wait for maintainer feedback
5. Proceed after approval

### thesis alignment

Features must support core mechanisms:
1. **Scarcity**: Does it enforce computational cost?
2. **Transparency**: Are rules cryptographic and verifiable?
3. **Structure**: Does it foreground mechanism over spectacle?
4. **Work**: Does it respond to PoW, not engagement metrics?
5. **Composability**: Can posts remain programmable primitives?

## code review

Maintainers will review PRs for:
- Code quality and style
- Test coverage
- Documentation
- Philosophy alignment
- Performance impact
- Security considerations

Be patient and responsive to feedback.

## security

### reporting vulnerabilities

**Do NOT** open public issues for security vulnerabilities.

Instead:
1. Email: security@haichan.project (if available)
2. Or use GitHub Security Advisories
3. Provide detailed description
4. Include steps to reproduce
5. Suggest fixes if possible

### security guidelines

- Never commit secrets or keys
- Validate all user input
- Use parameterized queries
- Follow OWASP best practices
- Test for common vulnerabilities
- Keep dependencies updated

## documentation

### updating docs

- Keep docs in sync with code
- Use clear, concise language
- Include examples
- Update README for major changes
- Maintain thesis document accuracy

### documentation locations

- `/README.md` - Project overview
- `/docs/THESIS.md` - Philosophical foundation
- `/docs/architecture.md` - System architecture
- `/docs/api.md` - API documentation
- `/docs/features.md` - Feature descriptions

## community

### code of conduct

- Be respectful and professional
- Focus on constructive feedback
- Assume good intentions
- Help newcomers
- Stay on topic
- Follow project philosophy

### communication

- GitHub Issues: Bug reports, feature requests
- GitHub Discussions: General questions, ideas
- Pull Requests: Code contributions

## questions?

- Open a GitHub Discussion
- Read the thesis: `/docs/THESIS.md`
- Check existing issues
- Review documentation

## license

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for helping build haichan! 🔨⚡
