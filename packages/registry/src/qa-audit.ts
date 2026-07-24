import type { ResolvedProject } from './types.js';

export type QaPriority = 'P0' | 'P1' | 'P2';

export type QaCategory =
  | 'functional'
  | 'ui'
  | 'accessibility'
  | 'performance'
  | 'security'
  | 'reliability'
  | 'regression'
  | 'release';

export type QaAuditItem = {
  id: string;
  category: QaCategory;
  title: string;
  priority: QaPriority;
  check: string;
  howToVerify: string;
};

export type QaAuditReport = {
  specialistId: 'qa.verify';
  projectId: string;
  projectName: string;
  absolutePath: string;
  goal: string;
  summary: string;
  items: QaAuditItem[];
  quickWins: string[];
  nextActions: string[];
};

function item(
  id: string,
  category: QaCategory,
  title: string,
  priority: QaPriority,
  check: string,
  howToVerify: string,
): QaAuditItem {
  return { id, category, title, priority, check, howToVerify };
}

function baseChecklist(project: ResolvedProject): QaAuditItem[] {
  return [
    item(
      'func-critical-paths',
      'functional',
      'Critical user journeys covered',
      'P0',
      'Primary happy-path flows for the product have automated or scripted cases with clear expected results',
      `Map journeys under ${project.absolutePath} (auth, create, update, list, error paths) and attach evidence`,
    ),
    item(
      'func-negative',
      'functional',
      'Negative / validation cases',
      'P0',
      'Invalid input, missing fields, and unauthorized actions fail with clear messages — not silent success',
      'Exercise validation and authz boundaries for each critical form/API',
    ),
    item(
      'ui-primary-screens',
      'ui',
      'Primary UI screens smoke',
      'P0',
      'Home, main nav targets, and empty/loading/error states render without blank crashes',
      'Walk primary routes in local UI; capture screenshots or Playwright smoke if available',
    ),
    item(
      'ui-responsive',
      'ui',
      'Responsive layout sanity',
      'P1',
      'Key screens usable at mobile and desktop widths without clipped CTAs or unreachable controls',
      'Resize to ~375px and ~1280px; check forms and tables',
    ),
    item(
      'a11y-basics',
      'accessibility',
      'Accessibility basics',
      'P1',
      'Interactive controls are keyboard reachable; images/icons have accessible names where required',
      'Keyboard tab through primary flows; axe or similar on top pages when tooling exists',
    ),
    item(
      'perf-smoke',
      'performance',
      'Perf smoke on primary URL',
      'P1',
      'Primary screen loads without multi-second freezes; heavy lists paginate or virtualize',
      'Local timing or Lighthouse smoke on qaBaseUrl / qaLocalUrl when configured',
    ),
    item(
      'sec-authz',
      'security',
      'AuthZ / IDOR smoke',
      'P0',
      'Users cannot read or mutate another tenant/role resource by ID guessing',
      'Cross-account ID swap tests on sensitive endpoints; fail closed',
    ),
    item(
      'rel-error-handling',
      'reliability',
      'Error handling & recovery',
      'P1',
      'API/UI failures show recoverable errors; no uncaught exceptions on common failure modes',
      'Force 401/403/500 and offline; confirm UX and logs',
    ),
    item(
      'reg-automated-suite',
      'regression',
      'Automated test suite present',
      'P0',
      'Repo has a runnable unit/feature suite (PHPUnit/Pest, Vitest, Playwright, etc.) wired in scripts/CI',
      'Locate tests/, phpunit.xml, pest.php, or package.json test scripts under project root',
    ),
    item(
      'rel-ci-signal',
      'release',
      'CI or documented run command',
      'P1',
      'Known command or workflow runs the suite (composer test, phpunit, npm test, GitHub Actions)',
      'Check composer.json scripts, package.json scripts, and .github/workflows',
    ),
    item(
      'release-evidence',
      'release',
      'Evidence package for gate',
      'P0',
      'QA evidence (plan + results) sealed under .umer/qa/ after gate Pass',
      'Approve gate-qa-* so apply writes APPLY_REPORT.md and last-apply.json',
    ),
  ];
}

