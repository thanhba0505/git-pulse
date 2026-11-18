import { PrismaClient, Role } from '@prisma/client';
import { encryptS2SSecret } from '../src/s2s/s2s-vault.util';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME || 'admin';
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@gitpulse.local';

  const admin = await prisma.user.upsert({
    where: { username },
    update: {
      email,
      role: Role.ADMIN,
      isActive: true,
    },
    create: {
      username,
      email,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  console.log(`[Seed] Seeded admin user: ${admin.username} (Role: ${admin.role})`);

  // Seed Central Gateway S2S connection
  const rawApiKey = process.env.GATEWAY_S2S_KEY || 'gp_to_gw_s2s_secret_2026';
  const rawIncomingSecret = process.env.GATEWAY_INCOMING_SECRET || 'gw_to_gp_s2s_secret_2026';

  const encryptedApiKey = encryptS2SSecret(rawApiKey);
  const encryptedIncomingSecret = encryptS2SSecret(rawIncomingSecret);

  const gatewayConn = await prisma.serviceConnection.upsert({
    where: { slug: 'central-gateway' },
    update: {
      name: 'Central Gateway & IAM Master',
      domain: process.env.GATEWAY_API_DOMAIN || 'https://central-gateway-server.vercel.app',
      apiPrefix: process.env.GATEWAY_API_PREFIX || '/api/v1',
      apiKey: encryptedApiKey,
      incomingSecret: encryptedIncomingSecret,
      isActive: true,
      metadata: { iamMaster: true, ssoProvider: true },
    },
    create: {
      slug: 'central-gateway',
      name: 'Central Gateway & IAM Master',
      domain: process.env.GATEWAY_API_DOMAIN || 'https://central-gateway-server.vercel.app',
      apiPrefix: process.env.GATEWAY_API_PREFIX || '/api/v1',
      apiKey: encryptedApiKey,
      incomingSecret: encryptedIncomingSecret,
      isActive: true,
      metadata: { iamMaster: true, ssoProvider: true },
    },
  });

  console.log(`[Seed] Seeded service connection: ${gatewayConn.name} (${gatewayConn.slug})`);
}

main()
  .catch((e) => {
    console.error('[Seed] Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
