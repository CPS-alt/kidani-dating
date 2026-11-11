import type { UserProfile } from '../types';

interface ProfileWizardProps {
  profile: UserProfile | null;
  draft: {
    name: string;
    age: string;
    location: string;
    bio: string;
    hobbies: string;
    lookingFor: string;
  };
  onChange: (field: keyof ProfileWizardProps['draft'], value: string) => void;
  onSave: () => void;
}

const hobbyOptions = ['Travel', 'Cooking', 'Hiking', 'Reading', 'Art', 'Music', 'Wellness', 'Tech'];

export function ProfileWizard({ profile, draft, onChange, onSave }: ProfileWizardProps) {
  return (
    <section id="profile" className="profile-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Profile</p>
          <h3>{profile ? `Hi ${profile.name}` : 'Create your profile'}</h3>
        </div>
        <button type="button" className="ghost-btn" onClick={onSave}>
          Save profile
        </button>
      </div>

      <div className="profile-grid">
        <label>
          Display name
          <input value={draft.name} onChange={(event) => onChange('name', event.target.value)} />
        </label>
        <label>
          Age
          <input value={draft.age} onChange={(event) => onChange('age', event.target.value)} />
        </label>
        <label>
          City
          <input value={draft.location} onChange={(event) => onChange('location', event.target.value)} />
        </label>
        <label>
          Looking for
          <input value={draft.lookingFor} onChange={(event) => onChange('lookingFor', event.target.value)} />
        </label>
      </div>

      <label>
        Bio
        <textarea
          rows={4}
          value={draft.bio}
          onChange={(event) => onChange('bio', event.target.value)}
          placeholder="Tell people what kind of connection you want..."
        />
      </label>

      <div className="hobby-list">
        {hobbyOptions.map((item) => (
          <button
            type="button"
            key={item}
            className={draft.hobbies.includes(item) ? 'tag selected' : 'tag'}
            onClick={() => {
              const existing = draft.hobbies.split(',').map((tag) => tag.trim()).filter(Boolean);
              const next = existing.includes(item)
                ? existing.filter((tag) => tag !== item)
                : [...existing, item];
              onChange('hobbies', next.join(', '));
            }}
          >
            {item}
          </button>
        ))}
      </div>
    </section>
  );
}
