export type Locale = 'vi' | 'en';

export const SUPPORTED_LOCALES: readonly Locale[] = ['vi', 'en'] as const;
export const DEFAULT_LOCALE: Locale = 'vi';

export interface CommonDictionary {
  save: string;
  cancel: string;
  close: string;
  delete: string;
  confirmDelete: string;
  copy: string;
  copied: string;
  loading: string;
  confirm: string;
  backHome: string;
  edit: string;
  done: string;
}

export interface HeaderDictionary {
  brand: string;
  subtitle: string;
  gitSwitcherLabel: string;
  gitConnectPrompt: string;
  gitAccountsHeading: string;
  addGitAccount: string;
  activeBadge: string;
  userMenuLabel: string;
  settings: string;
  commandPaletteBtn: string;
  commandPaletteTooltip: string;
  toggleMotionPause: string;
  toggleMotionPlay: string;
  history: string;
  historyTitle: string;
  connectGit: string;
  manageGitTitle: string;
  logout: string;
  languageSwitchLabel: string;
}

export interface IntroDictionary {
  tagline: string;
}

export interface FooterDictionary {
  tagline: string;
}

export interface WorkspaceDictionary {
  title: string;
  subtitle: string;
  activeAccountContext: string;
}

export interface SummaryStripDictionary {
  prsLabel: string;
  prsBreakdown: string;
  commitsLabel: string;
  commitsSubtitle: string;
  reposLabel: string;
  reposSubtitle: string;
}

export interface OnboardingDictionary {
  title: string;
  description: string;
  connectNow: string;
  featureSync: string;
  featureAi: string;
  featureExport: string;
}

export interface ScannerDictionary {
  title: string;
  summaryStats: string;
  rangeLabel: string;
  rangeToday: string;
  range24h: string;
  range7d: string;
  syncBtn: string;
  syncingBtn: string;
  fetchSettingsBtn: string;
  revalidatingHint: string;
  groupByLabel: string;
  groupOwner: string;
  groupTask: string;
  groupRepo: string;
  groupFlat: string;
  personalSpace: string;
  orgSpace: string;
  directCommitsBadge: string;
  selectGroup: string;
  clearGroup: string;
  groupCount: string;
  allRepos: string;
  selectAll: string;
  clearSelection: string;
  selectedSummary: string;
  selectPrAria: string;
  commitsCount: string;
  commitsCollapsedCount: string;
  showMoreCommits: string;
  collapseCommits: string;
  openPrExternal: string;
  emptyTitle: string;
  emptyLoadingTitle: string;
  emptyDesc: string;
  emptyAction: string;
  scanError: string;
  stateFilterAll: string;
  stateDraft: string;
  stateOpen: string;
  stateMerged: string;
  stateClosed: string;
  assignTaskBtn: string;
  assignToTaskHeading: string;
  noTasksHint: string;
  createTaskQuickPlaceholder: string;
  createTaskQuickBtn: string;
  noPersonalNoticeTitle: string;
  noPersonalNoticeDesc: string;
}

export interface TasksDictionary {
  createBtn: string;
  createTitle: string;
  titleLabel: string;
  titlePlaceholder: string;
  colorLabel: string;
  selectPrsLabel: string;
  selectedPrsHint: string;
  noAvailablePrs: string;
  saveTaskBtn: string;
  savingBtn: string;
  emptyTitle: string;
  emptyDesc: string;
  unassignedTitle: string;
  addPrsBtn: string;
  doneAddPrsBtn: string;
  selectAllInTask: string;
  outOfWindowTag: string;
  renameTooltip: string;
  saveRenameBtn: string;
  deleteTooltip: string;
  confirmDeleteBtn: string;
  progressSummary: string;
  removeItemAria: string;
}

export interface AiModelsDictionary {
  gpt4oMiniLabel: string;
  gpt4oMiniDesc: string;
  llama33Label: string;
  llama33Desc: string;
  llama32LocalLabel: string;
  llama32LocalDesc: string;
  qwenLocalLabel: string;
  qwenLocalDesc: string;
}

export interface AiConsoleDictionary {
  title: string;
  description: string;
  engineGroupLabel: string;
  cloudTitle: string;
  cloudDesc: string;
  localTitle: string;
  localDesc: string;
  modelLabel: string;
  outputLangLabel: string;
  outputLangVi: string;
  outputLangEn: string;
  webgpuCachedHint: string;
  webgpuDownloadHint: string;
  generateBtn: string;
  generateSelectedBtn: string;
  generatingBtn: string;
  noActivitiesError: string;
  noSelectedPrsError: string;
  webgpuUnsupported: string;
  generateFailed: string;
  loadingModel: string;
  models: AiModelsDictionary;
}

export interface StandupDockDictionary {
  title: string;
  generatingTitle: string;
  generatingSubtitle: string;
  subtitle: string;
  copyBullet: string;
  copyParabol: string;
  copySlack: string;
  copyMarkdown: string;
  copyJira: string;
  copiedToast: string;
  editPlaceholder: string;
  parabolYesterday: string;
  parabolToday: string;
  parabolBlockers: string;
  slackHeader: string;
  markdownHeader: string;
  jiraHeader: string;
}

