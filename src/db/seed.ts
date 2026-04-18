import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

const EMBED_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';

async function embed(text: string, taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' | 'SEMANTIC_SIMILARITY' = 'SEMANTIC_SIMILARITY'): Promise<number[] | null> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) {
    console.warn('  ⚠ GOOGLE_GENERATIVE_AI_API_KEY missing — skipping embedding.');
    return null;
  }
  try {
    const res = await fetch(`${EMBED_ENDPOINT}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        taskType,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn(`  ⚠ Embedding ${res.status}: ${body.slice(0, 160)}`);
      return null;
    }
    const data: any = await res.json();
    return data?.embedding?.values || null;
  } catch (err: any) {
    console.warn(`  ⚠ Embedding fetch failed: ${err?.message || err}`);
    return null;
  }
}

function trainerCorpus(t: { name: string; specialty: string; bio: string; focus: string[]; specialties: string[]; intensity: number; location: string }) {
  const intensityWord = ['light', 'moderate', 'firm', 'intense', 'extreme'][Math.max(0, Math.min(4, t.intensity - 1))];
  return [
    `Trainer ${t.name}.`,
    `Specialty: ${t.specialty}.`,
    t.focus.length ? `Primary focus areas: ${t.focus.join(', ')}.` : '',
    t.specialties.length ? `Additional specialties: ${t.specialties.join(', ')}.` : '',
    `Training intensity is ${intensityWord} (level ${t.intensity} of 5).`,
    `Sessions held at ${t.location}.`,
    `About: ${t.bio}`,
  ].filter(Boolean).join(' ');
}

function userCorpus(u: { goal: string; workoutType: string; activityLevel: string; experienceLevel: string; healthConditions: string[]; dietPreference: string; age: number }) {
  return [
    `Primary fitness goal: ${u.goal}.`,
    `Preferred workout style: ${u.workoutType}.`,
    `Daily activity level: ${u.activityLevel.replace('_', ' ')}.`,
    `Training experience: ${u.experienceLevel}.`,
    u.healthConditions.length > 0 ? `Health considerations: ${u.healthConditions.join(', ')}.` : 'No reported health conditions.',
    u.dietPreference && u.dietPreference !== 'None' ? `Diet preference: ${u.dietPreference}.` : '',
    `Age: ${u.age}.`,
  ].filter(Boolean).join(' ');
}

async function main() {
  console.log('--- Database Cleanup ---');

  try {
    await db.delete(schema.reviews);
    await db.delete(schema.bookings);
    await db.delete(schema.trainerAvailability);
    await db.delete(schema.trainerSpecialties);
    await db.delete(schema.trainerTrainingFocus);
    await db.delete(schema.onboardingData);
    await db.delete(schema.trainers);
    await db.delete(schema.specialties);
    await db.delete(schema.trainingFocus);
    await db.delete(schema.users);
    console.log('All existing data cleared.');
  } catch (err) {
    console.error('Cleanup failed:', err);
  }

  console.log('--- Seeding New Data ---');

  const commonPassword = await bcrypt.hash('aspire5610', 10);

  try {
    // 1. Specialties + Training Focus
    const categories = [
      'Weight Loss', 'Muscle Building', 'Endurance', 'Flexibility',
      'Consultant', 'Diet Planner', 'Powerlifting', 'HIIT',
      'Speed', 'Strength Training', 'Cardio',
    ];

    const seededSpecialties = await (db.insert(schema.specialties) as any).values(categories.map(name => ({ name }))).returning();
    const seededFocus = await (db.insert(schema.trainingFocus) as any).values(categories.map(name => ({ name }))).returning();

    console.log('Specialties and training focus seeded.');

    // 2. Users — with onboarding profiles to power recommendation testing
    const usersData = [
      {
        name: 'Thapa User',
        email: 'thapa@askal.fit',
        onboarding: { goal: 'Build Muscle', age: 26, height: 178, weight: 76, activityLevel: 'active', experienceLevel: 'intermediate', healthConditions: [], workoutType: 'Gym', dietPreference: 'Non-veg' },
      },
      {
        name: 'Alice Cooper',
        email: 'alice@askal.fit',
        onboarding: { goal: 'Lose Weight', age: 32, height: 165, weight: 78, activityLevel: 'light', experienceLevel: 'beginner', healthConditions: ['Knee pain'], workoutType: 'Home', dietPreference: 'Veg' },
      },
      {
        name: 'Bob Marley',
        email: 'bob@askal.fit',
        onboarding: { goal: 'Stay Fit', age: 41, height: 180, weight: 84, activityLevel: 'moderate', experienceLevel: 'intermediate', healthConditions: [], workoutType: 'Gym', dietPreference: 'Non-veg' },
      },
      {
        name: 'Charlie Brown',
        email: 'charlie@askal.fit',
        onboarding: { goal: 'Improve Health', age: 55, height: 172, weight: 90, activityLevel: 'sedentary', experienceLevel: 'beginner', healthConditions: ['Back pain', 'Heart condition'], workoutType: 'Home', dietPreference: 'Vegan' },
      },
      {
        name: 'Diana Prince',
        email: 'diana@askal.fit',
        onboarding: { goal: 'Build Muscle', age: 28, height: 170, weight: 65, activityLevel: 'very_active', experienceLevel: 'advanced', healthConditions: [], workoutType: 'Gym', dietPreference: 'Non-veg' },
      },
      {
        name: 'Ethan Hunt',
        email: 'ethan@askal.fit',
        onboarding: { goal: 'Stay Fit', age: 34, height: 182, weight: 80, activityLevel: 'active', experienceLevel: 'advanced', healthConditions: [], workoutType: 'Yoga', dietPreference: 'Veg' },
      },
      {
        name: 'Fiona Yang',
        email: 'fiona@askal.fit',
        onboarding: { goal: 'Lose Weight', age: 29, height: 168, weight: 72, activityLevel: 'moderate', experienceLevel: 'intermediate', healthConditions: [], workoutType: 'Home', dietPreference: 'Veg' },
      },
      {
        name: 'Gabriel Park',
        email: 'gabriel@askal.fit',
        onboarding: { goal: 'Improve Health', age: 47, height: 176, weight: 88, activityLevel: 'light', experienceLevel: 'beginner', healthConditions: ['Shoulder injury'], workoutType: 'Yoga', dietPreference: 'None' },
      },
    ];

    const seededUsers: any[] = [];
    for (const u of usersData) {
      const [user] = await (db.insert(schema.users) as any).values({
        email: u.email,
        password: commonPassword,
        fullName: u.name,
        role: 'user',
        onboardingCompleted: true,
      }).returning();

      // Onboarding row + embedding
      const userEmb = await embed(userCorpus(u.onboarding), 'RETRIEVAL_QUERY');
      await (db.insert(schema.onboardingData) as any).values({
        userId: user.id,
        goal: u.onboarding.goal,
        age: u.onboarding.age,
        height: u.onboarding.height,
        weight: u.onboarding.weight,
        activityLevel: u.onboarding.activityLevel,
        experienceLevel: u.onboarding.experienceLevel,
        healthConditions: JSON.stringify(u.onboarding.healthConditions),
        workoutType: u.onboarding.workoutType,
        dietPreference: u.onboarding.dietPreference,
        embedding: userEmb,
      });

      seededUsers.push(user);
    }
    console.log(`${seededUsers.length} users + onboarding seeded (with embeddings).`);

    // 3. Trainers — expanded roster
    const trainersData = [
      {
        name: 'Marcus Sterling',
        specialty: 'Strength & Conditioning',
        bio: 'Elite conditioning coach specializing in athletic performance and biomechanics. 12 years coaching collegiate athletes through to professional level.',
        price: 95,
        intensity: 4,
        location: 'Gym',
        img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1200&auto=format&fit=crop',
        hours: { start: '07:00', end: '15:00', closed: [0, 6] },
        specialties: ['Muscle Building', 'Endurance'],
        focus: ['Weight Loss', 'Strength Training']
      },
      {
        name: 'Sarah Jenkins',
        specialty: 'Yoga & Mindfulness',
        bio: 'Certified Hatha and Vinyasa instructor with 10 years experience helping clients build flexibility, recover from injuries, and reduce stress.',
        price: 75,
        intensity: 2,
        location: 'Home',
        img: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1200&auto=format&fit=crop',
        hours: { start: '09:00', end: '18:00', closed: [0, 1] },
        specialties: ['Flexibility', 'Consultant'],
        focus: ['Flexibility', 'Diet Planner']
      },
      {
        name: 'David Chen',
        specialty: 'Powerlifting & Hypertrophy',
        bio: 'Specialist in heavy compounds and scientific hypertrophy for competitive athletes. Squat, bench, and deadlift programming designed around your meet.',
        price: 110,
        intensity: 5,
        location: 'Gym',
        img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1200&auto=format&fit=crop',
        hours: { start: '06:00', end: '14:00', closed: [6] },
        specialties: ['Powerlifting', 'Muscle Building'],
        focus: ['Muscle Building', 'Strength Training']
      },
      {
        name: 'Emma Rodriguez',
        specialty: 'HIIT & Bodyweight Mastery',
        bio: 'High-intensity interval training expert focusing on functional movement and fat loss. No equipment needed — just your bodyweight and grit.',
        price: 85,
        intensity: 5,
        location: 'Home',
        img: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=1200&auto=format&fit=crop',
        hours: { start: '10:00', end: '20:00', closed: [0] },
        specialties: ['HIIT', 'Endurance'],
        focus: ['Weight Loss', 'HIIT']
      },
      {
        name: 'Liam Thompson',
        specialty: 'Sports Performance & Speed',
        bio: 'Former track athlete dedicated to improving explosive speed and agility for field sports. Sprint mechanics, plyometrics, and reactive training.',
        price: 100,
        intensity: 4,
        location: 'Gym',
        img: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=1200&auto=format&fit=crop',
        hours: { start: '08:00', end: '16:00', closed: [0, 6] },
        specialties: ['Speed', 'Endurance'],
        focus: ['Endurance', 'Cardio']
      },
      {
        name: 'Priya Sharma',
        specialty: 'Holistic Nutrition & Coaching',
        bio: 'Certified nutritionist blending evidence-based diet planning with mindful coaching. Sustainable habit change for fat loss and energy.',
        price: 70,
        intensity: 2,
        location: 'Virtual',
        img: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1200&auto=format&fit=crop',
        hours: { start: '09:00', end: '21:00', closed: [] },
        specialties: ['Diet Planner', 'Consultant'],
        focus: ['Diet Planner', 'Weight Loss']
      },
      {
        name: 'Jamal Carter',
        specialty: 'Functional Strength for Beginners',
        bio: 'Patient, encouraging coach who specializes in onboarding total beginners. Build foundational strength and confidence — no judgement, just progress.',
        price: 60,
        intensity: 2,
        location: 'Gym',
        img: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?q=80&w=1200&auto=format&fit=crop',
        hours: { start: '11:00', end: '19:00', closed: [0] },
        specialties: ['Muscle Building', 'Consultant'],
        focus: ['Strength Training', 'Muscle Building']
      },
      {
        name: 'Ava Müller',
        specialty: 'Endurance & Marathon Prep',
        bio: 'Two-time marathon finisher and endurance specialist. Personalized run blocks, lactate threshold work, and race-week tapering.',
        price: 90,
        intensity: 3,
        location: 'Home',
        img: 'https://images.unsplash.com/photo-1521146764736-56c929d59c83?q=80&w=1200&auto=format&fit=crop',
        hours: { start: '06:00', end: '12:00', closed: [3] },
        specialties: ['Endurance', 'Cardio'],
        focus: ['Endurance', 'Cardio']
      },
      {
        name: 'Noah Bennett',
        specialty: 'Senior Mobility & Heart Health',
        bio: 'Specialist in low-impact training for clients over 50. Cardiac-safe progressions, joint-friendly mobility, and balance-focused conditioning.',
        price: 80,
        intensity: 1,
        location: 'Virtual',
        img: 'https://images.unsplash.com/photo-1573497019418-b400bb3ab074?q=80&w=1200&auto=format&fit=crop',
        hours: { start: '09:00', end: '17:00', closed: [6] },
        specialties: ['Flexibility', 'Consultant'],
        focus: ['Flexibility']
      },
      {
        name: 'Maya Okafor',
        specialty: 'Pre/Postnatal & Women\'s Strength',
        bio: 'Pre and postnatal certified coach. Safe, progressive strength training for every trimester and the long road back to peak form.',
        price: 95,
        intensity: 3,
        location: 'Home',
        img: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?q=80&w=1200&auto=format&fit=crop',
        hours: { start: '10:00', end: '18:00', closed: [0, 6] },
        specialties: ['Muscle Building', 'Flexibility'],
        focus: ['Strength Training', 'Flexibility']
      },
    ];

    const seededTrainers: any[] = [];
    for (const t of trainersData) {
      const email = t.name.toLowerCase().split(' ')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '') + '@askal.fit';
      const [user] = await (db.insert(schema.users) as any).values({
        email,
        password: commonPassword,
        fullName: t.name,
        role: 'trainer',
        imageUrl: t.img,
        onboardingCompleted: true,
      }).returning();

      if (user) {
        const trainerEmb = await embed(trainerCorpus(t), 'RETRIEVAL_DOCUMENT');
        const [trainer] = await (db.insert(schema.trainers) as any).values({
          userId: user.id,
          specialty: t.specialty,
          bio: t.bio,
          rating: 5,
          pricePerSession: t.price,
          intensity: t.intensity,
          location: t.location,
          embedding: trainerEmb,
        }).returning();

        seededTrainers.push(trainer);

        // Join tables
        const specIds = seededSpecialties.filter((s: any) => t.specialties.includes(s.name)).map((s: any) => s.id);
        const focusIds = seededFocus.filter((s: any) => t.focus.includes(s.name)).map((s: any) => s.id);

        for (const sId of specIds) await (db.insert(schema.trainerSpecialties) as any).values({ trainerId: trainer.id, specialtyId: sId });
        for (const fId of focusIds) await (db.insert(schema.trainerTrainingFocus) as any).values({ trainerId: trainer.id, focusId: fId });

        for (let day = 0; day <= 6; day++) {
          const isClosed = t.hours.closed.includes(day);
          await (db.insert(schema.trainerAvailability) as any).values({
            trainerId: trainer.id,
            dayOfWeek: day,
            startTime: t.hours.start,
            endTime: t.hours.end,
            isClosed: isClosed,
          });
        }
      }
    }
    console.log(`${seededTrainers.length} trainers seeded (with embeddings).`);

    // 4. Bookings + Reviews
    const reviewComments = [
      "Incredible session! Really pushed my limits today.",
      "Great focus on technique. I feel much more confident.",
      "Exactly what I needed to get back on track. High energy!",
      "Very professional and knowledgeable. Highly recommend.",
      "The biomechanics focus was an eye-opener for me.",
      "Tough but fair. Can't wait for the next one!",
      "Super patient with beginners. Explains everything clearly.",
      "The best HIIT session I've ever had. So much sweat!",
      "Listened to my injury history and adapted everything safely.",
      "Helped me run my first 10K — will book again before the marathon.",
    ];

    let totalReviews = 0;
    for (const trainer of seededTrainers) {
      const reviewerCount = Math.min(seededUsers.length, 3 + Math.floor(Math.random() * 3));
      const availableUsers = [...seededUsers];
      for (let i = 0; i < reviewerCount; i++) {
        const userIndex = Math.floor(Math.random() * availableUsers.length);
        const user = availableUsers.splice(userIndex, 1)[0];

        const [booking] = await (db.insert(schema.bookings) as any).values({
          userId: user.id,
          trainerId: trainer.id,
          date: '2026-03-20',
          timeSlot: '10:00',
          status: 'completed',
        }).returning();

        await (db.insert(schema.reviews) as any).values({
          bookingId: booking.id,
          userId: user.id,
          trainerId: trainer.id,
          rating: Math.floor(Math.random() * 2) + 4,
          comment: reviewComments[Math.floor(Math.random() * reviewComments.length)],
        });
        totalReviews++;
      }

      // Recompute avg rating from reviews so seeded data is realistic
      const result: any = await db.execute(
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('drizzle-orm').sql`SELECT AVG(rating)::float AS avg FROM reviews WHERE trainer_id = ${trainer.id}`,
      );
      const avg = result.rows?.[0]?.avg;
      if (avg != null) {
        await (db.update(schema.trainers) as any).set({ rating: avg }).where(eq(schema.trainers.id, trainer.id));
      }
    }
    console.log(`Bookings and ${totalReviews} reviews seeded.`);

    console.log('Seed completed successfully!');
  } catch (err) {
    console.error('Seed failed:', err);
  } finally {
    await pool.end();
  }
}

main();
