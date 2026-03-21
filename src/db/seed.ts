import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

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
    // 1. Seed Specialties and Training Focus
    const categories = ['Weight Loss', 'Muscle Building', 'Endurance', 'Flexibility', 'Consultant', 'Diet Planner', 'Powerlifting', 'HIIT', 'Speed'];
    
    const seededSpecialties = await (db.insert(schema.specialties) as any).values(categories.map(name => ({ name }))).returning();
    const seededFocus = await (db.insert(schema.trainingFocus) as any).values(categories.map(name => ({ name }))).returning();
    
    console.log('Specialties and training focus seeded.');

    // 2. Seed 6 Users
    const usersData = [
      { name: 'Ghimire User', email: 'ghimire@askal.fit' },
      { name: 'Alice Cooper', email: 'alice@askal.fit' },
      { name: 'Bob Marley', email: 'bob@askal.fit' },
      { name: 'Charlie Brown', email: 'charlie@askal.fit' },
      { name: 'Diana Prince', email: 'diana@askal.fit' },
      { name: 'Ethan Hunt', email: 'ethan@askal.fit' },
    ];

    const seededUsers = [];
    for (const u of usersData) {
      const [user] = await (db.insert(schema.users) as any).values({
        email: u.email,
        password: commonPassword,
        fullName: u.name,
        role: 'user',
        onboardingCompleted: true,
      }).returning();
      seededUsers.push(user);
    }
    console.log(`${seededUsers.length} users seeded.`);

    // 3. Seed 5 Trainers
    const trainersData = [
      { 
        name: 'Marcus Sterling', 
        specialty: 'Strength & Conditioning', 
        bio: 'Elite conditioning coach specializing in athletic performance and biomechanics.', 
        price: 95,
        intensity: 4,
        location: 'Gym',
        img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1200&auto=format&fit=crop',
        hours: { start: '07:00', end: '15:00', closed: [0, 6] },
        specialties: ['Muscle Building', 'Endurance'],
        focus: ['Weight Loss']
      },
      { 
        name: 'Sarah Jenkins', 
        specialty: 'Yoga & Mindfulness', 
        bio: 'Certified Hatha and Vinyasa instructor with 10 years experience helping athletes find balance.', 
        price: 75,
        intensity: 2,
        location: 'Home',
        img: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1200&auto=format&fit=crop',
        hours: { start: '09:00', end: '18:00', closed: [0, 1] },
        specialties: ['Flexibility', 'Consultant'],
        focus: ['Diet Planner']
      },
      { 
        name: 'David Chen', 
        specialty: 'Powerlifting & Hypertrophy', 
        bio: 'Specialist in heavy compounds and scientific hypertrophy for competitive athletes.', 
        price: 110,
        intensity: 5,
        location: 'Gym',
        img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1200&auto=format&fit=crop',
        hours: { start: '06:00', end: '14:00', closed: [6] },
        specialties: ['Powerlifting', 'Muscle Building'],
        focus: ['Endurance']
      },
      { 
        name: 'Emma Rodriguez', 
        specialty: 'HIIT & Bodyweight Mastery', 
        bio: 'High-intensity interval training expert focusing on functional movement and fat loss.', 
        price: 85,
        intensity: 5,
        location: 'Home',
        img: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=1200&auto=format&fit=crop',
        hours: { start: '10:00', end: '20:00', closed: [0] },
        specialties: ['HIIT', 'Endurance'],
        focus: ['Weight Loss']
      },
      { 
        name: 'Liam Thompson', 
        specialty: 'Sports Performance & Speed', 
        bio: 'Former track athlete dedicated to improving explosive speed and agility for field sports.', 
        price: 100,
        intensity: 4,
        location: 'Gym',
        img: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=1200&auto=format&fit=crop',
        hours: { start: '08:00', end: '16:00', closed: [0, 6] },
        specialties: ['Speed', 'Endurance'],
        focus: ['Muscle Building']
      }
    ];

    const seededTrainers = [];
    for (const t of trainersData) {
      const email = t.name.toLowerCase().split(' ')[0] + '@askal.fit';
      const [user] = await (db.insert(schema.users) as any).values({
        email,
        password: commonPassword,
        fullName: t.name,
        role: 'trainer',
        onboardingCompleted: true,
      }).returning();

      if (user) {
        const [trainer] = await (db.insert(schema.trainers) as any).values({
          userId: user.id,
          specialty: t.specialty,
          bio: t.bio,
          imageUrl: t.img,
          rating: 5,
          pricePerSession: t.price,
          intensity: t.intensity,
          location: t.location,
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
    console.log(`${seededTrainers.length} trainers seeded.`);

    // 4. Seed Bookings and Reviews
    const reviewComments = [
        "Incredible session! Really pushed my limits today.",
        "Great focus on technique. I feel much more confident.",
        "Exactly what I needed to get back on track. High energy!",
        "Very professional and knowledgeable. Highly recommend.",
        "The biomechanics focus was a eye-opener for me.",
        "Tough but fair. Can't wait for the next one!",
        "Super patient with beginners. Explains everything clearly.",
        "The best HIIT session I've ever had. So much sweat!",
    ];

    for (const trainer of seededTrainers) {
        // Give each trainer 3 random reviews from various users
        const availableUsers = [...seededUsers];
        for (let i = 0; i < 3; i++) {
            const userIndex = Math.floor(Math.random() * availableUsers.length);
            const user = availableUsers.splice(userIndex, 1)[0];
            
            // Create a completed booking first
            const [booking] = await (db.insert(schema.bookings) as any).values({
                userId: user.id,
                trainerId: trainer.id,
                date: '2026-03-20', // past date
                timeSlot: '10:00',
                status: 'completed',
            }).returning();

            // Add review
            await (db.insert(schema.reviews) as any).values({
                bookingId: booking.id,
                userId: user.id,
                trainerId: trainer.id,
                rating: Math.floor(Math.random() * 2) + 4, // 4 or 5 stars
                comment: reviewComments[Math.floor(Math.random() * reviewComments.length)],
            });
        }
    }
    console.log('Bookings and reviews seeded.');

    console.log('Seed completed successfully!');
  } catch (err) {
    console.error('Seed failed:', err);
  } finally {
    await pool.end();
  }
}

main();