export interface CommandPaletteDictionary {
  placeholder: string;
  dialogTitle: string;
  empty: string;
  shortcutHint: string;
  groups: {
    git: string;
    ai: string;
    navigation: string;
  };
  actions: {
    syncToday: string;
    sync24h: string;
    sync7d: string;
    generateStandup: string;
    switchCloudAi: string;
    switchWebGpuAi: string;
    openHistory: string;
    openGitModal: string;
    toggleLanguage: string;
    toggleMotionPause: string;
    toggleMotionPlay: string;
  };
}

export interface ToastsDictionary {
  syncSuccess: string;
  standupReady: string;
  gitConnected: string;
  gitSwitched: string;
  gitDisconnected: string;
  reportDeleted: string;
  settingsSaved: string;
  taskCreated: string;
  taskUpdated: string;
  taskDeleted: string;
  taskItemUpdated: string;
}

export interface GithubModalDictionary {
  titleConnect: string;
  titleAdd: string;
  titleManage: string;
  subtitle: string;
  lastSync: string;
  neverSynced: string;
  expiresAt: string;
  excessiveScopesTitle: string;
  excessiveScopesDesc: string;
  tokenRevokedTitle: string;
  tokenRevokedDesc: string;
  securityNote: string;
  disconnectBtn: string;
  disconnectConfirmBtn: string;
  disconnectingBtn: string;
  patLabel: string;
  createTokenLink: string;
  patPlaceholder: string;
  patHint: string;
  patRequired: string;
  patSaveError: string;
  saveBtn: string;
  savingBtn: string;
}

export interface HistoryModalDictionary {
  title: string;
  subtitle: string;
  loading: string;
  empty: string;
  prsCount: string;
  copyTooltip: string;
  deleteTooltip: string;
  confirmDeleteBtn: string;
}

export interface AuthDictionary {
  workspaceLoading: string;
  brandTagline: string;
  loginTitle: string;
  registerTitle: string;
  forgotTitle: string;
  usernameOrEmailLabel: string;
  usernameOrEmailPlaceholder: string;
  usernameLabel: string;
  usernamePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  forgotEmailLabel: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  registerPasswordPlaceholder: string;
  showPassword: string;
  hidePassword: string;
  forgotPasswordLink: string;
  signInBtn: string;
  signingInBtn: string;
  registerBtn: string;
  registeringBtn: string;
  sendResetBtn: string;
  sendingResetBtn: string;
  orSeparator: string;
  noAccount: string;
  registerNow: string;
  hasAccount: string;
  signInNow: string;
  backToLogin: string;
  devAccountHelper: string;
  googleDevBtn: string;
  googleUnconfigured: string;
  googleNoCredential: string;
  googleAuthFailed: string;
  registerSuccess: string;
  forgotSuccess: string;
  ssoInitFailed: string;
  errors: {
    usernameRequired: string;
    passwordRequired: string;
    registerFieldsRequired: string;
    emailRequired: string;
    loginFailed: string;
    registerFailed: string;
    forgotFailed: string;
  };
  chooser: {
    title: string;
    subtitle: string;
    loading: string;
    empty: string;
    otherAccountBtn: string;
    customLabel: string;
    customPlaceholder: string;
    continueBtn: string;
  };
  callback: {
    missingCode: string;
    verifyingTitle: string;
    verifyingDesc: string;
    successTitle: string;
    successDesc: string;
    failedTitle: string;
    failedDefault: string;
  };
}

export interface SettingsModalDictionary {
  title: string;
  subtitle: string;
  tablistAria: string;
  tabFetch: string;
  tabDisplay: string;
  tabGeneral: string;
  workspaceSection: string;
  includePersonalLabel: string;
  includePersonalDesc: string;
  personalNoAccessWarning: string;
  orgsLabel: string;
  orgsAllMode: string;
  orgsAllHint: string;
  orgsEmpty: string;
  prStatesSection: string;
  fetchRoleLabel: string;
  roleAuthor: string;
  roleInvolves: string;
  advancedSection: string;
  includeDirectCommitsLabel: string;
  includeDirectCommitsDesc: string;
  includePrWithoutCommitsLabel: string;
  includePrWithoutCommitsDesc: string;
  defaultRangeLabel: string;
  defaultGroupByLabel: string;
  compactCommitsLabel: string;
  compactCommitsDesc: string;
  saveAndApplyBtn: string;
  savingBtn: string;
  interfaceSection: string;
  languageLabel: string;
  motionLabel: string;
  motionOn: string;
  motionOff: string;
  gitAccountsSection: string;
  addAccountBtn: string;
  noAccounts: string;
  activeLabel: string;
  switchToBtn: string;
  disconnectAccountBtn: string;
  confirmDisconnectBtn: string;
}

export interface TranslationDictionary {
  common: CommonDictionary;
  intro: IntroDictionary;
  footer: FooterDictionary;
  header: HeaderDictionary;
  workspace: WorkspaceDictionary;
  summaryStrip: SummaryStripDictionary;
  onboarding: OnboardingDictionary;
  scanner: ScannerDictionary;
  tasks: TasksDictionary;
  aiConsole: AiConsoleDictionary;
  standupDock: StandupDockDictionary;
  commandPalette: CommandPaletteDictionary;
  toasts: ToastsDictionary;
  githubModal: GithubModalDictionary;
  settingsModal: SettingsModalDictionary;
  historyModal: HistoryModalDictionary;
  auth: AuthDictionary;
}
