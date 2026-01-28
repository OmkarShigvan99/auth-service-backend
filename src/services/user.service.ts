import * as bcrypt from "bcrypt";
import { prisma } from "../configs/prisma.config";

interface CreateUserInput {
    email: string;
    password: string;
}

interface UserOutput {
    id: string;
    email: string;
    createdAt: Date;
}

export async function createUser(input: CreateUserInput): Promise<UserOutput> {
    const { email, password } = input;

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
        data: {
            email,
            passwordHash,
        },
        select: {
            id: true,
            email: true,
            createdAt: true,
        },
    });

    return user;
}

export async function getUser(userId: string): Promise<UserOutput | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            createdAt: true,
        },
    });

    return user;
}
