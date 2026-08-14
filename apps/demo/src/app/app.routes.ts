import { Routes } from '@angular/router';

/**
 * Every page is lazily loaded. Each one mounts its own calendar, so eager-loading the lot
 * would build a dozen of them on first paint — and the point of the site is that a
 * calendar appears immediately.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./docs/overview.page').then((m) => m.OverviewPage),
    title: 'SteadyCalendar — a resource-scheduling calendar for Angular',
  },
  {
    path: 'getting-started',
    loadComponent: () => import('./docs/getting-started.page').then((m) => m.GettingStartedPage),
    title: 'Getting started — SteadyCalendar',
  },
  {
    path: 'angular',
    loadComponent: () => import('./docs/angular-integration.page').then((m) => m.AngularIntegrationPage),
    title: 'Angular integration — SteadyCalendar',
  },
  {
    path: 'configuration',
    loadComponent: () => import('./docs/configuration.page').then((m) => m.ConfigurationPage),
    title: 'Configuration — SteadyCalendar',
  },
  {
    path: 'views',
    loadComponent: () => import('./docs/views.page').then((m) => m.ViewsPage),
    title: 'Views and resource modes — SteadyCalendar',
  },
  {
    path: 'data-source',
    loadComponent: () => import('./docs/data-source.page').then((m) => m.DataSourcePage),
    title: 'Data source — SteadyCalendar',
  },
  {
    path: 'field-mapping',
    loadComponent: () => import('./docs/field-mapping.page').then((m) => m.FieldMappingPage),
    title: 'Field mapping — SteadyCalendar',
  },
  {
    path: 'i18n',
    loadComponent: () => import('./docs/i18n.page').then((m) => m.I18nPage),
    title: 'Locale and translations — SteadyCalendar',
  },
  {
    path: 'events',
    loadComponent: () => import('./docs/events.page').then((m) => m.EventsPage),
    title: 'Events and API — SteadyCalendar',
  },
  {
    path: 'interactions',
    loadComponent: () => import('./docs/interactions.page').then((m) => m.InteractionsPage),
    title: 'Interactions — SteadyCalendar',
  },
  {
    path: 'business-hours',
    loadComponent: () => import('./docs/business-hours.page').then((m) => m.BusinessHoursPage),
    title: 'Business hours and holidays — SteadyCalendar',
  },
  {
    path: 'cards',
    loadComponent: () => import('./docs/cards.page').then((m) => m.CardsPage),
    title: 'Card content and privacy — SteadyCalendar',
  },
  {
    path: 'theming',
    loadComponent: () => import('./docs/theming.page').then((m) => m.ThemingPage),
    title: 'Theming — SteadyCalendar',
  },
  {
    path: 'plugins',
    loadComponent: () => import('./docs/plugins.page').then((m) => m.PluginsPage),
    title: 'Plugins — SteadyCalendar',
  },
  {
    path: 'preferences',
    loadComponent: () => import('./docs/preferences.page').then((m) => m.PreferencesPage),
    title: 'Preferences — SteadyCalendar',
  },
  {
    path: 'headless',
    loadComponent: () => import('./docs/headless.page').then((m) => m.HeadlessPage),
    title: 'Headless mode — SteadyCalendar',
  },
  {
    path: 'accessibility',
    loadComponent: () => import('./docs/accessibility.page').then((m) => m.AccessibilityPage),
    title: 'Accessibility — SteadyCalendar',
  },
  {
    path: 'playground',
    loadComponent: () => import('./playground/playground.page').then((m) => m.PlaygroundPage),
    title: 'Playground — SteadyCalendar',
  },
  { path: '**', redirectTo: '' },
];

export interface NavItem {
  path: string;
  label: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Start here',
    items: [
      { path: '', label: 'Overview' },
      { path: 'getting-started', label: 'Getting started' },
      { path: 'angular', label: 'Angular integration' },
      { path: 'playground', label: 'Playground' },
    ],
  },
  {
    title: 'Core',
    items: [
      { path: 'configuration', label: 'Configuration' },
      { path: 'views', label: 'Views and modes' },
      { path: 'data-source', label: 'Data source' },
      { path: 'field-mapping', label: 'Field mapping' },
      { path: 'i18n', label: 'Locale and language' },
    ],
  },
  {
    title: 'Behaviour',
    items: [
      { path: 'events', label: 'Events and API' },
      { path: 'interactions', label: 'Interactions' },
      { path: 'business-hours', label: 'Hours and holidays' },
      { path: 'cards', label: 'Cards and privacy' },
    ],
  },
  {
    title: 'Extending',
    items: [
      { path: 'theming', label: 'Theming' },
      { path: 'plugins', label: 'Plugins' },
      { path: 'preferences', label: 'Preferences' },
      { path: 'headless', label: 'Headless mode' },
      { path: 'accessibility', label: 'Accessibility' },
    ],
  },
];
