export interface Standing {
  participantId: string;
  teamName: string;
  totalPoints: number;
  yesterdayPoints: number;
  roster: {
    playerId: string;
    playerName: string;
    team: string;
    position: string;
    round: number;
    goals: number;
    assists: number;
    points: number;
    gamesPlayed: number;
  }[];
}

export interface TonightGame {
  gameId: number;
  away: string;
  home: string;
  time: string;
}

const NHL_ESPN_SLUGS: Record<string, string> = {
  ANA: 'ana', BOS: 'bos', BUF: 'buf', CAR: 'car', CBJ: 'cbj', CGY: 'cgy',
  CHI: 'chi', COL: 'col', DAL: 'dal', DET: 'det', EDM: 'edm', FLA: 'fla',
  LAK: 'la', MIN: 'min', MTL: 'mtl', NJD: 'nj', NSH: 'nsh', NYI: 'nyi',
  NYR: 'nyr', OTT: 'ott', PHI: 'phi', PIT: 'pit', SEA: 'sea', SJS: 'sj',
  STL: 'stl', TBL: 'tb', TOR: 'tor', UTA: 'uta', VAN: 'van', VGK: 'vgk',
  WPG: 'wpg', WSH: 'wsh',
};

function getLogoUrl(team: string): string {
  const slug = NHL_ESPN_SLUGS[team.toUpperCase()] ?? team.toLowerCase();
  return `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nhl/500/${slug}.png`;
}

function getMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generateDailyEmailSubject(draftName: string): string {
  return `${draftName} — Yesterday's Results & Tonight's Games`;
}

interface EmailParams {
  draftName: string;
  seasonType: string;
  date: string;
  standings: Standing[];
  myStanding: Standing;
  myRank: number;
  myPlayersYesterday: {
    playerName: string;
    team: string;
    opponent: string;
    result: string;
    points: number;
    goals: number;
    assists: number;
  }[];
  totalRosterSize: number;
  tonightGames: TonightGame[];
  myPlayersTonight: Map<number, { name: string; position: string; team: string }[]>;
  standingsUrl: string;
  recapUrl: string;
}

