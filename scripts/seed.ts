import { hash } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { organizations, users } from '../src/db/schema/index.js';

const ARGON2_OPTIONS = {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
};

async function main(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error('DATABASE_URL is not defined');
        process.exit(1);
    }

    const client = postgres(databaseUrl);
    const db = drizzle(client);

    console.log('🌱 Seeding database...');

    // Create organization
    const [org] = await db
        .insert(organizations)
        .values({
            name: 'Default Organization',
            slug: 'default',
        })
        .onConflictDoNothing({ target: organizations.slug })
        .returning();

    const orgId =
        org?.id ??
        (
            await db
                .select()
                .from(organizations)
                .where(eq(organizations.slug, 'default'))
                .limit(1)
        )[0].id;

    console.log(`✅ Organization created/found: ${orgId}`);

    // Create admin user
    const passwordHash = await hash('admin123', ARGON2_OPTIONS);
    await db
        .insert(users)
        .values({
            organizationId: orgId,
            email: 'admin@chatopshub.local',
            passwordHash,
            name: 'Admin User',
            role: 'ADMIN',
            status: 'ACTIVE',
        })
        .onConflictDoNothing();

    console.log('✅ Admin user created');
    console.log('');
    console.log('📋 Admin credentials:');
    console.log('   Email: admin@chatopshub.local');
    console.log('   Password: admin123');
    console.log('');
    console.log('🎉 Seed completed!');

    await client.end();
}

main().catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
});
