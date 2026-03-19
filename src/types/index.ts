export type UserRole = 'user' | 'trainer';

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
  onboardingCompleted: boolean;
  createdAt: Date;
}

export interface OnboardingData {
  id?: number;
  userId: number;
  goal: string;
  age: number;
  height: number;
  weight: number;
  activityLevel: string;
  experienceLevel: string;
  healthConditions: string[]; // Handled as JSON string in DB
  workoutType: string;
  dietPreference: string;
}

export interface Trainer {
  id: number;
  userId: number;
  name: string; // From joined users table
  specialty: string;
  bio: string;
  imageUrl?: string;
  rating: number;
}

export interface Booking {
  id: number;
  userId: number;
  trainerId: number;
  date: Date;
  status: 'pending' | 'confirmed' | 'cancelled';
}

export interface AuthResponse {
  access_token: string;
  user: Omit<User, 'createdAt'>;
}