export function generateDailyEmailHtml(params: EmailParams): string {
  const {
    draftName,
    seasonType,
    date,
    standings,
    myStanding,
    myRank,
    myPlayersYesterday,
    totalRosterSize,
    tonightGames,
    myPlayersTonight,
    standingsUrl,
    recapUrl,
  } = params;

  const gamesBack = standings.length > 0
    ? Math.max(0, standings[0].totalPoints - myStanding.totalPoints)
    : 0;

  const playersPlayedCount = myPlayersYesterday.length;

  const headerSection = `
    <div style="background: linear-gradient(135deg, #16a34a, #15803d); padding: 24px 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <div style="color: #bbf7d0; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px;">Daily Update</div>
      <div style="color: #ffffff; font-size: 22px; font-weight: bold;">${escapeHtml(draftName)}</div>
      <div style="color: #dcfce7; font-size: 14px; margin-top: 4px;">${escapeHtml(seasonType)} · ${escapeHtml(date)}</div>
    </div>`;

  const statsCards = `
    <div style="display: flex; gap: 8px; padding: 16px 16px 8px;">
      <div style="flex: 1; background: #f0fdf4; border-radius: 8px; padding: 12px 8px; text-align: center;">
        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Position</div>
        <div style="font-size: 20px; font-weight: bold; color: #111827;">${getMedal(myRank)} ${myRank}${myRank === 1 ? 'st' : myRank === 2 ? 'nd' : myRank === 3 ? 'rd' : 'th'}</div>
      </div>
      <div style="flex: 1; background: #f0fdf4; border-radius: 8px; padding: 12px 8px; text-align: center;">
        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Total Pts</div>
        <div style="font-size: 20px; font-weight: bold; color: #111827;">${myStanding.totalPoints}</div>
      </div>
      <div style="flex: 1; background: #f0fdf4; border-radius: 8px; padding: 12px 8px; text-align: center;">
        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Yesterday</div>
        <div style="font-size: 20px; font-weight: bold; color: #16a34a;">+${myStanding.yesterdayPoints}</div>
      </div>
      <div style="flex: 1; background: #f0fdf4; border-radius: 8px; padding: 12px 8px; text-align: center;">
        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase;">Games Back</div>
        <div style="font-size: 20px; font-weight: bold; color: #111827;">${gamesBack}</div>
      </div>
    </div>`;

  let playersSection: string;
  if (playersPlayedCount === 0) {
    playersSection = `
      <div style="padding: 16px;">
        <div style="font-size: 16px; font-weight: bold; color: #111827; margin-bottom: 12px;">Your Players Yesterday</div>
        <div style="background: #f9fafb; border-radius: 8px; padding: 20px; text-align: center; color: #6b7280; font-size: 14px;">
          No players were in action yesterday
        </div>
      </div>`;
  } else {
    const playerRows = myPlayersYesterday.map(p => {
      const gaParts: string[] = [];
      if (p.goals > 0) gaParts.push(`${p.goals}G`);
      if (p.assists > 0) gaParts.push(`${p.assists}A`);
      const gaText = gaParts.length > 0 ? ` (${gaParts.join(', ')})` : '';

      return `
        <tr>
          <td style="padding: 8px 0; vertical-align: middle;">
            <img src="${getLogoUrl(p.team)}" width="20" height="20" style="display: inline-block; vertical-align: middle; margin-right: 6px;" alt="${escapeHtml(p.team)}" />
            <span style="font-weight: 500; color: #111827;">${escapeHtml(p.playerName)}</span>
          </td>
          <td style="padding: 8px 4px; text-align: center; color: #6b7280; font-size: 13px;">${escapeHtml(p.result)}</td>
          <td style="padding: 8px 0; text-align: right;">
            <span style="color: #16a34a; font-weight: bold;">+${p.points}</span>
            <span style="color: #6b7280; font-size: 12px;">${gaText}</span>
          </td>
        </tr>`;
    }).join('');

    playersSection = `
      <div style="padding: 16px;">
        <div style="font-size: 16px; font-weight: bold; color: #111827; margin-bottom: 12px;">Your Players Yesterday</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          ${playerRows}
        </table>
        <div style="margin-top: 8px; font-size: 12px; color: #6b7280; text-align: center;">
          ${playersPlayedCount} of your ${totalRosterSize} players were in action yesterday
        </div>
      </div>`;
  }

  let tonightsGamesSection: string;
  if (tonightGames.length === 0) {
    tonightsGamesSection = `
      <div style="padding: 16px;">
        <div style="font-size: 16px; font-weight: bold; color: #111827; margin-bottom: 12px;">Tonight's Games</div>
        <div style="background: #f9fafb; border-radius: 8px; padding: 20px; text-align: center; color: #6b7280; font-size: 14px;">
          No games scheduled for tonight
        </div>
      </div>`;
  } else {
    const gameCards = tonightGames.map(game => {
      const myPlayers = myPlayersTonight.get(game.gameId) ?? [];
      const hasMyPlayers = myPlayers.length > 0;

      const borderColor = hasMyPlayers ? '#16a34a' : '#e5e7eb';
      const bgColor = hasMyPlayers ? '#f0fdf4' : '#ffffff';

      const playersList = hasMyPlayers
        ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #d1fae5;">
            <div style="font-size: 11px; color: #16a34a; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">Your Players</div>
            ${myPlayers.map(p => `<div style="font-size: 13px; color: #374151;">${escapeHtml(p.name)} <span style="color: #9ca3af;">· ${escapeHtml(p.position)} · ${escapeHtml(p.team)}</span></div>`).join('')}
           </div>`
        : '';

      const badge = hasMyPlayers
        ? `<span style="display: inline-block; background: #16a34a; color: #ffffff; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 10px; margin-left: 6px;">${myPlayers.length} PLAYER${myPlayers.length !== 1 ? 'S' : ''}</span>`
        : '';

      return `
        <div style="background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 8px; padding: 12px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <img src="${getLogoUrl(game.away)}" width="20" height="20" alt="${escapeHtml(game.away)}" />
              <span style="font-weight: 500; color: #111827;">${escapeHtml(game.away)}</span>
              <span style="color: #9ca3af; font-size: 13px;">@</span>
              <img src="${getLogoUrl(game.home)}" width="20" height="20" alt="${escapeHtml(game.home)}" />
              <span style="font-weight: 500; color: #111827;">${escapeHtml(game.home)}</span>
              ${badge}
            </div>
            <div style="color: #6b7280; font-size: 13px;">${escapeHtml(game.time)}</div>
          </div>
          ${playersList}
        </div>`;
    }).join('');

    tonightsGamesSection = `
      <div style="padding: 16px;">
        <div style="font-size: 16px; font-weight: bold; color: #111827; margin-bottom: 12px;">Tonight's Games</div>
        ${gameCards}
      </div>`;
  }

  const top5 = standings.slice(0, 5);
  const isRecipientInTop5 = top5.some(s => s.participantId === myStanding.participantId);

  const standingsRows = top5.map((s, i) => {
    const rank = i + 1;
    const isMe = s.participantId === myStanding.participantId;
    const rowBg = isMe ? '#f0fdf4' : (i % 2 === 0 ? '#ffffff' : '#f9fafb');
    const nameSuffix = isMe ? ' (You)' : '';

    return `
      <tr style="background: ${rowBg};">
        <td style="padding: 8px 6px; font-weight: ${isMe ? 'bold' : 'normal'}; color: #111827; text-align: center;">${getMedal(rank)} ${rank}</td>
        <td style="padding: 8px 6px; font-weight: ${isMe ? 'bold' : 'normal'}; color: #111827;">${escapeHtml(s.teamName)}${nameSuffix}</td>
        <td style="padding: 8px 6px; text-align: right; font-weight: ${isMe ? 'bold' : 'normal'}; color: #111827;">${s.totalPoints}</td>
        <td style="padding: 8px 6px; text-align: right; color: #16a34a; font-weight: ${isMe ? 'bold' : 'normal'};">+${s.yesterdayPoints}</td>
      </tr>`;
  }).join('');

  let recipientRowBelow = '';
  if (!isRecipientInTop5) {
    const recipientRank = myRank;
    recipientRowBelow = `
      <tr><td colspan="4" style="padding: 4px; text-align: center; color: #9ca3af; font-size: 12px;">· · ·</td></tr>
      <tr style="background: #f0fdf4;">
        <td style="padding: 8px 6px; font-weight: bold; color: #111827; text-align: center;">${recipientRank}</td>
        <td style="padding: 8px 6px; font-weight: bold; color: #111827;">${escapeHtml(myStanding.teamName)} (You)</td>
        <td style="padding: 8px 6px; text-align: right; font-weight: bold; color: #111827;">${myStanding.totalPoints}</td>
        <td style="padding: 8px 6px; text-align: right; color: #16a34a; font-weight: bold;">+${myStanding.yesterdayPoints}</td>
      </tr>`;
  }

  const standingsSection = `
    <div style="padding: 16px;">
      <div style="font-size: 16px; font-weight: bold; color: #111827; margin-bottom: 12px;">Standings Snapshot</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="border-bottom: 2px solid #e5e7eb;">
            <th style="padding: 6px; text-align: center; color: #6b7280; font-size: 12px; font-weight: 600;">#</th>
            <th style="padding: 6px; text-align: left; color: #6b7280; font-size: 12px; font-weight: 600;">Team</th>
            <th style="padding: 6px; text-align: right; color: #6b7280; font-size: 12px; font-weight: 600;">Pts</th>
            <th style="padding: 6px; text-align: right; color: #6b7280; font-size: 12px; font-weight: 600;">Yest</th>
          </tr>
        </thead>
        <tbody>
          ${standingsRows}
          ${recipientRowBelow}
        </tbody>
      </table>
      <div style="text-align: center; margin-top: 16px;">
        <a href="${escapeHtml(standingsUrl)}" style="display: inline-block; background: #16a34a; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-weight: bold; font-size: 14px;">View Full Standings</a>
      </div>
    </div>`;

  const footerSection = `
    <div style="padding: 16px; text-align: center; border-top: 1px solid #e5e7eb; margin-top: 8px;">
      <a href="${escapeHtml(recapUrl)}" style="color: #16a34a; text-decoration: none; font-size: 14px; margin: 0 12px;">Draft Recap</a>
      <a href="${escapeHtml(standingsUrl)}" style="color: #16a34a; text-decoration: none; font-size: 14px; margin: 0 12px;">Standings</a>
    </div>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    ${headerSection}
    ${statsCards}
    <div style="height: 1px; background: #e5e7eb; margin: 0 16px;"></div>
    ${playersSection}
    <div style="height: 1px; background: #e5e7eb; margin: 0 16px;"></div>
    ${tonightsGamesSection}
    <div style="height: 1px; background: #e5e7eb; margin: 0 16px;"></div>
    ${standingsSection}
    ${footerSection}
  </div>
</body>
</html>`;
}
