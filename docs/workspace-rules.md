# Workspace Rules

## Naming Conventions

### Code
- **Variables/Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **React Components**: `PascalCase`
- **CSS Classes**: `kebab-case`
- **TypeScript Interfaces**: `I` prefix (e.g., `IUserData`)

### Files & Directories
- **React Components**: `PascalCase.tsx`
- **Utility Files**: `kebab-case.ts`
- **Test Files**: `*.test.tsx` or `*.spec.tsx`
- **Configuration**: `kebab-case.config.js`

## Commit Message Guidelines

### Format
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Build process or tooling changes

### Examples
```
feat(auth): add Google OAuth login
fix(api): resolve user authentication bug
docs(readme): update installation instructions
```

## Pull Request Process

### Creating a PR
1. Create a feature branch from `main`
2. Keep PRs focused and small
3. Reference related issues
4. Update documentation if needed

### PR Review
- Required minimum of 1 approval
- All CI checks must pass
- Code owner review required for critical paths
- Resolve all conversations before merging

## Branching Strategy

### Main Branches
- `main`: Production-ready code
- `develop`: Integration branch for features

### Supporting Branches
1. **Feature Branches**:
   - `feature/feature-name`
   - `feature/123-description`

2. **Hotfix Branches**:
   - `hotfix/issue-description`

3. **Release Branches**:
   - `release/1.0.0`

### Branch Naming
- Use lowercase with hyphens
- Prefix with type (feature/fix/docs)
- Include issue number if applicable
- Keep names descriptive but concise

## Code Review Guidelines

### For Reviewers
- Be constructive and kind
- Focus on code, not the coder
- Suggest improvements with explanations
- Check for security concerns

### For Authors
- Address all comments before merging
- Keep commits focused
- Update documentation as needed
- Test your changes thoroughly

## Development Workflow

1. Pull latest changes from `main`
2. Create a new feature branch
3. Make atomic commits
4. Push branch and create PR
5. Address review comments
6. Squash and merge when approved

## Dependencies
- Document all new dependencies in PR
- Keep dependencies updated
- Security patches must be applied immediately
- Major version updates require team discussion
