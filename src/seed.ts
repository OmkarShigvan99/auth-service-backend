import { prisma } from "./configs/prisma.config";
import { PlanType } from "../generated/prisma/client";

async function main() {
    console.log("Seeding plans...");

    const plans = [
        { type: PlanType.FREE, maxDevices: 1 },
        { type: PlanType.BASIC, maxDevices: 2 },
        { type: PlanType.PREMIUM, maxDevices: 5 },
        { type: PlanType.ULTRA_PREMIUM, maxDevices: 10 },
    ];

    for (const plan of plans) {
        const existingPlan = await prisma.plan.findUnique({
            where: { type: plan.type },
        });

        if (!existingPlan) {
            await prisma.plan.create({
                data: plan,
            });
            console.log(`Created plan: ${plan.type}`);
        } else {
            console.log(`Plan ${plan.type} already exists`);
        }
    }

    console.log("Seeding completed!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
