export type AuthMode = 'signup' | 'login';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  age: number;
  location: string;
  bio: string;
  hobbies: string[];
  lookingFor: string;
  matchScore: number;
  avatar: string;
  accountType?: 'woman' | 'man' | 'gay';
  profilePhoto?: string | null;
  whatsappNumber?: string | null;
  callNumber?: string | null;
  services?: Array<{ id: string; name: string; amount: number }>;
  online?: boolean;
}

export interface LocalMessage {
  id: string;
  matchId: string;
  sender: 'me' | 'match';
  text: string;
  sentAt: number;
}

export interface MatchProfile {
  id: string;
  name: string;
  age: number;
  location: string;
  gender: 'woman' | 'man' | 'gay';
  bio: string;
  hobbies: string[];
  compatibility: number;
  vibe: string;
  avatar: string;
  profilePhoto?: string | null;
  hasProfilePhoto?: boolean;
  mobileNumber?: string;
  whatsappNumber?: string;
  services?: Array<{ id?: string; name: string; amount: number }>;
  membership?: string;
  membershipEndsAt?: number;
  lastMessage?: string | null;
  lastMessageAt?: number | null;
}

export interface SignupDetails {
  name: string;
  email: string;
  password: string;
  age: number;
  location: string;
  phoneNumber: string;
  accountType: 'woman' | 'man' | 'gay';
}

export interface ProfileUpdate {
  name: string;
  age: number;
  location: string;
  bio: string;
  phoneNumber: string;
  whatsappNumber: string;
  callNumber: string;
  services: Array<{ id: string; name: string; amount: number }>;
  profilePhoto: string | null;
  online: boolean;
}
