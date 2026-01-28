import { prisma } from "./configs/prisma.config";
import {
    PlanType,
    ContentType,
    VideoQuality,
} from "../generated/prisma/client";
import { faker } from "@faker-js/faker";

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

    console.log("Seeding genres...");
    const genreNames = [
        "Action",
        "Comedy",
        "Drama",
        "Horror",
        "Romance",
        "Thriller",
        "Sci-Fi",
        "Fantasy",
        "Documentary",
        "Sports",
        "Kids",
        "Animation",
    ];

    const genres = [];
    for (const genreName of genreNames) {
        const existingGenre = await prisma.genre.findUnique({
            where: { name: genreName },
        });

        if (!existingGenre) {
            const genre = await prisma.genre.create({
                data: { name: genreName },
            });
            genres.push(genre);
            console.log(`Created genre: ${genreName}`);
        } else {
            genres.push(existingGenre);
            console.log(`Genre ${genreName} already exists`);
        }
    }

    console.log("Seeding content...");
    const contentTypes = [
        ContentType.MOVIE,
        ContentType.SERIES,
        ContentType.DOCUMENTARY,
        ContentType.SHOW,
        ContentType.SPORTS,
        ContentType.KIDS,
    ];

    const ratings = ["U", "UA", "A", "S"];
    const contents = [];

    // Create 30 pieces of content
    for (let i = 0; i < 30; i++) {
        const contentType =
            contentTypes[Math.floor(Math.random() * contentTypes.length)];
        const isMovie = contentType === ContentType.MOVIE;
        const duration = isMovie
            ? faker.number.int({ min: 90, max: 180 })
            : null;

        const content = await prisma.content.create({
            data: {
                title: faker.lorem.words(3),
                description: faker.lorem.paragraphs(2),
                poster: faker.image.url(),
                thumbnail: faker.image.url(),
                duration,
                releaseDate: faker.date.past({ years: 5 }),
                rating: ratings[Math.floor(Math.random() * ratings.length)],
                contentType,
                isActive: Math.random() > 0.1, // 90% active
            },
        });

        contents.push(content);
        console.log(`Created content: ${content.title}`);

        // Assign random genres to content
        const genreCount = faker.number.int({ min: 1, max: 3 });
        const selectedGenres = faker.helpers
            .shuffle(genres)
            .slice(0, genreCount);

        for (const genre of selectedGenres) {
            await prisma.contentGenre.create({
                data: {
                    contentId: content.id,
                    genreId: genre.id,
                },
            });
        }
    }

    console.log("Seeding content access (plan-aware)...");
    const allPlans = await prisma.plan.findMany();

    for (const content of contents) {
        // Determine which plans can access this content
        // FREE plan: limited content (40% of content)
        // BASIC plan: most content except premium (70% of content)
        // PREMIUM: most content (90% of content)
        // ULTRA_PREMIUM: all content (100% of content)

        const randomNum = Math.random();

        for (const plan of allPlans) {
            let shouldHaveAccess = false;
            let videoQuality: VideoQuality = VideoQuality.SD;

            if (plan.type === PlanType.FREE) {
                shouldHaveAccess = randomNum < 0.4;
                videoQuality = VideoQuality.SD;
            } else if (plan.type === PlanType.BASIC) {
                shouldHaveAccess = randomNum < 0.7;
                videoQuality = VideoQuality.HD;
            } else if (plan.type === PlanType.PREMIUM) {
                shouldHaveAccess = randomNum < 0.9;
                videoQuality = VideoQuality.FHD;
            } else if (plan.type === PlanType.ULTRA_PREMIUM) {
                shouldHaveAccess = true;
                videoQuality = VideoQuality.UHD;
            }

            if (shouldHaveAccess) {
                try {
                    await prisma.contentAccess.create({
                        data: {
                            contentId: content.id,
                            planId: plan.id,
                            videoQuality,
                        },
                    });
                } catch (error) {
                    // Ignore unique constraint errors (content-plan already exists)
                }
            }
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
