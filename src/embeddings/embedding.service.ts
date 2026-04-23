import { Injectable, Logger } from '@nestjs/common';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';

type TaskType = 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' | 'SEMANTIC_SIMILARITY';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  private get apiKey(): string | undefined {
    return process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  }

  async embed(text: string, taskType: TaskType = 'SEMANTIC_SIMILARITY'): Promise<number[] | null> {
    if (!this.apiKey) {
      this.logger.warn('GOOGLE_GENERATIVE_AI_API_KEY not set — skipping embedding.');
      return null;
    }
    const cleaned = (text || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return null;

    try {
      const res = await fetch(`${ENDPOINT}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { parts: [{ text: cleaned }] },
          taskType,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        this.logger.warn(`Embedding API ${res.status}: ${body.slice(0, 200)}`);
        return null;
      }

      const data: any = await res.json();
      const values = data?.embedding?.values;
      return Array.isArray(values) ? values : null;
    } catch (err: any) {
      this.logger.warn(`Embedding fetch failed: ${err?.message || err}`);
      return null;
    }
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  // Build a descriptive corpus for a trainer
  trainerText(t: {
    name?: string | null;
    specialty?: string | null;
    bio?: string | null;
    focus?: string[] | null;
    specialties?: string[] | null;
    intensity?: number | null;
    location?: string | null;
  }): string {
    const intensityWords =
      t.intensity != null ? ['light', 'moderate', 'firm', 'intense', 'extreme'][Math.max(0, Math.min(4, t.intensity - 1))] : 'moderate';
    const focusList = (t.focus || []).join(', ');
    const specList = (t.specialties || []).join(', ');
    return [
      t.name && `Trainer ${t.name}.`,
      t.specialty && `Specialty: ${t.specialty}.`,
      focusList && `Primary focus areas: ${focusList}.`,
      specList && `Additional specialties: ${specList}.`,
      `Training intensity is ${intensityWords} (level ${t.intensity ?? 3} of 5).`,
      t.location && `Sessions held at ${t.location}.`,
      t.bio && `About: ${t.bio}`,
    ]
      .filter(Boolean)
      .join(' ');
  }

  // Flatten health conditions from either old array format or new structured {painAreas,conditions,notes} format
  private flattenHealthConditions(raw: any): string[] {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') {
      const { painAreas = [], conditions = [], notes = '' } = raw as {
        painAreas?: string[]; conditions?: string[]; notes?: string;
      };
      return [...painAreas, ...conditions, ...(notes ? [notes] : [])];
    }
    try {
      return this.flattenHealthConditions(JSON.parse(raw || '[]'));
    } catch { return []; }
  }

  // Build a descriptive corpus for a user's onboarding profile
  userText(u: {
    goal?: string | null;
    age?: number | null;
    workoutType?: string | null;
    activityLevel?: string | null;
    experienceLevel?: string | null;
    healthConditions?: any;
    dietPreference?: string | null;
  }): string {
    const conditions = this.flattenHealthConditions(u.healthConditions);
    return [
      u.goal && `Primary fitness goal: ${u.goal}.`,
      u.workoutType && `Preferred workout style: ${u.workoutType}.`,
      u.activityLevel && `Daily activity level: ${u.activityLevel.replace('_', ' ')}.`,
      u.experienceLevel && `Training experience: ${u.experienceLevel}.`,
      conditions.length > 0 ? `Health considerations: ${conditions.join(', ')}.` : 'No reported health conditions.',
      u.dietPreference && u.dietPreference !== 'None' && `Diet preference: ${u.dietPreference}.`,
      u.age && `Age: ${u.age}.`,
    ]
      .filter(Boolean)
      .join(' ');
  }
}
