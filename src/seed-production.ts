import { prisma } from "./configs/prisma.config";
import {
    PlanType,
    ContentType,
    VideoQuality,
} from "../generated/prisma/client";

async function main() {
    console.log("Starting production seed...");

    // Create Plans
    const plans = await Promise.all([
        prisma.plan.upsert({
            where: { type: PlanType.FREE },
            update: {},
            create: { type: PlanType.FREE, maxDevices: 1 },
        }),
        prisma.plan.upsert({
            where: { type: PlanType.BASIC },
            update: {},
            create: { type: PlanType.BASIC, maxDevices: 2 },
        }),
        prisma.plan.upsert({
            where: { type: PlanType.PREMIUM },
            update: {},
            create: { type: PlanType.PREMIUM, maxDevices: 4 },
        }),
        prisma.plan.upsert({
            where: { type: PlanType.ULTRA_PREMIUM },
            update: {},
            create: { type: PlanType.ULTRA_PREMIUM, maxDevices: 6 },
        }),
    ]);

    console.log(`Created ${plans.length} plans`);

    // Create Genres
    const genreNames = [
        "Action",
        "Comedy",
        "Drama",
        "Thriller",
        "Romance",
        "Horror",
        "Sci-Fi",
        "Fantasy",
        "Adventure",
        "Crime",
        "Mystery",
        "Documentary",
        "Sports",
        "Kids",
        "Animation",
    ];

    const genres = await Promise.all(
        genreNames.map((name) =>
            prisma.genre.upsert({
                where: { name },
                update: {},
                create: { name },
            }),
        ),
    );

    console.log(`Created ${genres.length} genres`);

    // Define content data
    const contentData = [
        {
            title: "The Last Stand",
            description:
                "A gripping action thriller about a final battle for survival",
            contentType: ContentType.MOVIE,
            duration: 142,
            releaseDate: new Date("2023-03-15"),
            rating: "A",
            genres: ["Action", "Thriller"],
        },
        {
            title: "Laugh Out Loud",
            description: "A hilarious comedy about life's unexpected moments",
            contentType: ContentType.MOVIE,
            duration: 105,
            releaseDate: new Date("2023-06-20"),
            rating: "UA",
            genres: ["Comedy"],
        },
        {
            title: "Heart Strings",
            description: "A beautiful love story that transcends time",
            contentType: ContentType.MOVIE,
            duration: 128,
            releaseDate: new Date("2023-02-14"),
            rating: "U",
            genres: ["Romance", "Drama"],
        },
        {
            title: "Dark Shadows",
            description:
                "A spine-chilling horror experience in an abandoned mansion",
            contentType: ContentType.MOVIE,
            duration: 98,
            releaseDate: new Date("2023-10-31"),
            rating: "A",
            genres: ["Horror", "Thriller"],
        },
        {
            title: "Space Odyssey",
            description: "An epic journey through the cosmos",
            contentType: ContentType.MOVIE,
            duration: 156,
            releaseDate: new Date("2023-07-04"),
            rating: "UA",
            genres: ["Sci-Fi", "Adventure"],
        },
        {
            title: "The Investigation",
            description: "A detective unravels a complex murder mystery",
            contentType: ContentType.SERIES,
            duration: 45,
            releaseDate: new Date("2023-01-10"),
            rating: "A",
            genres: ["Crime", "Mystery", "Thriller"],
        },
        {
            title: "Family Matters",
            description: "A heartwarming series about family bonds",
            contentType: ContentType.SERIES,
            duration: 30,
            releaseDate: new Date("2023-04-12"),
            rating: "U",
            genres: ["Comedy", "Drama"],
        },
        {
            title: "Kingdom of Dragons",
            description: "An epic fantasy series with dragons and magic",
            contentType: ContentType.SERIES,
            duration: 55,
            releaseDate: new Date("2023-05-01"),
            rating: "UA",
            genres: ["Fantasy", "Adventure", "Drama"],
        },
        {
            title: "Tech Revolution",
            description: "A documentary exploring the history of technology",
            contentType: ContentType.DOCUMENTARY,
            duration: 90,
            releaseDate: new Date("2023-03-20"),
            rating: "U",
            genres: ["Documentary"],
        },
        {
            title: "Wildlife Wonders",
            description: "Exploring the most amazing creatures on Earth",
            contentType: ContentType.DOCUMENTARY,
            duration: 75,
            releaseDate: new Date("2023-08-15"),
            rating: "U",
            genres: ["Documentary"],
        },
        {
            title: "Champions League Final",
            description: "The most anticipated football match of the year",
            contentType: ContentType.SPORTS,
            duration: 120,
            releaseDate: new Date("2023-05-28"),
            rating: "U",
            genres: ["Sports"],
        },
        {
            title: "Cricket World Cup",
            description: "The ultimate cricket championship",
            contentType: ContentType.SPORTS,
            duration: 480,
            releaseDate: new Date("2023-11-05"),
            rating: "U",
            genres: ["Sports"],
        },
        {
            title: "Adventure Time",
            description: "Animated adventures for the whole family",
            contentType: ContentType.KIDS,
            duration: 22,
            releaseDate: new Date("2023-01-05"),
            rating: "U",
            genres: ["Kids", "Animation", "Adventure"],
        },
        {
            title: "Magic School Bus",
            description: "Educational adventures for curious minds",
            contentType: ContentType.KIDS,
            duration: 25,
            releaseDate: new Date("2023-02-10"),
            rating: "U",
            genres: ["Kids", "Animation"],
        },
        {
            title: "The Heist",
            description: "A master criminal plans the ultimate robbery",
            contentType: ContentType.MOVIE,
            duration: 135,
            releaseDate: new Date("2023-09-22"),
            rating: "A",
            genres: ["Action", "Crime", "Thriller"],
        },
        {
            title: "Parallel Universe",
            description: "When two worlds collide, reality shifts",
            contentType: ContentType.MOVIE,
            duration: 148,
            releaseDate: new Date("2023-11-10"),
            rating: "UA",
            genres: ["Sci-Fi", "Thriller", "Mystery"],
        },
        {
            title: "Cooking Masters",
            description: "Top chefs compete in the ultimate culinary challenge",
            contentType: ContentType.SHOW,
            duration: 60,
            releaseDate: new Date("2023-03-01"),
            rating: "U",
            genres: ["Documentary"],
        },
        {
            title: "Stand-Up Special",
            description: "The funniest comedians perform live",
            contentType: ContentType.SHOW,
            duration: 75,
            releaseDate: new Date("2023-12-01"),
            rating: "A",
            genres: ["Comedy"],
        },
        {
            title: "Ocean Deep",
            description: "Exploring the mysteries of the deep sea",
            contentType: ContentType.DOCUMENTARY,
            duration: 85,
            releaseDate: new Date("2023-04-22"),
            rating: "U",
            genres: ["Documentary"],
        },
        {
            title: "The Rising Phoenix",
            description: "A warrior rises from the ashes to reclaim glory",
            contentType: ContentType.MOVIE,
            duration: 152,
            releaseDate: new Date("2023-08-18"),
            rating: "UA",
            genres: ["Action", "Fantasy", "Adventure"],
        },
        {
            title: "Love in Paris",
            description: "A romantic journey through the city of lights",
            contentType: ContentType.MOVIE,
            duration: 112,
            releaseDate: new Date("2023-06-14"),
            rating: "U",
            genres: ["Romance", "Comedy"],
        },
        {
            title: "The Haunted Manor",
            description: "A family moves into a house with a dark past",
            contentType: ContentType.SERIES,
            duration: 42,
            releaseDate: new Date("2023-10-13"),
            rating: "A",
            genres: ["Horror", "Mystery", "Thriller"],
        },
        {
            title: "City of Dreams",
            description:
                "Following the lives of ambitious individuals in the big city",
            contentType: ContentType.SERIES,
            duration: 48,
            releaseDate: new Date("2023-07-20"),
            rating: "UA",
            genres: ["Drama", "Romance"],
        },
        {
            title: "Ancient Civilizations",
            description: "Uncovering the secrets of lost empires",
            contentType: ContentType.DOCUMENTARY,
            duration: 95,
            releaseDate: new Date("2023-05-30"),
            rating: "U",
            genres: ["Documentary"],
        },
        {
            title: "Speed Racers",
            description: "High-octane racing action and drama",
            contentType: ContentType.MOVIE,
            duration: 118,
            releaseDate: new Date("2023-12-15"),
            rating: "UA",
            genres: ["Action", "Sports", "Drama"],
        },
        {
            title: "Mystery Island",
            description:
                "Survivors discover strange phenomena on a remote island",
            contentType: ContentType.SERIES,
            duration: 50,
            releaseDate: new Date("2023-09-05"),
            rating: "UA",
            genres: ["Mystery", "Sci-Fi", "Adventure"],
        },
        {
            title: "Tiny Explorers",
            description: "Little adventurers explore the wonders of nature",
            contentType: ContentType.KIDS,
            duration: 20,
            releaseDate: new Date("2023-03-15"),
            rating: "U",
            genres: ["Kids", "Animation", "Adventure"],
        },
    ];

    console.log(`Creating ${contentData.length} content items...`);

    // Create content with genres and access control
    for (const data of contentData) {
        const content = await prisma.content.create({
            data: {
                title: data.title,
                description: data.description,
                contentType: data.contentType,
                duration: data.duration,
                releaseDate: data.releaseDate,
                rating: data.rating,
                poster: `https://via.placeholder.com/300x450?text=${encodeURIComponent(data.title)}`,
                thumbnail: `https://via.placeholder.com/640x360?text=${encodeURIComponent(data.title)}`,
            },
        });

        // Link genres
        for (const genreName of data.genres) {
            const genre = genres.find((g) => g.name === genreName);
            if (genre) {
                await prisma.contentGenre.create({
                    data: {
                        contentId: content.id,
                        genreId: genre.id,
                    },
                });
            }
        }

        // Assign access based on content type
        // FREE plan: Kids content only in SD
        // BASIC plan: Movies/Shows in HD
        // PREMIUM plan: Everything except Sports in FHD
        // ULTRA_PREMIUM plan: Everything in UHD

        if (data.contentType === ContentType.KIDS) {
            await prisma.contentAccess.create({
                data: {
                    contentId: content.id,
                    planId: plans[0].id, // FREE
                    videoQuality: VideoQuality.SD,
                },
            });
        }

        await prisma.contentAccess.create({
            data: {
                contentId: content.id,
                planId: plans[1].id, // BASIC
                videoQuality: VideoQuality.HD,
            },
        });

        if (data.contentType !== ContentType.SPORTS) {
            await prisma.contentAccess.create({
                data: {
                    contentId: content.id,
                    planId: plans[2].id, // PREMIUM
                    videoQuality: VideoQuality.FHD,
                },
            });
        }

        await prisma.contentAccess.create({
            data: {
                contentId: content.id,
                planId: plans[3].id, // ULTRA_PREMIUM
                videoQuality: VideoQuality.UHD,
            },
        });
    }

    console.log("Production seed completed successfully!");
}

main()
    .catch((e) => {
        console.error("Error during seeding:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
