You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Prefer inline templates for small components
- Prefer Signal Forms (`@angular/forms/signals`) for new forms. They are stable in Angular v22+ and provide signal-based state, type-safe field access, and schema-based validation
- When not using Signal Forms, prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+)
- Use the `inject()` function instead of constructor injection

## Linting

- ESLint is configured in `eslint.config.js`. Run `yarn lint` before considering a change complete.

## Testing & TDD

- The test runner is **Vitest**, run via `yarn test` (`@angular/build:unit-test`). Import `describe`, `it`, `expect`, `vi`, `beforeEach` explicitly from `vitest` — don't rely on globals. Use `vi.*` (not `jasmine.*`). Use `TestBed`/`ComponentFixture` from `@angular/core/testing`.
- **TDD is required for every change** — features, fixes, and refactors alike. Follow Red-Green-Refactor: write a failing test first, confirm it fails for the right reason, write the minimum code to pass it, then refactor with the suite green.
- A change isn't done until `yarn test` passes in full — compiling isn't enough.
- Coverage thresholds are enforced in `angular.json` (statements/functions/lines ≥ 80%, branches ≥ 75%). Add tests to meet them; don't lower them.

## Commit Message Format

Commits MUST follow [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<scope>): <description>`.

- **Type** — pick the first that fits: `feat` (new functionality), `fix` (any behaviour correction), `refactor` (structure/logic change, zero behaviour change), `perf` (performance, zero behaviour change), `test` (test-only), `docs` (docs only), `style` (formatting only), `ci`, `build`, `chore` (anything else — deps, config, generated files).
- **Scope** — a single noun, e.g. `(auth)`.
- **Description** — lowercase, imperative, no trailing period, 80 chars max for the whole first line.
- **Body** — only when the _why_ isn't obvious; wrap at 100 chars.
- Enforced automatically by a `commit-msg` hook (Husky + commitlint, `commitlint.config.js`).
