export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup-jest.js'],
  moduleNameMapper: {
    '\\.(css)$': '<rootDir>/tests/styleMock.js',
    // Migrerade moduler: import behåller .js (Vite/TS) men filen heter .ts — Jest behöver explicit mappning.
    '^.+/audit_logic\\.js$': '<rootDir>/js/audit_logic.ts',
    '^.+/export_logic\\.js$': '<rootDir>/js/export_logic.ts',
    '^.+/auditReducer\\.js$': '<rootDir>/js/state/auditReducer.ts',
    '^.+/same_user_tab_field_sync\\.js$': '<rootDir>/js/logic/same_user_tab_field_sync.ts',
    '^.+/RequirementAuditComponent\\.js$': '<rootDir>/js/components/RequirementAuditComponent.ts',
    '^.+/RequirementAuditSidebarComponent\\.js$': '<rootDir>/js/components/RequirementAuditSidebarComponent.ts',
    '^.+/AuditActionsViewComponent\\.js$': '<rootDir>/js/components/AuditActionsViewComponent.ts',
    '^.+/AuditProblemsViewComponent\\.js$': '<rootDir>/js/components/AuditProblemsViewComponent.ts',
    '^.+/ConfirmUpdatesViewComponent\\.js$': '<rootDir>/js/components/ConfirmUpdatesViewComponent.ts',
    '^.+/FinalConfirmUpdatesViewComponent\\.js$': '<rootDir>/js/components/FinalConfirmUpdatesViewComponent.ts',
    '^.+/SampleListComponent\\.js$': '<rootDir>/js/components/SampleListComponent.ts',
    '^.+/requirement_list_query\\.js$': '<rootDir>/js/components/requirements_list/requirement_list_query.ts',
    '^.+/requirement_list_filter_requirements\\.js$':
      '<rootDir>/js/components/requirements_list/requirement_list_filter_requirements.ts',
    '^.+/requirement_list_incremental_dom\\.js$':
      '<rootDir>/js/components/requirements_list/requirement_list_incremental_dom.ts',
    '^.+/requirement_list_list_items\\.js$': '<rootDir>/js/components/requirements_list/requirement_list_list_items.ts',
    '^.+/requirement_list_mark_all_modal\\.js$':
      '<rootDir>/js/components/requirements_list/requirement_list_mark_all_modal.ts',
    '^.+/requirement_search_utils\\.js$': '<rootDir>/js/utils/requirement_search_utils.ts',
    '^.+/string_filter_normalize\\.js$': '<rootDir>/js/utils/string_filter_normalize.ts',
  },
  testMatch: [
    '<rootDir>/tests/unit/**/*.spec.js',
    '<rootDir>/tests/unit/**/*.spec.ts',
  ],
  testPathIgnorePatterns: ['/node_modules/', '.e2e.spec.js'],
  /** Tillåt transpilering av marked (ESM) så js/utils/markdown.js kan laddas i Jest. */
  transformIgnorePatterns: ['/node_modules/(?!(marked)/)'],
  transform: {
    '^.+\\.(t|j)s$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
          },
          target: 'es2022',
        },
        module: {
          type: 'es6',
        },
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  collectCoverageFrom: [
    'js/logic/**/*.{js,ts}',
    'js/api/**/*.{js,ts}',
    'js/state/**/*.{js,ts}',
    '!js/**/*.spec.{js,ts}',
  ],
};
