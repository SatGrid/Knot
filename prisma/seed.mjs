import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });

const ids = {
  satyam: "00000000-0000-4000-8000-000000000001",
  maya: "00000000-0000-4000-8000-000000000002",
  conversation: "00000000-0000-4000-8000-000000000010",
};

async function main() {
  await client.connect();
  await client.query("BEGIN");

  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword) throw new Error("DEMO_PASSWORD is required to seed the demo account.");
  const passwordHash = await hashPassword(demoPassword);

  await client.query(
    `INSERT INTO "User" (id, email, username, "displayName", "createdAt", "updatedAt")
     VALUES ($1, 'satyam@knot.local', 'satyam', 'Satyam', NOW(), NOW()),
            ($2, 'maya@knot.local', 'maya', 'Maya', NOW(), NOW())
     ON CONFLICT (id) DO UPDATE
     SET email = EXCLUDED.email,
         username = EXCLUDED.username,
         "displayName" = EXCLUDED."displayName",
         "updatedAt" = NOW()`,
    [ids.satyam, ids.maya],
  );

  await client.query(
    `INSERT INTO account (id, issuer, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), 'local:credential', $1::text, 'credential', $1::uuid, $2, NOW(), NOW())
     ON CONFLICT (issuer, "accountId") DO UPDATE
     SET password = EXCLUDED.password,
         "updatedAt" = NOW()`,
    [ids.satyam, passwordHash],
  );

  await client.query(
    `INSERT INTO "Conversation" (id, "isGroup", "createdAt", "updatedAt")
     VALUES ($1, false, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [ids.conversation],
  );

  await client.query(
    `INSERT INTO "ConversationMember" ("conversationId", "userId", role, "joinedAt")
     VALUES ($1, $2, 'OWNER', NOW()), ($1, $3, 'MEMBER', NOW())
     ON CONFLICT ("conversationId", "userId") DO NOTHING`,
    [ids.conversation, ids.satyam, ids.maya],
  );

  const existingMessages = await client.query(
    `SELECT COUNT(*)::int AS count FROM "Message" WHERE "conversationId" = $1`,
    [ids.conversation],
  );

  if (existingMessages.rows[0].count === 0) {
    await client.query(
      `INSERT INTO "Message" (id, "conversationId", "senderId", body, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 'Are we still meeting at the café tomorrow?', NOW() - INTERVAL '2 minutes', NOW()),
              (gen_random_uuid(), $1, $3, 'Yes, 10 works for me.', NOW() - INTERVAL '1 minute', NOW()),
              (gen_random_uuid(), $1, $2, 'Perfect. See you tomorrow.', NOW(), NOW())`,
      [ids.conversation, ids.maya, ids.satyam],
    );
  }

  await client.query("COMMIT");
}

main()
  .catch(async (error) => {
    await client.query("ROLLBACK");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
