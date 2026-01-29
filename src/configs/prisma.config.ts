import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

// PostgreSQL SSL certificates can be configured via DATABASE_URL connection string:
// postgresql://user:pass@host:5432/db?sslmode=require&sslrootcert=/path/to/ca.crt&sslcert=/path/to/client.crt&sslkey=/path/to/client.key
// Or set NODE_EXTRA_CA_CERTS environment variable for system-wide certificate trust

const connectionString = `${process.env.DATABASE_URL}`;

if (!connectionString) {
    throw new Error("DATABASE_URL is not defined in environment variables");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

console.log("Database connected successfully");

export { prisma };
