export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? '';

export const wagmiMetadata = {
  name: 'PVPAI OS',
  description: 'AI-powered autonomous trading agents on Hyperliquid',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  icons: ['/images/logo.svg'],
};
