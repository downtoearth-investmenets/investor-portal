export type DemoAccountGroup = { role: string; emails: readonly string[] };

export const demoAccountGroups: readonly DemoAccountGroup[] = [
  {
    role: 'Admin',
    emails: ['admin.one@portal.example', 'admin.two@portal.example']
  },
  {
    role: 'Investor',
    emails: ['investor.one@portal.example', 'investor.two@portal.example', 'investor.three@portal.example']
  }
];
