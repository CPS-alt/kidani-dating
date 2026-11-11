import type { MatchProfile } from '../types';

interface MatchGridProps {
  matches: MatchProfile[];
  interestedMatchIds: string[];
  notice: string;
  onSendInterest: (match: MatchProfile) => void;
}

export function MatchGrid({ matches, interestedMatchIds, notice, onSendInterest }: MatchGridProps) {
  return (
    <section className="matches-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Matches</p>
          <h3>Recommended for you</h3>
        </div>
      </div>

      {notice ? <p className="status-message" role="status">{notice}</p> : null}

      <div className="match-grid">
        {matches.map((match) => (
          <article key={match.id} className="match-card">
            <div className="match-topline">
              <div className="avatar">{match.avatar}</div>
              <div>
                <strong>{match.name}</strong>
                <span>
                  {match.age}, {match.location}
                </span>
              </div>
            </div>

            <div className="compatibility">
              <span>Compatibility</span>
              <strong>{match.compatibility}%</strong>
            </div>

            <p>{match.bio}</p>

            <div className="tag-row">
              {match.hobbies.map((hobby) => (
                <span key={`${match.id}-${hobby}`} className="tag soft">
                  {hobby}
                </span>
              ))}
            </div>

            <div className="match-footer">
              <small>{match.vibe}</small>
              <button
                type="button"
                className={interestedMatchIds.includes(match.id) ? 'ghost-btn' : 'primary-btn small'}
                onClick={() => onSendInterest(match)}
                disabled={interestedMatchIds.includes(match.id)}
              >
                {interestedMatchIds.includes(match.id) ? 'Interest sent' : 'Say hi'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
