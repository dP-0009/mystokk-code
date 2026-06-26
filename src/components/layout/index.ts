/**
 * Authenticated app layout shell — the desktop/web sidebar layout from the UI
 * mirror. Compose as:
 *
 *   <AppShell sidebar={<Sidebar footer={<SidebarFooter … />}>{navItems}</Sidebar>}>
 *     <PageHeader title="…" subtitle="…" actions={…} />
 *     <PageBody>{…}</PageBody>
 *   </AppShell>
 *   <NotificationBell onPress={…} />
 */
export { AppShell } from './AppShell';
export { MainLayout } from './MainLayout';
export { Sidebar } from './Sidebar';
export { SidebarNav, type SidebarNavId } from './SidebarNav';
export { NavItem } from './NavItem';
export { SidebarFooter, type FooterLink } from './SidebarFooter';
export { PageHeader } from './PageHeader';
export { PageBody } from './PageBody';
export { NotificationBell } from './NotificationBell';