function projectExtras(project: ResolvedProject): QaAuditItem[] {
  const extras: QaAuditItem[] = [];

  if (project.projectId === 'school-app') {
    extras.push(
      item(
        'school-student-info',
        'functional',
        'Student info & admission journeys',
        'P0',
        'Student create/update/list and online admission stages behave per acceptance criteria',
        'Run Feature/StudentInfo tests and exercise SPA student screens',
      ),
      item(
        'school-attendance',
        'functional',
        'Attendance recording',
        'P0',
        'Attendance can be marked, listed, and rejected for invalid dates/roles',
        'Feature/Attendance suite + UI smoke for attendance module',
      ),
      item(
        'school-fees',
        'functional',
        'Fees assign & collect',
        'P0',
        'Fee assignment and collection flows (including P0 extensions) pass with correct balances',
        'Feature/Fees tests and fees UI path',
      ),
      item(
        'school-examination',
        'functional',
        'Examination / marks register',
        'P0',
        'Marks register write/read paths preserve integrity and role boundaries',
        'Feature/Examination tests + marks UI',
      ),
      item(
        'school-parent-api',
        'functional',
        'Parent mobile API parity',
        'P1',
        'Parent mobile API responses stay parity-checked against expected contracts',
        'Feature/Api/ParentMobileApiParityTest.php',
      ),
      item(
        'school-idor',
        'security',
        'Student/marksheet IDOR',
        'P0',
        'Student and marksheet PDF endpoints reject cross-student access',
        'Feature/Security/StudentIdorTest + MarksheetPdfIdorTest',
      ),
      item(
        'school-spa-ui',
        'ui',
        'frontend-spa primary screens',
        'P0',
        'React SPA (frontend-spa) primary routes load for staff/parent roles without console fatals',
        'pnpm/npm run in frontend-spa; smoke login + dashboard + one module page',
      ),
      item(
        'school-sensitive-data',
        'security',
        'Student/parent PII handling',
        'P0',
        'No PII in client logs or public error payloads; sensitive fields gated by role',
        'Review API error bodies and browser network tab on student screens',
      ),
    );
  }

  if (project.stack.includes('api') || project.tags.includes('api')) {
    extras.push(
      item(
        'api-contract',
        'functional',
        'API contract smoke',
        'P0',
        'Critical endpoints return expected status codes and schema shape for happy + auth failure paths',
        'Hit documented routes with valid and missing auth',
      ),
    );
  }

  if (project.stack.includes('frontend') || project.stack.includes('dashboard')) {
    extras.push(
      item(
        'ui-design-system',
        'ui',
        'Design-system consistency on changed screens',
        'P1',
        'New UI matches existing patterns (spacing, typography, controls) rather than one-off styles',
        'Compare against established screens before sign-off',
      ),
    );
  }

  if (project.defaultSpecialists.includes('qa.verify') || project.tags.includes('education')) {
    extras.push(
      item(
        'qa-priority',
        'release',
        'QA is an explicit project priority',
        'P1',
        'Track QA backlog via intake type=qa until Pass + evidence applied',
        'Use Umer AI OS Projects → type qa for this project',
      ),
    );
  }

  return extras;
}

export function runQaAudit(input: {
  project: ResolvedProject;
  goal: string;
  doneWhen?: string;
}): QaAuditReport {
  const items = [...baseChecklist(input.project), ...projectExtras(input.project)];
  const p0 = items.filter((i) => i.priority === 'P0');
  const quickWins = [
    'Inventory existing automated tests and run the default suite',
    'Smoke critical UI journeys and authz/IDOR boundaries',
    'Seal evidence under .umer/qa/ after gate Pass',
    ...p0.slice(0, 3).map((i) => i.title),
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  return {
    specialistId: 'qa.verify',
    projectId: input.project.projectId,
    projectName: input.project.name,
    absolutePath: input.project.absolutePath,
    goal: input.goal,
    summary: `QA verify plan for ${input.project.name}: ${input.goal}`,
    items,
    quickWins,
    nextActions: [
      `Work in ${input.project.absolutePath}`,
      'Clear P0 functional + security checklist items first',
      input.doneWhen?.trim() || 'Produce test plan + executed evidence for critical journeys and NFRs',
      'Gate Pass required before treating QA package as applied',
      'Handoff remaining failures to eng.app-delivery after Pass',
    ],
  };
}
